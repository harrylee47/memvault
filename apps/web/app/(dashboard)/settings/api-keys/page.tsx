"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
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
import { toast } from "@/components/ui/toaster";
import { Plus, Trash2, Copy, Key } from "lucide-react";

export default function ApiKeysPage() {
  const { currentProject } = useProjectStore();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadApiKeys = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const keys = await api.getApiKeys(currentProject.id);
      setApiKeys(keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, [currentProject]);

  const handleCreate = async () => {
    if (!currentProject || !newKeyName) return;
    setCreating(true);
    try {
      const result = await api.createApiKey(currentProject.id, { name: newKeyName });
      setCreatedKey(result.full_key);
      setNewKeyName("");
      loadApiKeys();
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("确定要删除这个 API Key？")) return;
    try {
      await api.deleteApiKey(keyId);
      toast({ title: "删除成功" });
      loadApiKeys();
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "已复制到剪贴板" });
  };

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Key 管理</h1>
          <p className="text-muted-foreground">管理项目的 API 访问密钥</p>
        </div>
        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) setCreatedKey(null);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              创建 API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{createdKey ? "API Key 已创建" : "创建 API Key"}</DialogTitle>
              <DialogDescription>
                {createdKey
                  ? "请立即复制此 Key，关闭后将无法再次查看"
                  : "为 Agent 或外部服务创建 API Key"}
              </DialogDescription>
            </DialogHeader>
            {createdKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input value={createdKey} readOnly className="font-mono text-sm" />
                  <Button size="icon" variant="outline" onClick={() => copyToClipboard(createdKey)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                  请妥善保管此 Key，关闭后将无法再次查看完整密钥。
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>名称</Label>
                  <Input
                    placeholder="例如: Claude Desktop"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              {createdKey ? (
                <Button onClick={() => { setShowCreateDialog(false); setCreatedKey(null); }}>
                  完成
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreate} disabled={creating || !newKeyName}>
                    {creating ? "创建中..." : "创建"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : apiKeys.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              暂无 API Key，点击"创建 API Key"开始
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between rounded-md border p-4">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{key.name}</div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-mono">{key.key_prefix}...</span>
                        <span className="mx-2">·</span>
                        创建于 {formatDate(key.created_at)}
                        {key.last_used_at && (
                          <>
                            <span className="mx-2">·</span>
                            最后使用 {formatDate(key.last_used_at)}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={key.is_active ? "default" : "secondary"}>
                      {key.is_active ? "活跃" : "已禁用"}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(key.id)}>
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
