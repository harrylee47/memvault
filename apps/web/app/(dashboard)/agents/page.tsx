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
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { Plus, Bot, Trash2 } from "lucide-react";

export default function AgentsPage() {
  const { currentProject } = useProjectStore();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentType, setAgentType] = useState("api");
  const [creating, setCreating] = useState(false);

  const loadAgents = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await api.getAgents(currentProject.id);
      setAgents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, [currentProject]);

  const handleCreate = async () => {
    if (!currentProject || !name || !agentId) return;
    setCreating(true);
    try {
      await api.createAgent(currentProject.id, { name, agent_id: agentId, agent_type: agentType });
      toast({ title: "Agent 已创建" });
      setShowDialog(false);
      setName("");
      setAgentId("");
      loadAgents();
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent 管理</h1>
          <p className="text-muted-foreground">管理已连接的 AI Agent</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
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
                <Input placeholder="例如: My Claude Agent" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Agent ID</Label>
                <Input placeholder="唯一标识符" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={agentType} onValueChange={setAgentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">REST API</SelectItem>
                    <SelectItem value="mcp">MCP</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={creating || !name || !agentId}>
                {creating ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">加载中...</div>
        ) : agents.length === 0 ? (
          <div className="col-span-full py-8 text-center text-muted-foreground">
            暂无 Agent，点击"添加 Agent"开始
          </div>
        ) : (
          agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <Bot className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">{agent.agent_id}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{agent.agent_type.toUpperCase()}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(agent.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
