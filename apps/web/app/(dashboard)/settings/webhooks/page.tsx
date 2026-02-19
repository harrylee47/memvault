"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { toast } from "@/components/ui/toaster";
import {
  Plus,
  Trash2,
  Webhook,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Settings2,
} from "lucide-react";

const AVAILABLE_EVENTS = [
  { value: "*", label: "所有事件" },
  { value: "memory.created", label: "memory.created" },
  { value: "memory.updated", label: "memory.updated" },
  { value: "memory.deleted", label: "memory.deleted" },
];

const WEBHOOK_FORMATS = [
  { value: "generic", label: "通用 (Generic)", description: "标准 JSON 格式，含签名验证" },
  { value: "wecom", label: "企业微信", description: "企业微信群机器人 Webhook" },
  { value: "dingtalk", label: "钉钉", description: "钉钉群机器人 Webhook" },
  { value: "feishu", label: "飞书", description: "飞书群机器人 Webhook" },
  { value: "slack", label: "Slack", description: "Slack Incoming Webhook" },
];

export default function WebhooksPage() {
  const { currentProject } = useProjectStore();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [url, setUrl] = useState("");
  const [webhookFormat, setWebhookFormat] = useState("generic");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["*"]);
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    statusCode?: number;
    message?: string;
  } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingEventsId, setEditingEventsId] = useState<string | null>(null);
  const [editEvents, setEditEvents] = useState<string[]>([]);

  const loadWebhooks = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await api.getWebhooks(currentProject.id);
      setWebhooks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, [currentProject]);

  const handleCreate = async () => {
    if (!currentProject || !url) return;
    setCreating(true);
    try {
      await api.createWebhook(currentProject.id, { url, format: webhookFormat, events: selectedEvents });
      toast({ title: "Webhook 已创建" });
      setShowDialog(false);
      setUrl("");
      setWebhookFormat("generic");
      setSelectedEvents(["*"]);
      loadWebhooks();
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个 Webhook？")) return;
    try {
      await api.deleteWebhook(id);
      toast({ title: "删除成功" });
      loadWebhooks();
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  const handleTest = async (id: string) => {
    if (!currentProject) return;
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await api.testWebhook(id, currentProject.id);
      setTestResult({
        id,
        success: true,
        statusCode: result.status_code || 200,
        message: "测试请求发送成功",
      });
      toast({ title: "测试成功", description: `状态码: ${result.status_code || 200}` });
    } catch (err: any) {
      setTestResult({
        id,
        success: false,
        message: err.message || "测试失败",
      });
      toast({ title: "测试失败", description: err.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (wh: any) => {
    if (!currentProject) return;
    setTogglingId(wh.id);
    try {
      await api.updateWebhook(wh.id, currentProject.id, {
        is_active: !wh.is_active,
      });
      toast({ title: wh.is_active ? "已禁用" : "已启用" });
      setWebhooks((prev) =>
        prev.map((w) =>
          w.id === wh.id ? { ...w, is_active: !w.is_active } : w
        )
      );
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const handleEventToggle = (event: string) => {
    setEditEvents((prev) => {
      if (event === "*") {
        return prev.includes("*") ? [] : ["*"];
      }
      const withoutAll = prev.filter((e) => e !== "*");
      if (withoutAll.includes(event)) {
        return withoutAll.filter((e) => e !== event);
      }
      return [...withoutAll, event];
    });
  };

  const handleCreateEventToggle = (event: string) => {
    setSelectedEvents((prev) => {
      if (event === "*") {
        return prev.includes("*") ? [] : ["*"];
      }
      const withoutAll = prev.filter((e) => e !== "*");
      if (withoutAll.includes(event)) {
        return withoutAll.filter((e) => e !== event);
      }
      return [...withoutAll, event];
    });
  };

  const handleSaveEvents = async (webhookId: string) => {
    if (!currentProject) return;
    try {
      await api.updateWebhook(webhookId, currentProject.id, { events: editEvents });
      toast({ title: "事件已更新" });
      setWebhooks((prev) =>
        prev.map((w) =>
          w.id === webhookId ? { ...w, events: editEvents } : w
        )
      );
      setEditingEventsId(null);
    } catch (err: any) {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    }
  };

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhook 管理</h1>
          <p className="text-muted-foreground">配置记忆变更通知</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              创建 Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建 Webhook</DialogTitle>
              <DialogDescription>当记忆发生变更时发送通知</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>消息格式</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEBHOOK_FORMATS.map((fmt) => (
                    <label
                      key={fmt.value}
                      className={`flex flex-col rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                        webhookFormat === fmt.value ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="webhook-format"
                          value={fmt.value}
                          checked={webhookFormat === fmt.value}
                          onChange={(e) => setWebhookFormat(e.target.value)}
                          className="accent-primary"
                        />
                        <span className="text-sm font-medium">{fmt.label}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground ml-5">{fmt.description}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  placeholder="https://your-server.com/webhook"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>监听事件</Label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.value}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.value)}
                        onChange={() => handleCreateEventToggle(event.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                取消
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !url || selectedEvents.length === 0}
              >
                {creating ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : webhooks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">暂无 Webhook</div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="rounded-md border p-4 space-y-3"
                >
                  {/* 主行 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Webhook className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-mono text-sm flex items-center gap-2">
                          {wh.url}
                          <Badge variant="outline" className="text-[10px]">
                            {WEBHOOK_FORMATS.find((f) => f.value === wh.format)?.label || wh.format || "Generic"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {(Array.isArray(wh.events) ? wh.events : []).map(
                            (event: string) => (
                              <Badge
                                key={event}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {event}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 测试结果 */}
                      {testResult && testResult.id === wh.id && (
                        <div className="flex items-center gap-1 text-xs">
                          {testResult.success ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-green-600">
                                {testResult.statusCode}
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                              <span className="text-destructive">失败</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* 测试按钮 */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(wh.id)}
                        disabled={testingId === wh.id}
                      >
                        {testingId === wh.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-3.5 w-3.5" />
                        )}
                        测试
                      </Button>

                      {/* 启用/禁用切换 */}
                      <Button
                        variant={wh.is_active ? "default" : "secondary"}
                        size="sm"
                        onClick={() => handleToggleActive(wh)}
                        disabled={togglingId === wh.id}
                      >
                        {togglingId === wh.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {wh.is_active ? "已启用" : "已禁用"}
                      </Button>

                      {/* 编辑事件按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (editingEventsId === wh.id) {
                            setEditingEventsId(null);
                          } else {
                            setEditingEventsId(wh.id);
                            setEditEvents(
                              Array.isArray(wh.events) ? [...wh.events] : []
                            );
                          }
                        }}
                        title="编辑事件"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>

                      {/* 删除按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(wh.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* 编辑事件面板 */}
                  {editingEventsId === wh.id && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                      <div className="text-sm font-medium">编辑监听事件</div>
                      <div className="space-y-2">
                        {AVAILABLE_EVENTS.map((event) => (
                          <label
                            key={event.value}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={editEvents.includes(event.value)}
                              onChange={() => handleEventToggle(event.value)}
                              className="rounded"
                            />
                            <span className="text-sm">{event.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEvents(wh.id)}
                          disabled={editEvents.length === 0}
                        >
                          保存
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingEventsId(null)}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
