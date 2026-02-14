"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Bot, Key, Users, TrendingUp } from "lucide-react";

export default function AnalyticsPage() {
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

  if (loading) {
    return <div className="text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">统计分析</h1>
        <p className="text-muted-foreground">项目记忆使用统计</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总记忆数</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_memories ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent 数</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.agent_count ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Key</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.api_key_count ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">唯一用户</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.unique_users ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 趋势图 */}
      {stats?.daily_trend && stats.daily_trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <TrendingUp className="mr-2 inline h-5 w-5" />
              每日记忆趋势
            </CardTitle>
            <CardDescription>最近 7 天新增记忆</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[250px] items-end gap-3">
              {stats.daily_trend.map((day: any) => {
                const maxCount = Math.max(...stats.daily_trend.map((d: any) => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-sm font-medium">{day.count}</span>
                    <div
                      className="w-full rounded-t bg-primary transition-all hover:bg-primary/80"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-xs text-muted-foreground">{day.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 类型分布 */}
      {stats?.memories_by_type && Object.keys(stats.memories_by_type).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>记忆类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.memories_by_type).map(([type, count]: [string, any]) => {
                const total = stats.total_memories || 1;
                const pct = ((count / total) * 100).toFixed(1);
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize">{type}</span>
                      <span className="font-medium">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
