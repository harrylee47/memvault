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
interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
}
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
declare const _default: {
    id: string;
    register(api: OpenClawPluginApi, rawConfig: Record<string, unknown>): void;
};
export default _default;
