"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, ArrowLeft, Menu, X } from "lucide-react";

const sections = [
  { id: "quick-start", title: "快速开始" },
  { id: "concepts", title: "核心概念" },
  { id: "rest-api", title: "REST API" },
  { id: "mcp", title: "MCP 接入" },
  { id: "openclaw", title: "OpenClaw 插件" },
  { id: "webhook", title: "Webhook" },
  { id: "config", title: "配置" },
];

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-4 rounded-lg overflow-hidden">
      {title && (
        <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 border-b border-gray-700">
          {title}
        </div>
      )}
      <pre className="bg-gray-900 p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="text-gray-300">{children}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("quick-start");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80 dark:border-gray-800">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-indigo-600" />
              <span className="text-lg font-bold text-gray-900 dark:text-white">MemVault</span>
            </Link>
            <span className="text-sm text-gray-400">/ 文档</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white md:flex">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <button
              className="md:hidden p-2 text-gray-600"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl flex">
        {/* 左侧目录 */}
        <aside
          className={`${
            mobileNavOpen ? "block" : "hidden"
          } md:block fixed md:sticky top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r bg-white p-6 dark:bg-gray-950 dark:border-gray-800`}
        >
          <nav className="space-y-1">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              目录
            </div>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setMobileNavOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  activeSection === section.id
                    ? "bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                }`}
              >
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* 右侧内容 */}
        <main className="flex-1 min-w-0 px-6 py-10 md:px-12 lg:px-16">
          <div className="max-w-3xl">
            {/* ===== 快速开始 ===== */}
            <section id="quick-start" className="scroll-mt-20 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">快速开始</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                只需几步即可开始使用 MemVault 为你的 AI 应用添加记忆能力。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                1. 创建账户
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                访问 MemVault 注册页面创建账号。注册后系统会自动为你创建默认组织和项目。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                2. 获取 API Key
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                登录控制台，进入 <strong>设置 → API Key</strong> 页面，点击「创建 API Key」。
                请妥善保管生成的 Key，它只会显示一次。
              </p>
              <CodeBlock title="Header 认证方式">{`Authorization: Bearer YOUR_API_KEY`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                3. 添加第一条记忆
              </h3>
              <CodeBlock title="POST /api/v1/memories?project_id=YOUR_PROJECT_ID">{`{
  "messages": [
    { "role": "user", "content": "我叫张三，在北京工作，喜欢 Python 编程" },
    { "role": "assistant", "content": "你好张三！很高兴认识你。" }
  ],
  "user_id": "user-001"
}`}</CodeBlock>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                响应示例：
              </p>
              <CodeBlock>{`{
  "results": [
    {
      "id": "mem_abc123",
      "memory": "用户名叫张三，在北京工作",
      "event": "ADD"
    },
    {
      "id": "mem_def456",
      "memory": "用户喜欢 Python 编程",
      "event": "ADD"
    }
  ]
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                4. 搜索记忆
              </h3>
              <CodeBlock title="POST /api/v1/memories/search?project_id=YOUR_PROJECT_ID">{`{
  "query": "这个用户的编程偏好是什么？",
  "user_id": "user-001",
  "limit": 5
}`}</CodeBlock>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                响应示例：
              </p>
              <CodeBlock>{`{
  "results": [
    {
      "id": "mem_def456",
      "memory": "用户喜欢 Python 编程",
      "score": 0.92
    }
  ]
}`}</CodeBlock>
            </section>

            {/* ===== 核心概念 ===== */}
            <section id="concepts" className="scroll-mt-20 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">核心概念</h2>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                记忆类型
              </h3>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <p>
                  <strong className="text-gray-900 dark:text-white">Semantic Memory（语义记忆）</strong>
                  ：从对话中自动提取的事实性信息，如用户偏好、个人信息等。
                </p>
                <p>
                  <strong className="text-gray-900 dark:text-white">Procedural Memory（程序记忆）</strong>
                  ：工作流程、操作步骤等程序性知识。
                </p>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                项目（Project）
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                项目是数据隔离的基本单位。每个项目拥有独立的记忆空间、配置、API Key 和 Webhook。
                一个组织下可以创建多个项目。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                Agent
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Agent 代表一个 AI 助手身份。每个 Agent 可以拥有独立的记忆空间，
                方便为不同的 AI 角色管理各自的记忆上下文。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                用户（User）
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                通过 <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">user_id</code> 参数在
                API 调用中标识终端用户。每个用户的记忆相互隔离，
                实现个性化的记忆管理。
              </p>
            </section>

            {/* ===== REST API ===== */}
            <section id="rest-api" className="scroll-mt-20 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">REST API</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                所有 API 端点均以 <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">/api/v1</code> 为前缀，
                需要通过 Bearer Token（JWT 或 API Key）认证。
              </p>

              {/* 端点表 */}
              <div className="overflow-x-auto mb-8">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b dark:border-gray-800">
                      <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">方法</th>
                      <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">端点</th>
                      <th className="text-left py-3 font-semibold text-gray-900 dark:text-white">说明</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">POST</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">/memories</td>
                      <td className="py-2.5">添加记忆（从对话消息中提取）</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">POST</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">/memories/search</td>
                      <td className="py-2.5">语义搜索记忆</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">GET</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">/memories</td>
                      <td className="py-2.5">获取全部记忆（分页）</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">GET</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{`/memories/{id}`}</td>
                      <td className="py-2.5">获取单条记忆详情</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900 dark:text-amber-300">PUT</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{`/memories/{id}`}</td>
                      <td className="py-2.5">更新记忆内容</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">DELETE</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{`/memories/{id}`}</td>
                      <td className="py-2.5">删除记忆</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">GET</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{`/memories/{id}/history`}</td>
                      <td className="py-2.5">获取记忆变更历史</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4"><span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900 dark:text-green-300">POST</span></td>
                      <td className="py-2.5 pr-4 font-mono text-xs">/memories/actions/reset</td>
                      <td className="py-2.5">重置（删除全部）记忆</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                添加记忆
              </h3>
              <CodeBlock title="POST /api/v1/memories?project_id=xxx">{`{
  "messages": [
    { "role": "user", "content": "我更喜欢用 TypeScript 而不是 JavaScript" },
    { "role": "assistant", "content": "好的，我记住了你的偏好。" }
  ],
  "user_id": "user-001",
  "agent_id": "assistant-1",
  "metadata": { "source": "chat" }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                搜索记忆
              </h3>
              <CodeBlock title="POST /api/v1/memories/search?project_id=xxx">{`{
  "query": "用户的编程语言偏好",
  "user_id": "user-001",
  "limit": 10,
  "threshold": 0.5
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                更新记忆
              </h3>
              <CodeBlock title="PUT /api/v1/memories/{memory_id}?project_id=xxx">{`{
  "content": "用户更喜欢 Rust 而不是 TypeScript"
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                删除记忆
              </h3>
              <CodeBlock title="DELETE /api/v1/memories/{memory_id}?project_id=xxx">{`// 返回 204 No Content`}</CodeBlock>
            </section>

            {/* ===== MCP 接入 ===== */}
            <section id="mcp" className="scroll-mt-20 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">MCP 接入</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                MemVault 原生支持 <strong>Model Context Protocol (MCP)</strong>，
                可以直接在 Claude Desktop 和 Cursor 中使用。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                Claude Desktop 配置
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                编辑 Claude Desktop 的 MCP 配置文件：
              </p>
              <CodeBlock title="claude_desktop_config.json">{`{
  "mcpServers": {
    "memvault": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://YOUR_MEMVAULT_HOST/mcp/sse",
        "--header",
        "Authorization: Bearer YOUR_API_KEY"
      ]
    }
  }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                Cursor 配置
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                在 Cursor 设置 → MCP 中添加：
              </p>
              <CodeBlock title=".cursor/mcp.json">{`{
  "mcpServers": {
    "memvault": {
      "url": "https://YOUR_MEMVAULT_HOST/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                可用 MCP Tools
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b dark:border-gray-800">
                      <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">Tool</th>
                      <th className="text-left py-3 font-semibold text-gray-900 dark:text-white">说明</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">add_memory</td>
                      <td className="py-2.5">添加新的记忆</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">search_memory</td>
                      <td className="py-2.5">语义搜索记忆</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">get_all_memories</td>
                      <td className="py-2.5">获取所有记忆</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">delete_memory</td>
                      <td className="py-2.5">删除指定记忆</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ===== OpenClaw 插件 ===== */}
            <section id="openclaw" className="scroll-mt-20 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">OpenClaw 插件</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                OpenClaw 插件为 AI Agent 增加持久化记忆能力，不修改 OpenClaw 原有行为，纯增量增强。
                支持 <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">enhance</code> 和 <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">standalone</code> 两种记忆模式。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                安装
              </h3>
              <CodeBlock title="Terminal">{`npm install @rigouu0407/openclaw-plugin`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                配置
              </h3>
              <CodeBlock title="openclaw.config.json">{`{
  "plugins": {
    "memvault": {
      "apiUrl": "https://YOUR_MEMVAULT_HOST",
      "apiKey": "YOUR_API_KEY",
      "projectId": "YOUR_PROJECT_ID",
      "memoryMode": "enhance"
    }
  }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                记忆模式
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                插件提供两种记忆模式，可通过 <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">memoryMode</code> 配置项切换：
              </p>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-800">
                      <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">模式</th>
                      <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">人设来源</th>
                      <th className="text-left py-3 font-semibold text-gray-900 dark:text-white">说明</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">enhance</td>
                      <td className="py-2.5 pr-4">MEMORY.md</td>
                      <td className="py-2.5">增强模式 — MEMORY.md 提供人设，MemVault 提供记忆，两者协同工作</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">standalone</td>
                      <td className="py-2.5 pr-4">MemVault</td>
                      <td className="py-2.5">独立模式 — 所有记忆完全由 MemVault 管理，不依赖本地文件</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                工作原理
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                在 <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">enhance</code> 模式下，
                <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs">MEMORY.md</code> 充当 Agent 的"人设"（角色定义、行为准则），
                而 MemVault 充当"记忆"（对话上下文、用户偏好、历史事实）。
                Agent 在每次对话时自动加载人设 + 检索相关记忆，实现持久化的个性化交互。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                Agent 工具
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                插件向 Agent 注册以下 5 个工具：
              </p>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-800">
                      <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">Tool</th>
                      <th className="text-left py-3 font-semibold text-gray-900 dark:text-white">说明</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memvault_add</td>
                      <td className="py-2.5">添加一条新记忆到 MemVault</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memvault_search</td>
                      <td className="py-2.5">语义搜索相关记忆</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memvault_get</td>
                      <td className="py-2.5">获取指定 ID 的记忆详情</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memvault_update</td>
                      <td className="py-2.5">更新已有记忆的内容</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memvault_delete</td>
                      <td className="py-2.5">删除指定记忆</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                CLI 命令
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                插件还提供命令行工具，用于调试和管理记忆：
              </p>
              <CodeBlock title="Terminal">{`# 语义搜索记忆
memvault search "用户偏好的编程语言"

# 查看记忆统计信息
memvault stats

# 同步本地记忆到远程
memvault sync`}</CodeBlock>
            </section>

            {/* ===== Webhook ===== */}
            <section id="webhook" className="scroll-mt-20 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Webhook</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                配置 Webhook 后，MemVault 会在记忆发生变更时向你的端点推送事件通知。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                注册 Webhook
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                在控制台 <strong>设置 → Webhook</strong> 页面创建，或通过 API：
              </p>
              <CodeBlock title="POST /api/v1/webhooks?project_id=xxx">{`{
  "url": "https://your-server.com/webhook",
  "events": ["memory.created", "memory.updated", "memory.deleted"],
  "format": "json"
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                事件类型
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b dark:border-gray-800">
                      <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">事件</th>
                      <th className="text-left py-3 font-semibold text-gray-900 dark:text-white">说明</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600 dark:text-gray-400">
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memory.created</td>
                      <td className="py-2.5">新记忆被添加</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memory.updated</td>
                      <td className="py-2.5">记忆内容被更新</td>
                    </tr>
                    <tr className="border-b dark:border-gray-800">
                      <td className="py-2.5 pr-4 font-mono text-xs">memory.deleted</td>
                      <td className="py-2.5">记忆被删除</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                载荷格式
              </h3>
              <CodeBlock title="Webhook Payload">{`{
  "event": "memory.created",
  "timestamp": "2026-02-15T12:00:00Z",
  "data": {
    "id": "mem_abc123",
    "memory": "用户偏好使用 TypeScript",
    "user_id": "user-001",
    "agent_id": "assistant-1",
    "project_id": "proj_xxx"
  }
}`}</CodeBlock>
            </section>

            {/* ===== 配置 ===== */}
            <section id="config" className="scroll-mt-20 mb-16">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">配置</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                每个项目可以独立配置 LLM Provider、Embedder 和自定义提示词。
                在控制台 <strong>设置 → 配置中心</strong> 页面修改，或通过 API。
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                LLM Provider
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                支持 OpenAI、Anthropic 等模型，用于从对话中提取记忆。
              </p>
              <CodeBlock title="PUT /api/v1/config?project_id=xxx">{`{
  "llm": {
    "provider": "openai",
    "config": {
      "model": "gpt-4o-mini",
      "api_key": "sk-..."
    }
  }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                Embedder
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                配置向量嵌入模型，用于语义搜索。
              </p>
              <CodeBlock title="PUT /api/v1/config?project_id=xxx">{`{
  "embedder": {
    "provider": "openai",
    "config": {
      "model": "text-embedding-3-small",
      "api_key": "sk-..."
    }
  }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-8 mb-3">
                自定义提示词
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                自定义 LLM 提取记忆时使用的提示词，以适配特定业务场景。
              </p>
              <CodeBlock title="PUT /api/v1/config?project_id=xxx">{`{
  "custom_prompt": "你是一个记忆提取助手。请从对话中提取用户的偏好、习惯和重要信息。重点关注技术栈和工作流程相关的信息。"
}`}</CodeBlock>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
