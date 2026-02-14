"use client";

import { useState, useEffect } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate, generateSlug, validateSlug } from "@/lib/utils";
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
import { Plus, FolderKanban, Pencil, Trash2 } from "lucide-react";

export default function ProjectsPage() {
  const { currentOrg, projects, currentProject, setCurrentProject, loadOrgsAndProjects } = useProjectStore();

  // 创建对话框
  const [showDialog, setShowDialog] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  // 编辑对话框
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // 删除状态
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Slug 校验状态
  const slugValid = slug.length === 0 || validateSlug(slug);
  const canCreate = !!name && !!slug && validateSlug(slug) && !creating;

  // 输入名称时自动生成 slug（仅在用户未手动修改 slug 时）
  useEffect(() => {
    if (!slugTouched && name) {
      setSlug(generateSlug(name));
    }
  }, [name, slugTouched]);

  const handleCreate = async () => {
    if (!currentOrg || !canCreate) return;
    setCreating(true);
    try {
      await api.createProject(currentOrg.id, { name, slug });
      toast({ title: "项目已创建" });
      setShowDialog(false);
      setName("");
      setSlug("");
      setSlugTouched(false);
      loadOrgsAndProjects();
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditProject(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editProject || !editName) return;
    setSaving(true);
    try {
      await api.updateProject(editProject.id, {
        name: editName,
        description: editDescription || undefined,
      });
      toast({ title: "项目已更新" });
      setShowEditDialog(false);
      setEditProject(null);
      loadOrgsAndProjects();
    } catch (err: any) {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除项目「${project.name}」？此操作不可恢复。`)) return;
    setDeletingId(project.id);
    try {
      await api.deleteProject(project.id);
      toast({ title: "项目已删除" });
      if (currentProject?.id === project.id) {
        setCurrentProject(null);
      }
      loadOrgsAndProjects();
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">项目管理</h1>
          <p className="text-muted-foreground">管理组织下的项目</p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) {
            setName("");
            setSlug("");
            setSlugTouched(false);
          }
        }}>
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
                <Input
                  placeholder="my-project"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  className={slug && !slugValid ? "border-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  仅允许小写字母、数字和连字符，2-50 字符，如: my-project
                </p>
                {slug && !slugValid && (
                  <p className="text-xs text-destructive">
                    Slug 格式无效：仅允许小写字母、数字和连字符，不能以连字符开头或结尾
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={!canCreate}>
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
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base">{project.name}</CardTitle>
                <p className="text-xs text-muted-foreground">@{project.slug}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => openEditDialog(project, e)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  disabled={deletingId === project.id}
                  onClick={(e) => handleDelete(project, e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {project.description && (
                <p className="text-sm text-muted-foreground mb-2">{project.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>创建于 {formatDate(project.created_at)}</span>
                {currentProject?.id === project.id && <Badge variant="default">当前</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
            <DialogDescription>修改项目名称和描述（Slug 创建后不可修改）</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={editProject?.slug || ""} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">Slug 创建后不可修改</p>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                placeholder="项目描述（可选）"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleUpdate} disabled={saving || !editName}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
