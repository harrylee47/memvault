"use client";

import { useState } from "react";
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
import { toast } from "@/components/ui/toaster";
import { Plus, FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  const { currentOrg, projects, currentProject, setCurrentProject, loadOrgsAndProjects } = useProjectStore();
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!currentOrg || !name || !slug) return;
    setCreating(true);
    try {
      await api.createProject(currentOrg.id, { name, slug });
      toast({ title: "项目已创建" });
      setShowDialog(false);
      setName("");
      setSlug("");
      loadOrgsAndProjects();
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目管理</h1>
          <p className="text-muted-foreground">管理组织下的项目</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />创建项目</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建项目</DialogTitle>
              <DialogDescription>在当前组织下创建新项目</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>项目名称</Label>
                <Input placeholder="My Project" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input placeholder="my-project" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={creating || !name || !slug}>
                {creating ? "创建中..." : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`cursor-pointer transition-colors ${
              currentProject?.id === project.id ? "border-primary" : "hover:border-primary/50"
            }`}
            onClick={() => setCurrentProject(project)}
          >
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <FolderKanban className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-base">{project.name}</CardTitle>
                <p className="text-xs text-muted-foreground">@{project.slug}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>创建于 {formatDate(project.created_at)}</span>
                {currentProject?.id === project.id && <Badge variant="default">当前</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
