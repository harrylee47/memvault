"use client";

import { useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate, truncate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Search, Trash2, Eye, Pencil, RefreshCw } from "lucide-react";

interface Memory {
  id: string;
  mem0_memory_id: string | null;
  content: string;
  user_id: string | null;
  agent_id: string | null;
  memory_type: string;
  state: string;
  created_at: string;
  updated_at: string;
}

export default function MemoriesPage() {
  const { currentProject } = useProjectStore();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // 添加记忆对话框
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // 查看/编辑记忆对话框
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // 过滤
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAgentId, setFilterAgentId] = useState("");

  const loadMemories = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const params: Record<string, any> = { page: String(page), page_size: "20" };
      if (filterUserId) params.user_id = filterUserId;
      if (filterAgentId) params.agent_id = filterAgentId;
      const data = await api.getMemories(currentProject.id, params);
      setMemories(data.memories);
      setTotal(data.total);
    } catch (err: any) {
      toast({ title: "加载失败", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentProject, page, filterUserId, filterAgentId]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleAdd = async () => {
    if (!currentProject || !newContent) return;
    setAddLoading(true);
    try {
      await api.addMemory(currentProject.id, {
        messages: [{ role: "user", content: newContent }],
        user_id: newUserId || undefined,
      });
      toast({ title: "添加成功" });
      setShowAddDialog(false);
      setNewContent("");
      setNewUserId("");
      loadMemories();
    } catch (err: any) {
      toast({ title: "添加失败", description: err.message, variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!currentProject || !searchQuery) return;
    setIsSearching(true);
    try {
      const data = await api.searchMemories(currentProject.id, { query: searchQuery, limit: 20 });
      setSearchResults(data.results);
      setShowSearch(true);
    } catch (err: any) {
      toast({ title: "搜索失败", description: err.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async (memoryId: string) => {
    if (!currentProject || !confirm("确定要删除这条记忆？")) return;
    try {
      await api.deleteMemory(currentProject.id, memoryId);
      toast({ title: "删除成功" });
      loadMemories();
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!currentProject || !selectedMemory) return;
    try {
      await api.updateMemory(currentProject.id, selectedMemory.id, editContent);
      toast({ title: "更新成功" });
      setIsEditing(false);
      setShowDetailDialog(false);
      loadMemories();
    } catch (err: any) {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    }
  };

  const openDetail = (memory: Memory) => {
    setSelectedMemory(memory);
    setEditContent(memory.content);
    setIsEditing(false);
    setShowDetailDialog(true);
  };

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">记忆管理</h1>
          <p className="text-muted-foreground">共 {total} 条记忆</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadMemories}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                添加记忆
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加记忆</DialogTitle>
                <DialogDescription>输入内容来创建新的记忆</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="记忆内容..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={4}
                />
                <Input
                  placeholder="User ID (可选)"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleAdd} disabled={addLoading || !newContent}>
                  {addLoading ? "添加中..." : "添加"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              <Search className="mr-2 h-4 w-4" />
              {isSearching ? "搜索中..." : "搜索"}
            </Button>
            {showSearch && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowSearch(false);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
              >
                清除搜索
              </Button>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="过滤 User ID"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="过滤 Agent ID"
              value={filterAgentId}
              onChange={(e) => setFilterAgentId(e.target.value)}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* 搜索结果 */}
      {showSearch && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">搜索结果 ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-muted-foreground">没有找到相关记忆</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-start justify-between rounded-md border p-3">
                    <div className="flex-1">
                      <p className="text-sm">{result.memory}</p>
                      <div className="mt-1 flex gap-2">
                        {result.score != null && (
                          <Badge variant="secondary">相似度: {(result.score * 100).toFixed(1)}%</Badge>
                        )}
                        {result.user_id && <Badge variant="outline">User: {result.user_id}</Badge>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 记忆列表 */}
      {!showSearch && (
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">加载中...</div>
            ) : memories.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                暂无记忆，点击"添加记忆"创建第一条
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetail(memory)}>
                        <p className="text-sm">{truncate(memory.content, 120)}</p>
                        <div className="mt-1 flex gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {memory.memory_type}
                          </Badge>
                          {memory.user_id && (
                            <Badge variant="outline" className="text-[10px]">
                              User: {memory.user_id}
                            </Badge>
                          )}
                          {memory.agent_id && (
                            <Badge variant="outline" className="text-[10px]">
                              Agent: {memory.agent_id}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(memory.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(memory)} title="查看">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(memory.id)}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      上一页
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 记忆详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>记忆详情</DialogTitle>
          </DialogHeader>
          {selectedMemory && (
            <div className="space-y-4">
              {isEditing ? (
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={6}
                />
              ) : (
                <div className="rounded-md border p-4">
                  <p className="whitespace-pre-wrap text-sm">{selectedMemory.content}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">ID: </span>
                  <span className="font-mono text-xs">{selectedMemory.id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">类型: </span>
                  <Badge variant="secondary">{selectedMemory.memory_type}</Badge>
                </div>
                {selectedMemory.user_id && (
                  <div>
                    <span className="text-muted-foreground">User ID: </span>
                    <span>{selectedMemory.user_id}</span>
                  </div>
                )}
                {selectedMemory.agent_id && (
                  <div>
                    <span className="text-muted-foreground">Agent ID: </span>
                    <span>{selectedMemory.agent_id}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">创建时间: </span>
                  <span>{formatDate(selectedMemory.created_at)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">更新时间: </span>
                  <span>{formatDate(selectedMemory.updated_at)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  取消
                </Button>
                <Button onClick={handleUpdate}>保存</Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(selectedMemory?.content || "");
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                编辑
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
