"use client";

import { useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate, truncate, generateSlug, validateAgentId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import {
  Plus,
  Bot,
  Trash2,
  Activity,
  Brain,
  Clock,
  ChevronRight,
  BookOpen,
  Code,
  Webhook,
  Copy,
  Check,
  AlertCircle,
  Key,
} from "lucide-react";

interface Agent {
  id: string;
  agent_id: string;
  name: string;
  agent_type: string;
  project_id: string;
  created_at: string;
  updated_at?: string;
}

interface AgentStats {
  memory_count?: number;
  total_memories?: number;
  last_active?: string;
  last_activity?: string;
  [key: string]: any;
}

interface AgentMemory {
  id: string;
  content: string;
  memory_type: string;
  created_at: string;
  updated_at: string;
}

export default function AgentsPage() {
  const { currentProject } = useProjectStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentIdTouched, setAgentIdTouched] = useState(false);
  const [agentType, setAgentType] = useState("api");
  const [creating, setCreating] = useState(false);

  // Agent 统计缓存
  const [agentStatsMap, setAgentStatsMap] = useState<Record<string, AgentStats | null>>({});

  // 详情面板
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [agentMemories, setAgentMemories] = useState<AgentMemory[]>([]);
  const [detailStats, setDetailStats] = useState<AgentStats | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 接入引导
  const [showGuideDialog, setShowGuideDialog] = useState(false);
  const [guideAgent, setGuideAgent] = useState<Agent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 删除确认
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Agent ID 校验
  const agentIdValid = agentId.length === 0 || validateAgentId(agentId);
  const canCreate = !!name && !!agentId && validateAgentId(agentId) && !creating;

  // 根据名称自动建议 agent_id
  useEffect(() => {
    if (!agentIdTouched && name) {
      const suggested = generateSlug(name);
      setAgentId(suggested || "");
    }
  }, [name, agentIdTouched]);

  const loadAgents = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await api.getAgents(currentProject.id);
      setAgents(data);

      // 加载每个 agent 的统计信息
      const statsMap: Record<string, AgentStats | null> = {};
      await Promise.allSettled(
        data.map(async (agent: Agent) => {
          try {
            const stats = await api.getAgentStats(agent.id, currentProject.id);
            statsMap[agent.id] = stats;
          } catch {
            // 统计加载失败时标记为 null，而非空对象
            statsMap[agent.id] = null;
          }
        })
      );
      setAgentStatsMap(statsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCreate = async () => {
    if (!currentProject || !canCreate) return;
    setCreating(true);
    try {
      await api.createAgent(currentProject.id, {
        name,
        agent_id: agentId,
        agent_type: agentType,
      });
      toast({ title: "Agent 已创建" });
      setShowDialog(false);
      setName("");
      setAgentId("");
      setAgentIdTouched(false);
      loadAgents();
    } catch (err: any) {
      toast({
        title: "创建失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!currentProject) return;
    setDeletingId(agent.id);
    try {
      await api.deleteAgent(agent.id, currentProject.id);
      toast({ title: "Agent 已删除" });
      if (expandedAgentId === agent.id) {
        setExpandedAgentId(null);
      }
      loadAgents();
    } catch (err: any) {
      toast({
        title: "删除失败",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // 展开/收起详情面板
  const toggleAgentDetail = async (agent: Agent) => {
    if (expandedAgentId === agent.id) {
      setExpandedAgentId(null);
      return;
    }

    setExpandedAgentId(agent.id);
    setDetailLoading(true);
    setAgentMemories([]);
    setDetailStats(null);

    if (!currentProject) return;

    try {
      const [memoriesData, statsData] = await Promise.allSettled([
        api.getAgentMemories(agent.id, currentProject.id, { page_size: "10" }),
        api.getAgentStats(agent.id, currentProject.id),
      ]);

      if (memoriesData.status === "fulfilled") {
        const mData = memoriesData.value;
        setAgentMemories(Array.isArray(mData) ? mData : mData.memories || []);
      }
      if (statsData.status === "fulfilled") {
        setDetailStats(statsData.value);
      }
      // statsData 失败时 detailStats 保持为 null，UI 会显示"暂无统计"
    } catch (err) {
      console.error("Failed to load agent details:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // 打开接入引导
  const openGuide = (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
    setGuideAgent(agent);
    setShowGuideDialog(true);
  };

  // 复制到剪贴板
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const getApiBaseUrl = () => {
    if (typeof window !== "undefined") {
      return process.env.NEXT_PUBLIC_API_URL || window.location.origin;
    }
    return process.env.NEXT_PUBLIC_API_URL || "";
  };

  // 渲染统计摘要（处理 null / 空对象情况）
  const renderStatsSummary = (stats: AgentStats | null) => {
    if (stats === null) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>暂无统计</span>
        </div>
      );
    }
    const memoryCount = stats.memory_count ?? stats.total_memories ?? 0;
    const lastActive = stats.last_active || stats.last_activity || null;
    return (
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          <span>{memoryCount} 条记忆</span>
        </div>
        {lastActive && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>最后活跃: {formatDate(lastActive)}</span>
          </div>
        )}
      </div>
    );
  };

  // 渲染详情统计信息（处理 null 情况）
  const renderDetailStats = () => {
    if (!detailStats || Object.keys(detailStats).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">暂无统计数据</p>
          <p className="text-xs mt-1">该 Agent 尚未产生活动记录</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {Object.entries(detailStats).map(([key, value]) => (
          <div
            key={key}
            className="flex justify-between items-center text-sm"
          >
            <span className="text-muted-foreground">
              {key === "memory_count" || key === "total_memories"
                ? "记忆总数"
                : key === "last_active" || key === "last_activity"
                ? "最后活跃"
                : key}
            </span>
            <span className="font-medium">
              {typeof value === "string" && value.includes("T")
                ? formatDate(value)
                : String(value ?? "-")}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent 管理</h1>
          <p className="text-muted-foreground">
            管理已连接的 AI Agent ({agents.length} 个)
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) {
            setName("");
            setAgentId("");
            setAgentIdTouched(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              添加 Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加 Agent</DialogTitle>
              <DialogDescription>注册一个新的 AI Agent</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>名称</Label>
                <Input
                  placeholder="例如: My Claude Agent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Agent ID</Label>
                <Input
                  placeholder="唯一标识符，如: my-claude-agent"
                  value={agentId}
                  onChange={(e) => {
                    setAgentId(e.target.value);
                    setAgentIdTouched(true);
                  }}
                  className={agentId && !agentIdValid ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  仅允许字母、数字、下划线和连字符，1-64 字符
                </p>
                {agentId && !agentIdValid && (
                  <p className="text-xs text-destructive">
                    Agent ID 格式无效：仅允许字母、数字、下划线（_）和连字符（-）
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={agentType} onValueChange={setAgentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">REST API</SelectItem>
                    <SelectItem value="mcp">MCP</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="openclaw">OpenClaw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                取消
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!canCreate}
              >
                {creating ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            加载中...
          </div>
        ) : agents.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            暂无 Agent，点击"添加 Agent"开始
          </div>
        ) : (
          agents.map((agent) => {
            const stats = agentStatsMap[agent.id] ?? null;
            const isExpanded = expandedAgentId === agent.id;

            return (
              <div key={agent.id} className={`${isExpanded ? "md:col-span-2 lg:col-span-3" : ""}`}>
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isExpanded ? "ring-2 ring-primary/20" : ""
                  }`}
                  onClick={() => toggleAgentDetail(agent)}
                >
                  <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                    <Bot className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {agent.agent_id}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary">
                        {agent.agent_type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(agent.created_at)}
                      </span>
                    </div>

                    {/* Agent 统计摘要 */}
                    {renderStatsSummary(stats)}

                    {/* 操作按钮 */}
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => openGuide(agent, e)}
                      >
                        <BookOpen className="mr-1 h-3 w-3" />
                        接入引导
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === agent.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`确定要删除 Agent "${agent.name}"？`)) {
                            handleDelete(agent);
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        {deletingId === agent.id ? "删除中..." : "删除"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 展开的详情面板 */}
                {isExpanded && (
                  <Card className="mt-2">
                    <CardContent className="pt-6">
                      {detailLoading ? (
                        <div className="py-6 text-center text-muted-foreground">
                          加载详情中...
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* 统计信息 */}
                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <Activity className="h-4 w-4" />
                              统计信息
                            </h3>
                            {renderDetailStats()}
                          </div>

                          {/* 记忆列表 */}
                          <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                              <Brain className="h-4 w-4" />
                              最近记忆
                            </h3>
                            {agentMemories.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">
                                该 Agent 暂无记忆
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-80 overflow-y-auto">
                                {agentMemories.map((mem) => (
                                  <div
                                    key={mem.id}
                                    className="rounded-md border p-3"
                                  >
                                    <p className="text-sm">
                                      {truncate(mem.content, 150)}
                                    </p>
                                    <div className="mt-1 flex gap-2">
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px]"
                                      >
                                        {mem.memory_type}
                                      </Badge>
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatDate(mem.created_at)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 接入引导 Dialog */}
      <Dialog open={showGuideDialog} onOpenChange={setShowGuideDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              接入引导 - {guideAgent?.name}
            </DialogTitle>
            <DialogDescription>
              选择以下任一方式将 Agent 接入 MemVault
            </DialogDescription>
          </DialogHeader>

          {guideAgent && (
            <>
              {/* 前置条件提示 */}
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      前置条件：获取 API Key
                    </h4>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      使用 REST API 或 Webhook 方式接入前，需要先创建 API Key 用于身份验证。
                    </p>
                    <ol className="text-xs text-amber-700 dark:text-amber-300 mt-2 list-decimal list-inside space-y-1">
                      <li>进入左侧菜单「设置 &rarr; API Key」页面</li>
                      <li>点击「创建 API Key」，填写名称并选择权限范围</li>
                      <li>创建成功后，复制 API Key（仅显示一次，请妥善保存）</li>
                      <li>在下方示例代码中将 <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded text-[11px]">YOUR_API_KEY</code> 替换为实际值</li>
                    </ol>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="mcp" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="mcp">
                    <Code className="mr-1 h-3 w-3" />
                    MCP
                  </TabsTrigger>
                  <TabsTrigger value="rest">
                    <Code className="mr-1 h-3 w-3" />
                    REST API
                  </TabsTrigger>
                  <TabsTrigger value="webhook">
                    <Webhook className="mr-1 h-3 w-3" />
                    Webhook
                  </TabsTrigger>
                </TabsList>

                {/* MCP 接入 */}
                <TabsContent value="mcp" className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">1. Claude Desktop 配置</h4>
                    <p className="text-sm text-muted-foreground">
                      将以下配置添加到 Claude Desktop 的配置文件
                      <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                        claude_desktop_config.json
                      </code>
                      中:
                    </p>
                    <div className="relative">
                      <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto">
{`{
  "mcpServers": {
    "memvault": {
      "url": "${getApiBaseUrl()}/mcp/sse?project_id=${currentProject.id}&agent_id=${guideAgent.agent_id}"
    }
  }
}`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(
                              {
                                mcpServers: {
                                  memvault: {
                                    url: `${getApiBaseUrl()}/mcp/sse?project_id=${currentProject.id}&agent_id=${guideAgent.agent_id}`,
                                  },
                                },
                              },
                              null,
                              2
                            ),
                            "mcp-config"
                          )
                        }
                      >
                        {copiedField === "mcp-config" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <h4 className="text-sm font-semibold mt-4">2. SSE 端点</h4>
                    <div className="relative">
                      <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto">
{`${getApiBaseUrl()}/mcp/sse?project_id=${currentProject.id}&agent_id=${guideAgent.agent_id}`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() =>
                          copyToClipboard(
                            `${getApiBaseUrl()}/mcp/sse?project_id=${currentProject.id}&agent_id=${guideAgent.agent_id}`,
                            "mcp-sse"
                          )
                        }
                      >
                        {copiedField === "mcp-sse" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300">
                      <strong>提示:</strong> MCP (Model Context Protocol) 允许 AI Agent 通过标准化协议直接访问 MemVault 的记忆存储和检索能力。
                      配置后，Agent 可以自动读取和写入记忆。MCP 方式无需 API Key。
                    </div>
                  </div>
                </TabsContent>

                {/* REST API 接入 */}
                <TabsContent value="rest" className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">1. 添加记忆</h4>
                    <div className="relative">
                      <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto">
{`curl -X POST "${getApiBaseUrl()}/api/v1/memories?project_id=${currentProject.id}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "用户消息"},
      {"role": "assistant", "content": "助手回复"}
    ],
    "agent_id": "${guideAgent.agent_id}",
    "user_id": "user-123"
  }'`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() =>
                          copyToClipboard(
                            `curl -X POST "${getApiBaseUrl()}/api/v1/memories?project_id=${currentProject.id}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "messages": [\n      {"role": "user", "content": "用户消息"},\n      {"role": "assistant", "content": "助手回复"}\n    ],\n    "agent_id": "${guideAgent.agent_id}",\n    "user_id": "user-123"\n  }'`,
                            "rest-add"
                          )
                        }
                      >
                        {copiedField === "rest-add" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <h4 className="text-sm font-semibold">2. 搜索记忆</h4>
                    <div className="relative">
                      <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto">
{`curl -X POST "${getApiBaseUrl()}/api/v1/memories/search?project_id=${currentProject.id}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "搜索关键词",
    "agent_id": "${guideAgent.agent_id}",
    "limit": 10
  }'`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() =>
                          copyToClipboard(
                            `curl -X POST "${getApiBaseUrl()}/api/v1/memories/search?project_id=${currentProject.id}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "query": "搜索关键词",\n    "agent_id": "${guideAgent.agent_id}",\n    "limit": 10\n  }'`,
                            "rest-search"
                          )
                        }
                      >
                        {copiedField === "rest-search" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <h4 className="text-sm font-semibold">3. 获取全部记忆</h4>
                    <div className="relative">
                      <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto">
{`curl "${getApiBaseUrl()}/api/v1/memories?project_id=${currentProject.id}&agent_id=${guideAgent.agent_id}" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() =>
                          copyToClipboard(
                            `curl "${getApiBaseUrl()}/api/v1/memories?project_id=${currentProject.id}&agent_id=${guideAgent.agent_id}" \\\n  -H "Authorization: Bearer YOUR_API_KEY"`,
                            "rest-list"
                          )
                        }
                      >
                        {copiedField === "rest-list" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-300">
                      <strong>注意:</strong> 请将 <code>YOUR_API_KEY</code> 替换为在「设置 &rarr; API Key」页面中创建的 API Key。
                      API Key 拥有与创建者相同的项目访问权限。
                    </div>
                  </div>
                </TabsContent>

                {/* Webhook 接入 */}
                <TabsContent value="webhook" className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Webhook 回调配置</h4>
                    <p className="text-sm text-muted-foreground">
                      Webhook 允许 MemVault 在记忆发生变更时主动推送通知到你指定的 URL。
                    </p>

                    <h4 className="text-sm font-semibold mt-4">1. 注册 Webhook</h4>
                    <div className="relative">
                      <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto">
{`curl -X POST "${getApiBaseUrl()}/api/v1/webhooks?project_id=${currentProject.id}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhook/memvault",
    "events": ["memory.created", "memory.updated", "memory.deleted"]
  }'`}
                      </pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() =>
                          copyToClipboard(
                            `curl -X POST "${getApiBaseUrl()}/api/v1/webhooks?project_id=${currentProject.id}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "url": "https://your-server.com/webhook/memvault",\n    "events": ["memory.created", "memory.updated", "memory.deleted"]\n  }'`,
                            "webhook-register"
                          )
                        }
                      >
                        {copiedField === "webhook-register" ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <h4 className="text-sm font-semibold mt-4">2. Webhook 载荷格式</h4>
                    <p className="text-sm text-muted-foreground">
                      当事件触发时，MemVault 会向你配置的 URL 发送 POST 请求，载荷格式如下:
                    </p>
                    <pre className="rounded-md border bg-muted/50 p-4 text-xs overflow-auto">
{`{
  "event": "memory.created",
  "timestamp": "2026-02-15T10:00:00Z",
  "project_id": "${currentProject.id}",
  "data": {
    "memory_id": "mem-xxx",
    "content": "记忆内容",
    "agent_id": "${guideAgent.agent_id}",
    "user_id": "user-123",
    "memory_type": "semantic"
  }
}`}
                    </pre>

                    <h4 className="text-sm font-semibold mt-4">3. 支持的事件类型</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="rounded-md border p-2">
                        <Badge variant="secondary" className="text-xs">memory.created</Badge>
                        <p className="text-xs text-muted-foreground mt-1">新记忆创建时触发</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <Badge variant="secondary" className="text-xs">memory.updated</Badge>
                        <p className="text-xs text-muted-foreground mt-1">记忆内容更新时触发</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <Badge variant="secondary" className="text-xs">memory.deleted</Badge>
                        <p className="text-xs text-muted-foreground mt-1">记忆被删除时触发</p>
                      </div>
                    </div>

                    <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-xs text-green-700 dark:text-green-300">
                      <strong>提示:</strong> 你可以在「Webhook」管理页面中创建和管理 Webhook，
                      也可以使用测试功能验证你的回调端点是否正常工作。
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGuideDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
