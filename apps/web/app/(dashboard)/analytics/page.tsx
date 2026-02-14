"use client";

import { useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Bot, Key, Users, Loader2, BarChart3, Clock } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// 颜色方案
// ---------------------------------------------------------------------------
const COLORS = {
  primary: "#6366f1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

const PIE_COLORS = [
  COLORS.primary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.purple,
  COLORS.cyan,
];

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
function LoadingSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
      <BarChart3 className="mb-2 h-10 w-10" />
      <p>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 自定义 Tooltip 样式
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 热力图单元格
// ---------------------------------------------------------------------------
function HeatmapCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0;
  const bg =
    intensity === 0
      ? "bg-muted"
      : intensity < 0.25
        ? "bg-indigo-100 dark:bg-indigo-950"
        : intensity < 0.5
          ? "bg-indigo-200 dark:bg-indigo-900"
          : intensity < 0.75
            ? "bg-indigo-300 dark:bg-indigo-700"
            : "bg-indigo-500 dark:bg-indigo-500";
  return (
    <div
      className={`flex h-8 w-full items-center justify-center rounded text-[10px] font-medium ${bg}`}
      title={`${value} 条记忆`}
    >
      {value > 0 ? value : ""}
    </div>
  );
}

// ===========================================================================
// 主页面
// ===========================================================================
export default function AnalyticsPage() {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState("overview");

  // ---- 概览数据 ----
  const [overviewData, setOverviewData] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // ---- 记忆分析数据 ----
  const [memoryData, setMemoryData] = useState<any>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryLoaded, setMemoryLoaded] = useState(false);

  // ---- Agent 分析数据 ----
  const [agentData, setAgentData] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentLoaded, setAgentLoaded] = useState(false);

  // ---- 用量分析数据 ----
  const [usageData, setUsageData] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(false);

  // ---- 加载概览 ----
  useEffect(() => {
    if (!currentProject) return;
    setOverviewLoading(true);
    setMemoryLoaded(false);
    setAgentLoaded(false);
    setUsageLoaded(false);
    api
      .getAnalyticsOverview(currentProject.id)
      .then(setOverviewData)
      .catch(console.error)
      .finally(() => setOverviewLoading(false));
  }, [currentProject]);

  // ---- 按需加载其他 Tab 数据 ----
  const loadMemoryAnalytics = useCallback(() => {
    if (!currentProject || memoryLoaded) return;
    setMemoryLoading(true);
    api
      .getMemoryAnalytics(currentProject.id, 30)
      .then((data) => {
        setMemoryData(data);
        setMemoryLoaded(true);
      })
      .catch(console.error)
      .finally(() => setMemoryLoading(false));
  }, [currentProject, memoryLoaded]);

  const loadAgentAnalytics = useCallback(() => {
    if (!currentProject || agentLoaded) return;
    setAgentLoading(true);
    api
      .getAgentAnalytics(currentProject.id)
      .then((data) => {
        setAgentData(data);
        setAgentLoaded(true);
      })
      .catch(console.error)
      .finally(() => setAgentLoading(false));
  }, [currentProject, agentLoaded]);

  const loadUsageAnalytics = useCallback(() => {
    if (!currentProject || usageLoaded) return;
    setUsageLoading(true);
    api
      .getUsageAnalytics(currentProject.id, 30)
      .then((data) => {
        setUsageData(data);
        setUsageLoaded(true);
      })
      .catch(console.error)
      .finally(() => setUsageLoading(false));
  }, [currentProject, usageLoaded]);

  useEffect(() => {
    if (activeTab === "memories") loadMemoryAnalytics();
    if (activeTab === "agents") loadAgentAnalytics();
    if (activeTab === "usage") loadUsageAnalytics();
  }, [activeTab, loadMemoryAnalytics, loadAgentAnalytics, loadUsageAnalytics]);

  // ---- 无项目 ----
  if (!currentProject) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        请先选择一个项目
      </div>
    );
  }

  // =========================================================================
  // 概览 Tab 内容
  // =========================================================================
  function OverviewTab() {
    if (overviewLoading) return <LoadingSpinner />;
    if (!overviewData) return <EmptyState message="暂无概览数据" />;

    const statCards = [
      { title: "记忆总数", value: overviewData.total_memories ?? 0, icon: Brain, color: COLORS.primary },
      { title: "Agent 数", value: overviewData.agent_count ?? 0, icon: Bot, color: COLORS.success },
      { title: "API Key 数", value: overviewData.api_key_count ?? 0, icon: Key, color: COLORS.warning },
      { title: "唯一用户数", value: overviewData.unique_users ?? 0, icon: Users, color: COLORS.purple },
    ];

    // 每日趋势数据
    const dailyTrend = overviewData.daily_trend ?? [];

    // 类型分布数据
    const typeData = overviewData.memories_by_type
      ? Object.entries(overviewData.memories_by_type).map(([name, value]) => ({
          name,
          value: value as number,
        }))
      : [];

    return (
      <div className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4" style={{ color: card.color }} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 每日趋势折线图 */}
        {dailyTrend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">每日记忆趋势</CardTitle>
              <CardDescription>最近 7 天新增记忆</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    className="text-xs"
                  />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="新增记忆"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: COLORS.primary, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 类型分布饼图 */}
        {typeData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">记忆类型分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 md:flex-row">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {typeData.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // =========================================================================
  // 记忆分析 Tab 内容
  // =========================================================================
  function MemoryAnalyticsTab() {
    if (memoryLoading) return <LoadingSpinner />;
    if (!memoryData) return <EmptyState message="暂无记忆分析数据" />;

    const dailyCreation = memoryData.daily_creation ?? [];
    const byType = memoryData.by_type
      ? Object.entries(memoryData.by_type).map(([name, value]) => ({
          name,
          value: value as number,
        }))
      : [];
    const bySource = memoryData.by_source
      ? Object.entries(memoryData.by_source).map(([name, value]) => ({
          name,
          value: value as number,
        }))
      : [];
    const activeUsers = memoryData.active_users ?? [];
    const hourlyDistribution = memoryData.hourly_distribution ?? [];
    const avgLength = memoryData.avg_memory_length ?? 0;

    // 热力图最大值
    const heatmapMax = hourlyDistribution.length
      ? Math.max(...hourlyDistribution.map((h: any) => h.count ?? 0))
      : 0;

    return (
      <div className="space-y-6">
        {/* 平均记忆长度 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均记忆长度</CardTitle>
            <BarChart3 className="h-4 w-4" style={{ color: COLORS.cyan }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgLength).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">字符 / 条记忆</p>
          </CardContent>
        </Card>

        {/* 每日创建趋势 AreaChart */}
        {dailyCreation.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">每日创建趋势</CardTitle>
              <CardDescription>近 30 天记忆创建数量</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyCreation}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    className="text-xs"
                  />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="创建数"
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* 按类型统计 PieChart */}
          {byType.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">按类型统计</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={byType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {byType.map((_entry, index) => (
                        <Cell
                          key={`type-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 按来源统计 BarChart */}
          {bySource.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">按来源统计</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={bySource}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="数量" radius={[4, 4, 0, 0]}>
                      {bySource.map((_entry, index) => (
                        <Cell
                          key={`source-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 活跃用户排名 水平 BarChart */}
        {activeUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">活跃用户排名</CardTitle>
              <CardDescription>按记忆创建数量排序</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(activeUsers.length * 40, 200)}>
                <BarChart data={activeUsers} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} className="text-xs" />
                  <YAxis
                    type="category"
                    dataKey="user_id"
                    className="text-xs"
                    width={75}
                    tickFormatter={(v: string) =>
                      v.length > 12 ? v.slice(0, 12) + "..." : v
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="记忆数" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 每小时分布热力图 */}
        {hourlyDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">每小时分布</CardTitle>
              <CardDescription>24 小时内记忆创建分布</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-1">
                {Array.from({ length: 24 }, (_, hour) => {
                  const item = hourlyDistribution.find((h: any) => h.hour === hour);
                  const count = item?.count ?? 0;
                  return (
                    <div key={hour} className="flex flex-col items-center gap-1">
                      <HeatmapCell value={count} max={heatmapMax} />
                      <span className="text-[10px] text-muted-foreground">
                        {String(hour).padStart(2, "0")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
                <span>少</span>
                <div className="flex gap-0.5">
                  <div className="h-3 w-3 rounded bg-muted" />
                  <div className="h-3 w-3 rounded bg-indigo-100 dark:bg-indigo-950" />
                  <div className="h-3 w-3 rounded bg-indigo-200 dark:bg-indigo-900" />
                  <div className="h-3 w-3 rounded bg-indigo-300 dark:bg-indigo-700" />
                  <div className="h-3 w-3 rounded bg-indigo-500" />
                </div>
                <span>多</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // =========================================================================
  // Agent 分析 Tab 内容
  // =========================================================================
  function AgentAnalyticsTab() {
    if (agentLoading) return <LoadingSpinner />;
    if (!agentData) return <EmptyState message="暂无 Agent 分析数据" />;

    const agents = agentData.agents ?? [];
    const typeDistribution = agentData.type_distribution
      ? Object.entries(agentData.type_distribution).map(([name, value]) => ({
          name,
          value: value as number,
        }))
      : [];

    return (
      <div className="space-y-6">
        {/* Agent 列表表格 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent 列表</CardTitle>
            <CardDescription>所有已注册的 Agent 及其活动情况</CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <EmptyState message="暂无 Agent 数据" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">名称</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">类型</th>
                      <th className="pb-3 pr-4 font-medium text-muted-foreground">记忆数</th>
                      <th className="pb-3 font-medium text-muted-foreground">最后活跃</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent: any) => (
                      <tr key={agent.id ?? agent.name} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{agent.name ?? "-"}</td>
                        <td className="py-3 pr-4">
                          <Badge variant="secondary">{agent.type ?? "unknown"}</Badge>
                        </td>
                        <td className="py-3 pr-4">{agent.memory_count ?? 0}</td>
                        <td className="py-3 text-muted-foreground">
                          {agent.last_active
                            ? new Date(agent.last_active).toLocaleString("zh-CN")
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent 类型分布饼图 */}
        {typeDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agent 类型分布</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {typeDistribution.map((_entry, index) => (
                      <Cell
                        key={`agent-type-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // =========================================================================
  // 用量分析 Tab 内容
  // =========================================================================
  function UsageAnalyticsTab() {
    if (usageLoading) return <LoadingSpinner />;
    if (!usageData) return <EmptyState message="暂无用量分析数据" />;

    const dailyCalls = usageData.daily_calls ?? [];
    const operationDistribution = usageData.operation_distribution
      ? Object.entries(usageData.operation_distribution).map(([name, value]) => ({
          name,
          value: value as number,
        }))
      : [];
    const resourceDistribution = usageData.resource_distribution
      ? Object.entries(usageData.resource_distribution).map(([name, value]) => ({
          name,
          value: value as number,
        }))
      : [];

    return (
      <div className="space-y-6">
        {/* 每日 API 调用量折线图 */}
        {dailyCalls.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">每日 API 调用量</CardTitle>
              <CardDescription>近 30 天 API 请求趋势</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyCalls}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5)}
                    className="text-xs"
                  />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="API 调用"
                    stroke={COLORS.cyan}
                    strokeWidth={2}
                    dot={{ fill: COLORS.cyan, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* 操作分布饼图 */}
          {operationDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">操作分布</CardTitle>
                <CardDescription>各操作类型占比</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={operationDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {operationDistribution.map((_entry, index) => (
                        <Cell
                          key={`op-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 资源类型分布 */}
          {resourceDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">资源类型分布</CardTitle>
                <CardDescription>各资源类型请求占比</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={resourceDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {resourceDistribution.map((_entry, index) => (
                        <Cell
                          key={`res-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 渲染
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">统计分析</h1>
        <p className="text-muted-foreground">深度分析仪表板 - {currentProject.name}</p>
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <Tabs.Trigger
            value="overview"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            概览
          </Tabs.Trigger>
          <Tabs.Trigger
            value="memories"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            记忆分析
          </Tabs.Trigger>
          <Tabs.Trigger
            value="agents"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Agent 分析
          </Tabs.Trigger>
          <Tabs.Trigger
            value="usage"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            用量分析
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" className="mt-6">
          <OverviewTab />
        </Tabs.Content>

        <Tabs.Content value="memories" className="mt-6">
          <MemoryAnalyticsTab />
        </Tabs.Content>

        <Tabs.Content value="agents" className="mt-6">
          <AgentAnalyticsTab />
        </Tabs.Content>

        <Tabs.Content value="usage" className="mt-6">
          <UsageAnalyticsTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
