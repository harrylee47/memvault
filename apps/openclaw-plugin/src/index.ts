/**
 * @memvault/openclaw-plugin
 *
 * OpenClaw plugin that gives agents persistent cross-session memory
 * backed by a self-hosted MemVault instance.
 *
 * Features:
 *  - Auto-Recall: injects relevant memories before each agent turn
 *  - Auto-Capture: extracts & stores memories after each agent turn
 *  - 5 agent tools: memory_search, memory_store, memory_list, memory_get, memory_forget
 *  - CLI sub-commands: `openclaw memvault search / stats`
 */

import { Type, type Static } from "@sinclair/typebox";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PluginConfig {
  apiBaseUrl: string;
  apiKey: string;
  projectId: string;
  agentId: string;
  userId?: string;
  autoRecall?: boolean;
  autoCapture?: boolean;
  topK?: number;
}

interface Memory {
  id: string;
  content: string;
  memory_type?: string;
  agent_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
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

  /** Add memories from a conversation */
  async addMemory(
    messages: Array<{ role: string; content: string }>,
    agentId: string,
    userId?: string
  ) {
    return this.request<{ results: Memory[] }>("/api/v1/memories", {
      method: "POST",
      body: JSON.stringify({
        messages,
        agent_id: agentId,
        user_id: userId,
      }),
    });
  }

  /** Search memories by natural language query */
  async searchMemories(
    query: string,
    agentId: string,
    options: { userId?: string; limit?: number } = {}
  ) {
    return this.request<{ results: Memory[] }>("/api/v1/memories/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        agent_id: agentId,
        user_id: options.userId,
        limit: options.limit || 5,
      }),
    });
  }

  /** List all memories for an agent */
  async listMemories(agentId: string, userId?: string) {
    const params = new URLSearchParams({ agent_id: agentId });
    if (userId) params.append("user_id", userId);
    return this.request<{ memories: Memory[] }>(
      `/api/v1/memories?${params.toString()}`
    );
  }

  /** Get a specific memory by ID */
  async getMemory(memoryId: string) {
    return this.request<Memory>(`/api/v1/memories/${memoryId}`);
  }

  /** Delete a specific memory */
  async deleteMemory(memoryId: string) {
    return this.request<void>(`/api/v1/memories/${memoryId}`, {
      method: "DELETE",
    });
  }

  /** Get agent stats */
  async getStats(agentId: string) {
    // The agent ID needs to be looked up first; use list as proxy
    return this.request<Record<string, unknown>>(
      `/api/v1/memories?agent_id=${agentId}&page_size=1`
    );
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function memoriesToText(memories: Memory[]): string {
  if (memories.length === 0) return "";
  const lines = memories.map(
    (m, i) => `${i + 1}. ${m.content}`
  );
  return [
    "=== Recalled Memories ===",
    ...lines,
    "========================",
  ].join("\n");
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
    const topK = config.topK || 5;

    // -------------------------------------------------------------------
    // Hook: Auto-Recall — inject relevant memories before agent responds
    // -------------------------------------------------------------------
    if (autoRecall) {
      api.registerHook({
        event: "before_agent_start",
        async handler(ctx) {
          try {
            const messages = (ctx.messages || []) as Array<{
              role: string;
              content: string;
            }>;
            // Use the last user message as the recall query
            const lastUserMsg = [...messages]
              .reverse()
              .find((m) => m.role === "user");
            if (!lastUserMsg) return {};

            const result = await client.searchMemories(
              lastUserMsg.content,
              agentId,
              { userId: defaultUserId, limit: topK }
            );

            const memories = result.results || [];
            if (memories.length === 0) return {};

            return {
              prependContext: memoriesToText(memories),
            };
          } catch (err) {
            console.error("[memvault] auto-recall failed:", err);
            return {};
          }
        },
      });
    }

    // -------------------------------------------------------------------
    // Hook: Auto-Capture — extract memories after agent responds
    // -------------------------------------------------------------------
    if (autoCapture) {
      api.registerHook({
        event: "agent_end",
        async handler(ctx) {
          try {
            const messages = (ctx.messages || []) as Array<{
              role: string;
              content: string;
            }>;
            // Send the last user + assistant pair
            const recent = messages.slice(-4);
            if (recent.length < 2) return {};

            await client.addMemory(recent, agentId, defaultUserId);
          } catch (err) {
            console.error("[memvault] auto-capture failed:", err);
          }
          return {};
        },
      });
    }

    // -------------------------------------------------------------------
    // Tool: memory_search
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memory_search",
      description:
        "Search the user's stored memories using a natural language query. Returns the most relevant memories.",
      parameters: Type.Object({
        query: Type.String({ description: "Natural language search query" }),
        limit: Type.Optional(
          Type.Number({ description: "Max results (default 5)", default: 5 })
        ),
        userId: Type.Optional(
          Type.String({ description: "Scope to a specific user" })
        ),
      }),
      async execute(_id, params) {
        const result = await client.searchMemories(
          params.query as string,
          agentId,
          {
            userId: (params.userId as string) || defaultUserId,
            limit: (params.limit as number) || 5,
          }
        );
        const memories = result.results || [];
        if (memories.length === 0) return toolOk("No memories found.");
        const text = memories
          .map(
            (m, i) =>
              `${i + 1}. [${m.memory_type || "unknown"}] ${m.content}`
          )
          .join("\n");
        return toolOk(`Found ${memories.length} memories:\n${text}`);
      },
    });

    // -------------------------------------------------------------------
    // Tool: memory_store
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memory_store",
      description:
        "Explicitly store a piece of information as a long-term memory for the user.",
      parameters: Type.Object({
        content: Type.String({
          description: "The information to store as a memory",
        }),
        userId: Type.Optional(Type.String({ description: "User ID" })),
      }),
      async execute(_id, params) {
        await client.addMemory(
          [
            { role: "assistant", content: params.content as string },
          ],
          agentId,
          (params.userId as string) || defaultUserId
        );
        return toolOk("Memory stored successfully.");
      },
    });

    // -------------------------------------------------------------------
    // Tool: memory_list
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memory_list",
      description: "List all stored memories for the current user.",
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
              `${i + 1}. [${m.id}] ${m.content}`
          )
          .join("\n");
        return toolOk(`${memories.length} memories:\n${text}`);
      },
    });

    // -------------------------------------------------------------------
    // Tool: memory_get
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memory_get",
      description: "Get a specific memory by its ID.",
      parameters: Type.Object({
        memoryId: Type.String({ description: "The memory ID" }),
      }),
      async execute(_id, params) {
        const memory = await client.getMemory(params.memoryId as string);
        return toolOk(
          `Memory ${memory.id}:\n` +
            `Type: ${memory.memory_type || "unknown"}\n` +
            `Content: ${memory.content}\n` +
            `Created: ${memory.created_at || "unknown"}`
        );
      },
    });

    // -------------------------------------------------------------------
    // Tool: memory_forget
    // -------------------------------------------------------------------
    api.registerTool({
      name: "memory_forget",
      description:
        "Delete a specific memory by its ID. Use this for GDPR compliance or when the user asks to forget something.",
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
            `  ${i + 1}. [${m.memory_type || "?"}] ${m.content}`
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
          console.log(`MemVault Stats for agent "${agentId}":`);
          console.log(`  Total memories: ${memories.length}`);
          Object.entries(types).forEach(([t, c]) => {
            console.log(`  ${t}: ${c}`);
          });
        } catch (err) {
          console.error("Failed to fetch stats:", err);
        }
      },
    });

    console.log(
      `[memvault] Plugin loaded — agent=${agentId} recall=${autoRecall} capture=${autoCapture}`
    );
  },
};
