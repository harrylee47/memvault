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
