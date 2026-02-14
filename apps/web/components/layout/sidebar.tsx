"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Brain,
  LayoutDashboard,
  Search,
  Bot,
  Network,
  BarChart3,
  Settings,
  Key,
  Webhook,
  Building2,
  Users,
  FolderKanban,
  ScrollText,
} from "lucide-react";

const navigation = [
  { name: "概览", href: "/", icon: LayoutDashboard },
  { name: "记忆管理", href: "/memories", icon: Brain },
  { name: "Agent", href: "/agents", icon: Bot },
  { name: "图谱", href: "/graph", icon: Network },
  { name: "统计分析", href: "/analytics", icon: BarChart3 },
];

const settingsNav = [
  { name: "配置中心", href: "/settings/config", icon: Settings },
  { name: "API Key", href: "/settings/api-keys", icon: Key },
  { name: "Webhook", href: "/settings/webhooks", icon: Webhook },
  { name: "审计日志", href: "/settings/audit-logs", icon: ScrollText },
];

const orgNav = [
  { name: "组织", href: "/org", icon: Building2 },
  { name: "成员", href: "/org/members", icon: Users },
  { name: "项目", href: "/org/projects", icon: FolderKanban },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Brain className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">MemVault</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          主菜单
        </div>
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}

        <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          设置
        </div>
        {settingsNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}

        <div className="mb-2 mt-6 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          组织
        </div>
        {orgNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
}
