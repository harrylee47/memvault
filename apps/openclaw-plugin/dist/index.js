/**
 * @memvault/openclaw-plugin v1.2.0
 *
 * OpenClaw plugin that gives agents persistent cross-session memory
 * backed by a self-hosted MemVault instance, with local memory synergy.
 *
 * Features:
 *  - Three-layer Auto-Recall: MemVault + MEMORY.md + daily log
 *  - Auto-Capture with dual-write: MemVault + local files
 *  - 5 agent tools: memvault_search, memvault_store, memvault_list, memvault_get, memvault_forget
 *  - CLI sub-commands: `openclaw memvault search / stats / sync`
 *  - Coexists with OpenClaw native memory_search (no name conflicts)
 */
import { Type } from "@sinclair/typebox";
import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
// ---------------------------------------------------------------------------
// LocalMemoryReader — reads/writes OpenClaw native memory files
// ---------------------------------------------------------------------------
class LocalMemoryReader {
    workspacePath;
    constructor(workspacePath) {
        this.workspacePath = workspacePath
            ? resolve(workspacePath)
            : join(homedir(), ".openclaw", "workspace");
    }
    get isAvailable() {
        return existsSync(this.workspacePath);
    }
    readMemoryMd(maxLength = 2000) {
        try {
            const filePath = join(this.workspacePath, "MEMORY.md");
            if (!existsSync(filePath))
                return "";
            const content = readFileSync(filePath, "utf-8");
            if (content.length <= maxLength)
                return content;
            return content.slice(0, maxLength) + "\n...(truncated)";
        }
        catch (err) {
            console.warn("[memvault] Failed to read MEMORY.md:", err);
            return "";
        }
    }
    readTodayDailyLog(maxLength = 1000) {
        try {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const filePath = join(this.workspacePath, "memory", `${today}.md`);
            if (!existsSync(filePath))
                return "";
            const content = readFileSync(filePath, "utf-8");
            if (content.length <= maxLength)
                return content;
            return content.slice(0, maxLength) + "\n...(truncated)";
        }
        catch (err) {
            console.warn("[memvault] Failed to read daily log:", err);
            return "";
        }
    }
    appendToMemoryMd(lines) {
        try {
            const filePath = join(this.workspacePath, "MEMORY.md");
            const timestamp = new Date().toISOString().slice(0, 10);
            const header = `\n\n<!-- memvault sync ${timestamp} -->\n`;
            const content = header + lines.map((l) => `- ${l}`).join("\n") + "\n";
            appendFileSync(filePath, content, "utf-8");
        }
        catch (err) {
            console.warn("[memvault] Failed to append to MEMORY.md:", err);
        }
    }
    appendToDailyLog(content) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const memoryDir = join(this.workspacePath, "memory");
            if (!existsSync(memoryDir)) {
                mkdirSync(memoryDir, { recursive: true });
            }
            const filePath = join(memoryDir, `${today}.md`);
            const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS
            appendFileSync(filePath, `\n- ${timestamp} ${content}`, "utf-8");
        }
        catch (err) {
            console.warn("[memvault] Failed to append to daily log:", err);
        }
    }
    readAllMemoryFiles() {
        const results = [];
        try {
            // Read MEMORY.md
            const memoryMdPath = join(this.workspacePath, "MEMORY.md");
            if (existsSync(memoryMdPath)) {
                const content = readFileSync(memoryMdPath, "utf-8").trim();
                if (content) {
                    results.push({ source: "MEMORY.md", content });
                }
            }
            // Read all daily log files
            const memoryDir = join(this.workspacePath, "memory");
            if (existsSync(memoryDir)) {
                const files = readdirSync(memoryDir)
                    .filter((f) => f.endsWith(".md"))
                    .sort();
                for (const file of files) {
                    try {
                        const content = readFileSync(join(memoryDir, file), "utf-8").trim();
                        if (content) {
                            results.push({ source: `memory/${file}`, content });
                        }
                    }
                    catch {
                        // skip unreadable files
                    }
                }
            }
        }
        catch (err) {
            console.warn("[memvault] Failed to read local memory files:", err);
        }
        return results;
    }
}
// ---------------------------------------------------------------------------
// MemVault API Client
// ---------------------------------------------------------------------------
class MemVaultClient {
    baseUrl;
    apiKey;
    projectId;
    constructor(config) {
        this.baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
        this.apiKey = config.apiKey;
        this.projectId = config.projectId;
    }
    async request(path, options = {}) {
        const separator = path.includes("?") ? "&" : "?";
        const url = `${this.baseUrl}${path}${separator}project_id=${this.projectId}`;
        const res = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                ...(options.headers || {}),
            },
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`MemVault API ${res.status}: ${text}`);
        }
        return res.json();
    }
    /** Add memories from a conversation */
    async addMemory(messages, agentId, userId, options = {}) {
        return this.request("/api/v1/memories", {
            method: "POST",
            body: JSON.stringify({
                messages,
                agent_id: agentId,
                user_id: userId,
                ...(options.sourceApp && { source_app: options.sourceApp }),
                ...(options.infer === false && { infer: false }),
                ...(options.prompt && { prompt: options.prompt }),
                ...(options.memoryType && { memory_type: options.memoryType }),
            }),
        });
    }
    /** Search memories by natural language query */
    async searchMemories(query, agentId, options = {}) {
        return this.request("/api/v1/memories/search", {
            method: "POST",
            body: JSON.stringify({
                query,
                agent_id: agentId,
                user_id: options.userId,
                limit: options.limit || 5,
                ...(options.threshold !== undefined && { threshold: options.threshold }),
            }),
        });
    }
    /** List all memories for an agent */
    async listMemories(agentId, userId) {
        const params = new URLSearchParams({ agent_id: agentId });
        if (userId)
            params.append("user_id", userId);
        return this.request(`/api/v1/memories?${params.toString()}`);
    }
    /** Get a specific memory by ID */
    async getMemory(memoryId) {
        return this.request(`/api/v1/memories/${memoryId}`);
    }
    /** Delete a specific memory */
    async deleteMemory(memoryId) {
        return this.request(`/api/v1/memories/${memoryId}`, {
            method: "DELETE",
        });
    }
    /** Get agent stats */
    async getStats(agentId) {
        return this.request(`/api/v1/memories?agent_id=${agentId}&page_size=1`);
    }
    /** Import memories in batch (for sync command) */
    async importMemories(memories, agentId, userId) {
        return this.request("/api/v1/memories/import", {
            method: "POST",
            body: JSON.stringify({
                memories,
                agent_id: agentId,
                user_id: userId,
            }),
        });
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatSection(title, content) {
    if (Array.isArray(content)) {
        const lines = content.map((m, i) => `${i + 1}. ${m.memory || m.content}`);
        return `=== ${title} ===\n${lines.join("\n")}\n${"=".repeat(title.length + 8)}`;
    }
    return `=== ${title} ===\n${content}\n${"=".repeat(title.length + 8)}`;
}
function toolOk(text) {
    return { content: [{ type: "text", text }] };
}
// ---------------------------------------------------------------------------
// Plugin Entry Point
// ---------------------------------------------------------------------------
export default {
    id: "memvault",
    register(api, rawConfig) {
        const config = rawConfig;
        const client = new MemVaultClient(config);
        const agentId = config.agentId;
        const defaultUserId = config.userId || "default";
        const autoRecall = config.autoRecall !== false;
        const autoCapture = config.autoCapture !== false;
        const captureWindowSize = config.captureWindowSize || 6;
        const topK = config.topK || 5;
        const sourceApp = config.sourceApp || "openclaw";
        const searchThreshold = config.threshold;
        const localMemorySync = config.localMemorySync !== false;
        // Initialize LocalMemoryReader
        const localReader = new LocalMemoryReader(config.workspacePath);
        // -------------------------------------------------------------------
        // Hook: Auto-Recall — three-layer complementary recall
        // Layer 1: MemVault semantic search (precise relevance)
        // Layer 2: Local MEMORY.md (curated long-term knowledge)
        // Layer 3: Today's daily log (recent activity context)
        // -------------------------------------------------------------------
        if (autoRecall) {
            api.registerHook({
                event: "before_agent_start",
                async handler(ctx) {
                    try {
                        const results = [];
                        const messages = (ctx.messages || []);
                        // Layer 1: MemVault semantic search
                        const lastUserMsg = [...messages]
                            .reverse()
                            .find((m) => m.role === "user");
                        if (lastUserMsg) {
                            const mvResult = await client.searchMemories(lastUserMsg.content, agentId, { userId: defaultUserId, limit: topK, threshold: searchThreshold });
                            const memories = mvResult.results || [];
                            if (memories.length > 0) {
                                results.push(formatSection("MemVault Memories", memories));
                            }
                        }
                        // Layer 2 & 3: Local memory files
                        if (localReader.isAvailable) {
                            const memoryMd = localReader.readMemoryMd(2000);
                            if (memoryMd) {
                                results.push(formatSection("Long-term Memory (MEMORY.md)", memoryMd));
                            }
                            const dailyLog = localReader.readTodayDailyLog(1000);
                            if (dailyLog) {
                                results.push(formatSection("Today's Activity", dailyLog));
                            }
                        }
                        if (results.length === 0)
                            return {};
                        return { prependContext: results.join("\n\n") };
                    }
                    catch (err) {
                        console.error("[memvault] auto-recall failed:", err);
                        return {};
                    }
                },
            });
        }
        // -------------------------------------------------------------------
        // Hook: Auto-Capture — dual-write to MemVault + local files
        // -------------------------------------------------------------------
        if (autoCapture) {
            api.registerHook({
                event: "agent_end",
                async handler(ctx) {
                    try {
                        const messages = (ctx.messages || []);
                        const recent = messages.slice(-captureWindowSize);
                        if (recent.length < 2)
                            return {};
                        // Store in MemVault
                        const result = await client.addMemory(recent, agentId, defaultUserId, { sourceApp });
                        // Dual-write: sync new memories back to local files
                        if (localMemorySync && localReader.isAvailable) {
                            const newMemories = Array.isArray(result.results)
                                ? result.results.filter((m) => m.event === "ADD")
                                : [];
                            if (newMemories.length > 0) {
                                // Append to MEMORY.md
                                const lines = newMemories.map((m) => m.memory || m.content);
                                localReader.appendToMemoryMd(lines);
                                // Record to daily log
                                localReader.appendToDailyLog(`[memvault] Captured ${newMemories.length} memories`);
                            }
                        }
                    }
                    catch (err) {
                        console.error("[memvault] auto-capture failed:", err);
                    }
                    return {};
                },
            });
        }
        // -------------------------------------------------------------------
        // Tool: memvault_search (renamed from memory_search to avoid conflict)
        // -------------------------------------------------------------------
        api.registerTool({
            name: "memvault_search",
            description: "Search MemVault vector database for semantically similar memories. Use this for cross-session knowledge. For local file search, use the native memory_search tool instead.",
            parameters: Type.Object({
                query: Type.String({ description: "Natural language search query" }),
                limit: Type.Optional(Type.Number({ description: "Max results (default 5)", default: 5 })),
                userId: Type.Optional(Type.String({ description: "Scope to a specific user" })),
                threshold: Type.Optional(Type.Number({ description: "Minimum similarity score (0-1)" })),
            }),
            async execute(_id, params) {
                const result = await client.searchMemories(params.query, agentId, {
                    userId: params.userId || defaultUserId,
                    limit: params.limit || 5,
                    threshold: params.threshold ?? searchThreshold,
                });
                const memories = result.results || [];
                if (memories.length === 0)
                    return toolOk("No memories found.");
                const text = memories
                    .map((m, i) => `${i + 1}. [${m.memory_type || "unknown"}] ${m.memory || m.content}`)
                    .join("\n");
                return toolOk(`Found ${memories.length} memories:\n${text}`);
            },
        });
        // -------------------------------------------------------------------
        // Tool: memvault_store (renamed from memory_store)
        // -------------------------------------------------------------------
        api.registerTool({
            name: "memvault_store",
            description: "Explicitly store a piece of information as a long-term memory in MemVault.",
            parameters: Type.Object({
                content: Type.String({
                    description: "The information to store as a memory",
                }),
                userId: Type.Optional(Type.String({ description: "User ID" })),
                memoryType: Type.Optional(Type.String({ description: 'Memory type: "semantic" (default) or "procedural_memory" (agent behavior rules)' })),
            }),
            async execute(_id, params) {
                await client.addMemory(params.content, agentId, params.userId || defaultUserId, {
                    sourceApp,
                    infer: false,
                    memoryType: params.memoryType,
                });
                return toolOk("Memory stored successfully.");
            },
        });
        // -------------------------------------------------------------------
        // Tool: memvault_list (renamed from memory_list)
        // -------------------------------------------------------------------
        api.registerTool({
            name: "memvault_list",
            description: "List all stored memories in MemVault for the current user.",
            parameters: Type.Object({
                userId: Type.Optional(Type.String({ description: "User ID" })),
            }),
            async execute(_id, params) {
                const result = await client.listMemories(agentId, params.userId || defaultUserId);
                const memories = result.memories || [];
                if (memories.length === 0)
                    return toolOk("No memories found.");
                const text = memories
                    .map((m, i) => `${i + 1}. [${m.id}] ${m.memory || m.content}`)
                    .join("\n");
                return toolOk(`${memories.length} memories:\n${text}`);
            },
        });
        // -------------------------------------------------------------------
        // Tool: memvault_get (renamed from memory_get)
        // -------------------------------------------------------------------
        api.registerTool({
            name: "memvault_get",
            description: "Get a specific memory from MemVault by its ID.",
            parameters: Type.Object({
                memoryId: Type.String({ description: "The memory ID" }),
            }),
            async execute(_id, params) {
                const memory = await client.getMemory(params.memoryId);
                return toolOk(`Memory ${memory.id}:\n` +
                    `Type: ${memory.memory_type || "unknown"}\n` +
                    `Content: ${memory.memory || memory.content}\n` +
                    `Created: ${memory.created_at || "unknown"}`);
            },
        });
        // -------------------------------------------------------------------
        // Tool: memvault_forget (renamed from memory_forget)
        // -------------------------------------------------------------------
        api.registerTool({
            name: "memvault_forget",
            description: "Delete a specific memory from MemVault by its ID. Use this for GDPR compliance or when the user asks to forget something.",
            parameters: Type.Object({
                memoryId: Type.String({ description: "The memory ID to delete" }),
            }),
            async execute(_id, params) {
                await client.deleteMemory(params.memoryId);
                return toolOk("Memory deleted successfully.");
            },
        });
        // -------------------------------------------------------------------
        // CLI: openclaw memvault search <query>
        // -------------------------------------------------------------------
        api.registerCommand({
            name: "memvault search",
            description: "Search MemVault memories from the command line",
            args: Type.Object({
                query: Type.String({ description: "Search query" }),
            }),
            async run(args) {
                const result = await client.searchMemories(args.query, agentId, { userId: defaultUserId, limit: 10 });
                const memories = result.results || [];
                if (memories.length === 0) {
                    console.log("No memories found.");
                    return;
                }
                console.log(`Found ${memories.length} memories:\n`);
                memories.forEach((m, i) => {
                    console.log(`  ${i + 1}. [${m.memory_type || "?"}] ${m.memory || m.content}`);
                });
            },
        });
        // -------------------------------------------------------------------
        // CLI: openclaw memvault stats
        // -------------------------------------------------------------------
        api.registerCommand({
            name: "memvault stats",
            description: "Show MemVault memory statistics",
            async run() {
                try {
                    const result = await client.listMemories(agentId, defaultUserId);
                    const memories = result.memories || [];
                    const types = {};
                    memories.forEach((m) => {
                        const t = m.memory_type || "unknown";
                        types[t] = (types[t] || 0) + 1;
                    });
                    console.log(`MemVault Stats for agent "${agentId}":`);
                    console.log(`  Total memories: ${memories.length}`);
                    Object.entries(types).forEach(([t, c]) => {
                        console.log(`  ${t}: ${c}`);
                    });
                    if (localReader.isAvailable) {
                        const allLocal = localReader.readAllMemoryFiles();
                        console.log(`\nLocal memory files: ${allLocal.length}`);
                        allLocal.forEach((f) => {
                            console.log(`  ${f.source}: ${f.content.length} chars`);
                        });
                    }
                    else {
                        console.log(`\nLocal workspace: not found (${config.workspacePath || "~/.openclaw/workspace"})`);
                    }
                }
                catch (err) {
                    console.error("Failed to fetch stats:", err);
                }
            },
        });
        // -------------------------------------------------------------------
        // CLI: openclaw memvault sync — import local memories into MemVault
        // -------------------------------------------------------------------
        api.registerCommand({
            name: "memvault sync",
            description: "Import local OpenClaw memories into MemVault (one-time migration)",
            async run() {
                if (!localReader.isAvailable) {
                    console.log("No local workspace found. Nothing to sync.");
                    return;
                }
                const allMemories = localReader.readAllMemoryFiles();
                if (allMemories.length === 0) {
                    console.log("No local memories found.");
                    return;
                }
                console.log(`Found ${allMemories.length} local memory files. Importing...`);
                const batchSize = 50;
                let imported = 0;
                for (let i = 0; i < allMemories.length; i += batchSize) {
                    const batch = allMemories.slice(i, i + batchSize);
                    try {
                        const result = await client.importMemories(batch, agentId, defaultUserId);
                        imported += result.imported;
                        console.log(`  Batch ${Math.floor(i / batchSize) + 1}: imported ${result.imported} memories`);
                    }
                    catch (err) {
                        console.error(`  Batch ${Math.floor(i / batchSize) + 1} failed:`, err);
                    }
                }
                console.log(`\nSync complete. Imported ${imported} memories from local files to MemVault.`);
            },
        });
        console.log(`[memvault] Plugin loaded — agent=${agentId} recall=${autoRecall} capture=${autoCapture} ` +
            `captureWindow=${captureWindowSize} localSync=${localMemorySync} ` +
            `workspace=${localReader.isAvailable ? "found" : "not found"}`);
    },
};
