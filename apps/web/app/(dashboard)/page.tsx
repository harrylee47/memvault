"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Bot, Key, Users } from "lucide-react";

export default function DashboardPage() {
  const { currentProject } = useProjectStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    api
      .getAnalyticsOverview(currentProject.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentProject]);

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  const statCards = [
    {
      title: "总记忆数",
      value: stats?.total_memories ?? "-",
      icon: Brain,
      description: "活跃记忆总数",
    },
    {
      title: "Agent 数",
      value: stats?.agent_count ?? "-",
      icon: Bot,
      description: "已连接的 Agent",
    },
    {
      title: "API Key",
      value: stats?.api_key_count ?? "-",
      icon: Key,
      description: "活跃 API Key",
    },
    {
      title: "唯一用户",
      value: stats?.unique_users ?? "-",
      icon: Users,
      description: "关联用户数",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">概览</h1>
        <p className="text-muted-foreground">
          项目: {currentProject.name}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : card.value}
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 趋势图 */}
      {stats?.daily_trend && stats.daily_trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>记忆趋势 (近 7 天)</CardTitle>
            <CardDescription>每日新增记忆数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-end gap-2">
              {stats.daily_trend.map((day: any) => {
                const maxCount = Math.max(...stats.daily_trend.map((d: any) => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">{day.count}</span>
                    <div
                      className="w-full rounded-t bg-primary/80 transition-all"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 记忆类型分布 */}
      {stats?.memories_by_type && Object.keys(stats.memories_by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>记忆类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.memories_by_type).map(([type, count]: [string, any]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{type}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
