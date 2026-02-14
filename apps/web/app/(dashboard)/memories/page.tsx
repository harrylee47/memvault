"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate, truncate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import {
  Plus,
  Search,
  Trash2,
  Eye,
  Pencil,
  RefreshCw,
  Download,
  Upload,
  ArrowUpDown,
  Filter,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Memory {
  id: string;
  mem0_memory_id: string | null;
  content: string;
  user_id: string | null;
  agent_id: string | null;
  memory_type: string;
  state: string;
  metadata?: Record<string, any>;
  source_app?: string;
  created_at: string;
  updated_at: string;
}

interface MemoryHistoryEntry {
  id: string;
  memory_id: string;
  old_content: string;
  new_content: string;
  action: string;
  created_at: string;
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
  const [memoryHistory, setMemoryHistory] = useState<MemoryHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 基础过滤
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAgentId, setFilterAgentId] = useState("");

  // 高级过滤
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterMemoryType, setFilterMemoryType] = useState<string>("all");
  const [filterSourceApp, setFilterSourceApp] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");

  // 排序控制
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<string>("desc");

  // 导入对话框
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出
  const [exportLoading, setExportLoading] = useState(false);

  const loadMemories = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const params: Record<string, any> = { page: String(page), page_size: "20" };
      if (filterUserId) params.user_id = filterUserId;
      if (filterAgentId) params.agent_id = filterAgentId;
      if (filterMemoryType && filterMemoryType !== "all") params.memory_type = filterMemoryType;
      if (filterSourceApp) params.source_app = filterSourceApp;
      if (filterKeyword) params.keyword = filterKeyword;
      if (sortBy) params.sort_by = sortBy;
      if (sortOrder) params.sort_order = sortOrder;
      const data = await api.getMemories(currentProject.id, params);
      setMemories(data.memories);
      setTotal(data.total);
    } catch (err: any) {
      toast({ title: "加载失败", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentProject, page, filterUserId, filterAgentId, filterMemoryType, filterSourceApp, filterKeyword, sortBy, sortOrder]);

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

  const openDetail = async (memory: Memory) => {
    setSelectedMemory(memory);
    setEditContent(memory.content);
    setIsEditing(false);
    setShowDetailDialog(true);
    setMemoryHistory([]);

    // 加载历史记录
    if (currentProject) {
      setHistoryLoading(true);
      try {
        const data = await api.getMemoryHistory(currentProject.id, memory.id);
        setMemoryHistory(Array.isArray(data) ? data : data.history || []);
      } catch (err) {
        // 历史记录加载失败不影响详情显示
        console.error("Failed to load memory history:", err);
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  // 导出记忆
  const handleExport = async () => {
    if (!currentProject) return;
    setExportLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/memories/export?project_id=${currentProject.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({ format: "json" }),
        }
      );
      if (!res.ok) throw new Error("导出失败");
      const data = await res.json();

      // 下载为 JSON 文件
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memvault-export-${currentProject.slug || currentProject.id}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "导出成功" });
    } catch (err: any) {
      toast({ title: "导出失败", description: err.message, variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  // 导入记忆
  const handleImport = async () => {
    if (!currentProject || !importJson.trim()) return;
    setImportLoading(true);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(importJson);
      } catch {
        toast({ title: "JSON 格式错误", description: "请输入有效的 JSON", variant: "destructive" });
        setImportLoading(false);
        return;
      }

      const token = localStorage.getItem("access_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/memories/import?project_id=${currentProject.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify(parsed),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "导入失败" }));
        throw new Error(errData.detail || "导入失败");
      }

      toast({ title: "导入成功" });
      setShowImportDialog(false);
      setImportJson("");
      loadMemories();
    } catch (err: any) {
      toast({ title: "导入失败", description: err.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setImportJson(text);
    };
    reader.readAsText(file);
    // 重置 input 以便可以再次选择同一文件
    e.target.value = "";
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exportLoading}>
            <Download className="mr-2 h-4 w-4" />
            {exportLoading ? "导出中..." : "导出"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            导入
          </Button>
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
          {/* 搜索栏 */}
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

          {/* 基础过滤 */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              className="ml-auto"
            >
              <Filter className="mr-2 h-4 w-4" />
              高级过滤
              {showAdvancedFilter ? (
                <ChevronUp className="ml-1 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-1 h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 高级过滤 */}
          {showAdvancedFilter && (
            <div className="mt-3 rounded-md border p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 记忆类型 */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">记忆类型</label>
                  <Select value={filterMemoryType} onValueChange={(val) => { setFilterMemoryType(val); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部类型</SelectItem>
                      <SelectItem value="semantic">Semantic</SelectItem>
                      <SelectItem value="episodic">Episodic</SelectItem>
                      <SelectItem value="procedural">Procedural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 来源应用 */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">来源应用</label>
                  <Input
                    placeholder="例如: claude, chatgpt"
                    value={filterSourceApp}
                    onChange={(e) => { setFilterSourceApp(e.target.value); setPage(1); }}
                  />
                </div>

                {/* 关键字搜索 */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">关键字</label>
                  <Input
                    placeholder="内容关键字过滤"
                    value={filterKeyword}
                    onChange={(e) => { setFilterKeyword(e.target.value); setPage(1); }}
                  />
                </div>

                {/* 排序 */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">排序</label>
                  <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_at">创建时间</SelectItem>
                        <SelectItem value="updated_at">更新时间</SelectItem>
                        <SelectItem value="content">内容</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      title={sortOrder === "asc" ? "升序" : "降序"}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    当前: {sortOrder === "asc" ? "升序" : "降序"}
                  </span>
                </div>
              </div>

              {/* 重置过滤 */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterMemoryType("all");
                    setFilterSourceApp("");
                    setFilterKeyword("");
                    setSortBy("created_at");
                    setSortOrder("desc");
                    setFilterUserId("");
                    setFilterAgentId("");
                    setPage(1);
                  }}
                >
                  重置全部过滤
                </Button>
              </div>
            </div>
          )}
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
                          {memory.source_app && (
                            <Badge variant="secondary" className="text-[10px]">
                              {memory.source_app}
                            </Badge>
                          )}
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

      {/* 记忆详情对话框 - 增强版含历史记录 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>记忆详情</DialogTitle>
          </DialogHeader>
          {selectedMemory && (
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">内容</TabsTrigger>
                <TabsTrigger value="metadata">元数据</TabsTrigger>
                <TabsTrigger value="history">
                  <History className="mr-1 h-3 w-3" />
                  历史记录
                </TabsTrigger>
              </TabsList>

              {/* 内容标签 */}
              <TabsContent value="content" className="space-y-4">
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
                <div className="flex justify-end gap-2">
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
                </div>
              </TabsContent>

              {/* 元数据标签 */}
              <TabsContent value="metadata" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">ID: </span>
                    <span className="font-mono text-xs break-all">{selectedMemory.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mem0 ID: </span>
                    <span className="font-mono text-xs break-all">{selectedMemory.mem0_memory_id || "-"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">类型: </span>
                    <Badge variant="secondary">{selectedMemory.memory_type}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">状态: </span>
                    <Badge variant={selectedMemory.state === "active" ? "secondary" : "outline"}>
                      {selectedMemory.state}
                    </Badge>
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
                  {selectedMemory.source_app && (
                    <div>
                      <span className="text-muted-foreground">来源应用: </span>
                      <span>{selectedMemory.source_app}</span>
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
                {selectedMemory.metadata && Object.keys(selectedMemory.metadata).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">自定义元数据</h4>
                    <pre className="rounded-md border bg-muted/50 p-3 text-xs overflow-auto max-h-60">
                      {JSON.stringify(selectedMemory.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </TabsContent>

              {/* 历史记录标签 */}
              <TabsContent value="history" className="space-y-4">
                {historyLoading ? (
                  <div className="py-4 text-center text-muted-foreground">加载历史记录中...</div>
                ) : memoryHistory.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">暂无历史记录</div>
                ) : (
                  <div className="space-y-3">
                    {memoryHistory.map((entry, idx) => (
                      <div key={entry.id || idx} className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={entry.action === "create" ? "secondary" : "outline"}>
                            {entry.action === "create"
                              ? "创建"
                              : entry.action === "update"
                              ? "更新"
                              : entry.action === "delete"
                              ? "删除"
                              : entry.action}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                        {entry.old_content && (
                          <div className="mb-1">
                            <span className="text-xs text-muted-foreground">旧内容: </span>
                            <p className="text-xs line-through text-muted-foreground">
                              {truncate(entry.old_content, 200)}
                            </p>
                          </div>
                        )}
                        {entry.new_content && (
                          <div>
                            <span className="text-xs text-muted-foreground">新内容: </span>
                            <p className="text-xs">{truncate(entry.new_content, 200)}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>导入记忆</DialogTitle>
            <DialogDescription>
              粘贴 JSON 数据或上传 JSON 文件来导入记忆
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                选择 JSON 文件
              </Button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">或粘贴 JSON</span>
              </div>
            </div>
            <Textarea
              placeholder='{"memories": [{"content": "记忆内容", "user_id": "user1"}]}'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportJson(""); }}>
              取消
            </Button>
            <Button onClick={handleImport} disabled={importLoading || !importJson.trim()}>
              {importLoading ? "导入中..." : "导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
