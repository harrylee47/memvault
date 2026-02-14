"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain, Bot, Key, Users, TrendingUp, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function DashboardPage() {
  const { currentProject } = useProjectStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject) return;
    setLoading(true);
    const token = localStorage.getItem("access_token");
    fetch(`/api/v1/analytics/overview?project_id=${currentProject.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentProject]);

  if (!currentProject) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
        请先选择一个项目
      </div>
    );
  }

  const statCards = [
    {
      title: "总记忆数",
      value: stats?.total_memories ?? "-",
      icon: Brain,
      description: "活跃记忆总数",
      color: "text-indigo-500",
    },
    {
      title: "Agent 数",
      value: stats?.agent_count ?? "-",
      icon: Bot,
      description: "已连接的 Agent",
      color: "text-emerald-500",
    },
    {
      title: "API Key",
      value: stats?.api_key_count ?? "-",
      icon: Key,
      description: "活跃 API Key",
      color: "text-amber-500",
    },
    {
      title: "唯一用户",
      value: stats?.unique_users ?? "-",
      icon: Users,
      description: "关联用户数",
      color: "text-cyan-500",
    },
  ];

  const typeData = stats?.memories_by_type
    ? Object.entries(stats.memories_by_type).map(([name, value]) => ({
        name,
        value: value as number,
      }))
    : [];

  const trendData = stats?.daily_trend || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight dark:text-white">概览</h1>
        <p className="text-muted-foreground">
          项目: {currentProject.name}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-gray-200">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">
                {loading ? "..." : card.value}
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 趋势图 */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <TrendingUp className="h-4 w-4" />
              记忆趋势 (近 7 天)
            </CardTitle>
            <CardDescription>每日新增记忆数量</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background, #fff)",
                      border: "1px solid var(--border, #e5e7eb)",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 记忆类型分布 */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Activity className="h-4 w-4" />
              记忆类型分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typeData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={220}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {typeData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {typeData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm capitalize dark:text-gray-300">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium dark:text-white">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
