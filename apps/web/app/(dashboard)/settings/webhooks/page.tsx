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
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { Plus, Trash2, Webhook } from "lucide-react";

export default function WebhooksPage() {
  const { currentProject } = useProjectStore();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);

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
      await api.createWebhook(currentProject.id, { url });
      toast({ title: "Webhook 已创建" });
      setShowDialog(false);
      setUrl("");
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
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />创建 Webhook</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建 Webhook</DialogTitle>
              <DialogDescription>当记忆发生变更时发送通知</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL</Label>
                <Input placeholder="https://your-server.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={creating || !url}>
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
                <div key={wh.id} className="flex items-center justify-between rounded-md border p-4">
                  <div className="flex items-center gap-3">
                    <Webhook className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-mono text-sm">{wh.url}</div>
                      <div className="mt-1 flex gap-1">
                        {(Array.isArray(wh.events) ? wh.events : []).map((event: string) => (
                          <Badge key={event} variant="secondary" className="text-[10px]">{event}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={wh.is_active ? "default" : "secondary"}>
                      {wh.is_active ? "活跃" : "禁用"}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(wh.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
