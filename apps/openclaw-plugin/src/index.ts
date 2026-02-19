/**
 * @memvault/openclaw-plugin v1.3.0
 *
 * OpenClaw plugin that gives agents persistent cross-session memory
 * backed by a self-hosted MemVault instance.
 *
 * Two memory modes:
 *  - enhance (default): MemVault semantic search + MEMORY.md as static context.
 *    OpenClaw native memory system works as before, plugin never writes local files.
 *  - standalone: Pure MemVault, no local file interaction at all.
 *
 * Features:
 *  - Auto-Recall: MemVault search (+ MEMORY.md in enhance mode)
 *  - Auto-Capture: conversation → MemVault only (zero local file writes)
 *  - 5 agent tools: memvault_search/store/list/get/forget
 *  - CLI: `openclaw memvault search / stats / sync`
 *  - Coexists with OpenClaw native memory_search (no name conflicts)
 */

import { Type, type Static } from "@sinclair/typebox";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemoryMode = "enhance" | "standalone";

interface PluginConfig {
  apiBaseUrl: string;
  apiKey: string;
  projectId: string;
  agentId: string;
  userId?: string;
  autoRecall?: boolean;
  autoCapture?: boolean;
  captureWindowSize?: number;
  topK?: number;
  sourceApp?: string;
  threshold?: number;
  memoryMode?: MemoryMode;
  workspacePath?: string;
}

interface Memory {
  id: string;
  content: string;
  memory: string;
  memory_type?: string;
  agent_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  event?: string;
}

interface Message {
  role: string;
  content: string;
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

// Minimal OpenClaw plugin SDK types (peer dependency)
interface OpenClawPluginApi {
  registerTool(tool: {
    name: string;
    description: string;
    parameters: unknown;
    execute: (callId: string, params: Record<string, unknown>) => Promise<ToolResult>;
  }): void;
  registerHook(hook: {
    event: string;
    handler: (ctx: Record<string, unknown>) => Promise<Record<string, unknown>>;
  }): void;
  registerCommand(cmd: {
    name: string;
    description: string;
    args?: unknown;
    run: (args: Record<string, unknown>) => Promise<void>;
  }): void;
}

// ---------------------------------------------------------------------------
// LocalMemoryReader — read-only access to OpenClaw native memory files
// ---------------------------------------------------------------------------

class LocalMemoryReader {
  private workspacePath: string;

  constructor(workspacePath?: string) {
    this.workspacePath = workspacePath
      ? resolve(workspacePath)
      : join(homedir(), ".openclaw", "workspace");
  }

  get isAvailable(): boolean {
    return existsSync(this.workspacePath);
  }

  /** Read MEMORY.md as static context (agent "identity") */
  readMemoryMd(maxLength = 2000): string {
    try {
      const filePath = join(this.workspacePath, "MEMORY.md");
      if (!existsSync(filePath)) return "";
      const content = readFileSync(filePath, "utf-8");
      if (content.length <= maxLength) return content;
      return content.slice(0, maxLength) + "\n...(truncated)";
    } catch (err) {
      console.warn("[memvault] Failed to read MEMORY.md:", err);
      return "";
    }
  }

  /** Read all local memory files (for sync command) */
  readAllMemoryFiles(): Array<{ source: string; content: string }> {
    const results: Array<{ source: string; content: string }> = [];

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
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch (err) {
      console.warn("[memvault] Failed to read local memory files:", err);
    }

    return results;
  }
}

// ---------------------------------------------------------------------------
// MemVault API Client
// ---------------------------------------------------------------------------

class MemVaultClient {
  private baseUrl: string;
  private apiKey: string;
  private projectId: string;

  constructor(config: PluginConfig) {
    this.baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
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

    return res.json() as Promise<T>;
  }

  async addMemory(
    messages: Array<{ role: string; content: string }> | string,
    agentId: string,
    userId?: string,
    options: {
      sourceApp?: string;
      infer?: boolean;
      prompt?: string;
      memoryType?: string;
    } = {}
  ) {
    return this.request<{ results: Memory[] }>("/api/v1/memories", {
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

  async searchMemories(
    query: string,
    agentId: string,
    options: { userId?: string; limit?: number; threshold?: number } = {}
  ) {
    return this.request<{ results: Memory[] }>("/api/v1/memories/search", {
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

  async listMemories(agentId: string, userId?: string) {
    const params = new URLSearchParams({ agent_id: agentId });
    if (userId) params.append("user_id", userId);
    return this.request<{ memories: Memory[] }>(
      `/api/v1/memories?${params.toString()}`
    );
  }

  async getMemory(memoryId: string) {
    return this.request<Memory>(`/api/v1/memories/${memoryId}`);
  }

  async deleteMemory(memoryId: string) {
    return this.request<void>(`/api/v1/memories/${memoryId}`, {
      method: "DELETE",
    });
  }

  async importMemories(
    memories: Array<{ source: string; content: string }>,
    agentId: string,
    userId?: string
  ) {
    return this.request<{ imported: number }>("/api/v1/memories/import", {
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

function formatSection(title: string, content: string | Memory[]): string {
  if (Array.isArray(content)) {
    const lines = content.map((m, i) => `${i + 1}. ${m.memory || m.content}`);
    return `=== ${title} ===\n${lines.join("\n")}\n${"=".repeat(title.length + 8)}`;
  }
  return `=== ${title} ===\n${content}\n${"=".repeat(title.length + 8)}`;
}

function toolOk(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

// ---------------------------------------------------------------------------
// Plugin Entry Point
// ---------------------------------------------------------------------------

export default {
  id: "memvault",

  register(api: OpenClawPluginApi, rawConfig: Record<string, unknown>) {
    const config = rawConfig as unknown as PluginConfig;
    const client = new MemVaultClient(config);
    const agentId = config.agentId;
    const defaultUserId = config.userId || "default";
    const autoRecall = config.autoRecall !== false;
    const autoCapture = config.autoCapture !== false;
    const captureWindowSize = config.captureWindowSize || 6;
    const topK = config.topK || 5;
    const sourceApp = config.sourceApp || "openclaw";
    const searchThreshold = config.threshold;
    const memoryMode: MemoryMode = config.memoryMode || "enhance";

    // LocalMemoryReader only needed in enhance mode
    const localReader = memoryMode === "enhance"
      ? new LocalMemoryReader(config.workspacePath)
      : null;

    // -------------------------------------------------------------------
    // Hook: Auto-Recall
    //   enhance:    MemVault semantic search + MEMORY.md static context
    //   standalone: MemVault semantic search only
    // -------------------------------------------------------------------
    if (autoRecall) {
      api.registerHook({
        event: "before_agent_start",
        async handler(ctx) {
          try {
            const results: string[] = [];
            const messages = (ctx.messages || []) as Message[];

            // MemVault semantic search
            const lastUserMsg = [...messages]
              .reverse()
              .find((m) => m.role === "user");
            if (lastUserMsg) {
              const mvResult = await client.searchMemories(
                lastUserMsg.content,
                agentId,
                { userId: defaultUserId, limit: topK, threshold: searchThreshold }
              );
              const memories = mvResult.results || [];
              if (memories.length > 0) {
                results.push(formatSection("MemVault Memories", memories));
              }
            }

            // enhance mode: inject MEMORY.md as static context
            if (localReader?.isAvailable) {
              const memoryMd = localReader.readMemoryMd(2000);
              if (memoryMd) {
                results.push(formatSection("Agent Identity (MEMORY.md)", memoryMd));
              }
            }

            if (results.length === 0) return {};
            return { prependContext: results.join("\n\n") };
          } catch (err) {
            console.error("[memvault] auto-recall failed:", err);
            return {};
          }
        },
      });
    }

    // -------------------------------------------------------------------
    // Hook: Auto-Capture — conversation → MemVault only
    // Both modes: never write to local files
    // -------------------------------------------------------------------
    if (autoCapture) {
      api.registerHook({
        event: "agent_end",
        async handler(ctx) {
          try {
            const messages = (ctx.messages || []) as Message[];
            const recent = messages.slice(-captureWindowSize);
            if (recent.length < 2) return {};

            await client.addMemory(recent, agentId, defaultUserId, { sourceApp });
          } catch (err) {
            console.error("[memvault] auto-capture failed:", err);
          }
          return {};
        },
      });
    }

    // -------------------------------------------------------------------
    // Tool: memvault_search
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memvault_search",
      description:
        "Search MemVault vector database for semantically similar memories. Use this for cross-session knowledge. For local file search, use the native memory_search tool instead.",
      parameters: Type.Object({
        query: Type.String({ description: "Natural language search query" }),
        limit: Type.Optional(
          Type.Number({ description: "Max results (default 5)", default: 5 })
        ),
        userId: Type.Optional(
          Type.String({ description: "Scope to a specific user" })
        ),
        threshold: Type.Optional(
          Type.Number({ description: "Minimum similarity score (0-1)" })
        ),
      }),
      async execute(_id, params) {
        const result = await client.searchMemories(
          params.query as string,
          agentId,
          {
            userId: (params.userId as string) || defaultUserId,
            limit: (params.limit as number) || 5,
            threshold: (params.threshold as number) ?? searchThreshold,
          }
        );
        const memories = result.results || [];
        if (memories.length === 0) return toolOk("No memories found.");
        const text = memories
          .map(
            (m, i) =>
              `${i + 1}. [${m.memory_type || "unknown"}] ${m.memory || m.content}`
          )
          .join("\n");
        return toolOk(`Found ${memories.length} memories:\n${text}`);
      },
    });

    // -------------------------------------------------------------------
    // Tool: memvault_store
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memvault_store",
      description:
        "Explicitly store a piece of information as a long-term memory in MemVault.",
      parameters: Type.Object({
        content: Type.String({
          description: "The information to store as a memory",
        }),
        userId: Type.Optional(Type.String({ description: "User ID" })),
        memoryType: Type.Optional(
          Type.String({ description: 'Memory type: "semantic" (default) or "procedural_memory" (agent behavior rules)' })
        ),
      }),
      async execute(_id, params) {
        await client.addMemory(
          (params.content as string),
          agentId,
          (params.userId as string) || defaultUserId,
          {
            sourceApp,
            infer: false,
            memoryType: params.memoryType as string | undefined,
          }
        );
        return toolOk("Memory stored successfully.");
      },
    });

    // -------------------------------------------------------------------
    // Tool: memvault_list
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memvault_list",
      description: "List all stored memories in MemVault for the current user.",
      parameters: Type.Object({
        userId: Type.Optional(Type.String({ description: "User ID" })),
      }),
      async execute(_id, params) {
        const result = await client.listMemories(
          agentId,
          (params.userId as string) || defaultUserId
        );
        const memories = result.memories || [];
        if (memories.length === 0) return toolOk("No memories found.");
        const text = memories
          .map(
            (m, i) =>
              `${i + 1}. [${m.id}] ${m.memory || m.content}`
          )
          .join("\n");
        return toolOk(`${memories.length} memories:\n${text}`);
      },
    });

    // -------------------------------------------------------------------
    // Tool: memvault_get
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memvault_get",
      description: "Get a specific memory from MemVault by its ID.",
      parameters: Type.Object({
        memoryId: Type.String({ description: "The memory ID" }),
      }),
      async execute(_id, params) {
        const memory = await client.getMemory(params.memoryId as string);
        return toolOk(
          `Memory ${memory.id}:\n` +
            `Type: ${memory.memory_type || "unknown"}\n` +
            `Content: ${memory.memory || memory.content}\n` +
            `Created: ${memory.created_at || "unknown"}`
        );
      },
    });

    // -------------------------------------------------------------------
    // Tool: memvault_forget
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memvault_forget",
      description:
        "Delete a specific memory from MemVault by its ID. Use this for GDPR compliance or when the user asks to forget something.",
      parameters: Type.Object({
        memoryId: Type.String({ description: "The memory ID to delete" }),
      }),
      async execute(_id, params) {
        await client.deleteMemory(params.memoryId as string);
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
        const result = await client.searchMemories(
          args.query as string,
          agentId,
          { userId: defaultUserId, limit: 10 }
        );
        const memories = result.results || [];
        if (memories.length === 0) {
          console.log("No memories found.");
          return;
        }
        console.log(`Found ${memories.length} memories:\n`);
        memories.forEach((m, i) => {
          console.log(
            `  ${i + 1}. [${m.memory_type || "?"}] ${m.memory || m.content}`
          );
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
          const types: Record<string, number> = {};
          memories.forEach((m) => {
            const t = m.memory_type || "unknown";
            types[t] = (types[t] || 0) + 1;
          });
          console.log(`MemVault Stats for agent "${agentId}" (mode: ${memoryMode}):`);
          console.log(`  Total memories: ${memories.length}`);
          Object.entries(types).forEach(([t, c]) => {
            console.log(`  ${t}: ${c}`);
          });

          if (localReader?.isAvailable) {
            const allLocal = localReader.readAllMemoryFiles();
            console.log(`\nLocal memory files: ${allLocal.length}`);
            allLocal.forEach((f) => {
              console.log(`  ${f.source}: ${f.content.length} chars`);
            });
          } else if (memoryMode === "standalone") {
            console.log(`\nLocal files: disabled (standalone mode)`);
          } else {
            console.log(`\nLocal workspace: not found (${config.workspacePath || "~/.openclaw/workspace"})`);
          }
        } catch (err) {
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
        // sync always creates a temporary reader regardless of mode
        const reader = localReader || new LocalMemoryReader(config.workspacePath);
        if (!reader.isAvailable) {
          console.log("No local workspace found. Nothing to sync.");
          return;
        }

        const allMemories = reader.readAllMemoryFiles();
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
          } catch (err) {
            console.error(`  Batch ${Math.floor(i / batchSize) + 1} failed:`, err);
          }
        }

        console.log(`\nSync complete. Imported ${imported} memories from local files to MemVault.`);
      },
    });

    console.log(
      `[memvault] Plugin loaded — mode=${memoryMode} agent=${agentId} ` +
      `recall=${autoRecall} capture=${autoCapture} captureWindow=${captureWindowSize}`
    );
  },
};
