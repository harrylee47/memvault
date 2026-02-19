"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Search,
  Network,
  Users,
  Webhook,
  Cpu,
  ArrowRight,
  Github,
  BookOpen,
  LogIn,
  UserPlus,
  LayoutDashboard,
  Terminal,
  Puzzle,
  Code2,
} from "lucide-react";

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
  }, []);

  const features = [
    {
      icon: Brain,
      title: "记忆管理",
      description: "自动提取、存储和分类 AI 对话中的关键记忆，支持语义和程序性两种记忆类型。",
    },
    {
      icon: Search,
      title: "语义搜索",
      description: "基于向量嵌入的语义搜索，通过自然语言查询精准召回相关记忆。",
    },
    {
      icon: Cpu,
      title: "MCP 集成",
      description: "原生支持 Model Context Protocol，Claude Desktop 和 Cursor 一键接入。",
    },
    {
      icon: Users,
      title: "多租户架构",
      description: "完整的组织、项目、成员管理体系，适合团队和企业级部署。",
    },
    {
      icon: Network,
      title: "图谱可视化",
      description: "自动构建实体关系图谱，可视化呈现记忆间的关联关系。",
    },
    {
      icon: Webhook,
      title: "Webhook 推送",
      description: "记忆变更实时 Webhook 通知，轻松集成第三方工作流。",
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* 导航栏 */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80 dark:border-gray-800">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-indigo-600" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">MemVault</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/docs" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <BookOpen className="h-4 w-4" />
              文档
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </nav>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/overview"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                进入控制台
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  登录
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-950 dark:to-indigo-950" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 text-center lg:py-32">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              <Brain className="h-4 w-4" />
              开源 AI 记忆管理平台
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
              让 AI 拥有
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                持久记忆
              </span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 sm:text-xl dark:text-gray-400">
              MemVault 为你的 AI 应用提供智能记忆层。自动提取对话中的关键信息，
              通过语义搜索实现精准召回，让每一次对话都建立在完整的上下文之上。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {isLoggedIn ? (
                <Link
                  href="/overview"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-indigo-700 transition-all hover:shadow-xl"
                >
                  进入控制台
                  <ArrowRight className="h-5 w-5" />
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-indigo-700 transition-all hover:shadow-xl"
                >
                  免费开始
                  <ArrowRight className="h-5 w-5" />
                </Link>
              )}
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-8 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <BookOpen className="h-5 w-5" />
                查看文档
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="border-t bg-gray-50 py-20 dark:bg-gray-900 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">核心功能</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              为 AI 应用提供完整的记忆管理能力
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="mb-4 inline-flex rounded-lg bg-indigo-100 p-3 dark:bg-indigo-900/30">
                  <feature.icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 接入方式 */}
      <section className="border-t py-20 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">多种接入方式</h2>
            <p className="mt-3 text-gray-600 dark:text-gray-400">
              选择最适合你的方式接入 MemVault
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border p-6 text-center dark:border-gray-800">
              <div className="mx-auto mb-4 inline-flex rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
                <Code2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">REST API</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                完整的 RESTful API，支持记忆的增删改查和语义搜索，任何语言均可接入。
              </p>
              <div className="mt-4 rounded-lg bg-gray-900 p-3 text-left dark:bg-gray-800">
                <code className="text-xs text-green-400">
                  POST /api/v1/memories
                  <br />
                  {"{ \"messages\": [...] }"}
                </code>
              </div>
            </div>
            <div className="rounded-xl border p-6 text-center dark:border-gray-800">
              <div className="mx-auto mb-4 inline-flex rounded-lg bg-purple-100 p-3 dark:bg-purple-900/30">
                <Terminal className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">MCP 协议</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                原生支持 Model Context Protocol，Claude Desktop 和 Cursor 零配置接入。
              </p>
              <div className="mt-4 rounded-lg bg-gray-900 p-3 text-left dark:bg-gray-800">
                <code className="text-xs text-green-400">
                  SSE: /mcp/sse
                  <br />
                  Tools: add_memory, search...
                </code>
              </div>
            </div>
            <div className="rounded-xl border p-6 text-center dark:border-gray-800">
              <div className="mx-auto mb-4 inline-flex rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
                <Puzzle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">OpenClaw 插件</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                通过 OpenClaw 插件生态一键安装，为 ChatGPT 等平台提供记忆能力。
              </p>
              <div className="mt-4 rounded-lg bg-gray-900 p-3 text-left dark:bg-gray-800">
                <code className="text-xs text-green-400">
                  pip install openclaw
                  <br />
                  openclaw install memvault
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-indigo-600" />
              <span className="font-semibold text-gray-900 dark:text-white">MemVault</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                文档
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                GitHub
              </a>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Built with mem0 & Next.js
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
