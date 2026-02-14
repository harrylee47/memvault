"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_id: string | null;
  details: any;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  search: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  reset: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  export: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  import: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  test: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function AuditLogsPage() {
  const { currentProject } = useProjectStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const pageSize = 30;

  const fetchLogs = async () => {
    if (!currentProject) return;
    setLoading(true);
    const token = localStorage.getItem("access_token");
    const params = new URLSearchParams({
      project_id: currentProject.id,
      page: String(page),
      page_size: String(pageSize),
      days: "90",
    });
    if (actionFilter) params.set("action", actionFilter);
    if (resourceFilter) params.set("resource_type", resourceFilter);

    try {
      const res = await fetch(`/api/v1/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentProject, page, actionFilter, resourceFilter]);

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight dark:text-white">
          <ScrollText className="mr-2 inline h-8 w-8" />
          审计日志
        </h1>
        <p className="text-muted-foreground">查看项目操作日志（近 90 天）</p>
      </div>

      {/* 过滤器 */}
      <div className="flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="">全部操作</option>
          <option value="create">创建</option>
          <option value="update">更新</option>
          <option value="delete">删除</option>
          <option value="search">搜索</option>
          <option value="reset">重置</option>
          <option value="export">导出</option>
          <option value="import">导入</option>
        </select>
        <select
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
          className="rounded-md border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          <option value="">全部资源</option>
          <option value="memory">记忆</option>
          <option value="agent">Agent</option>
          <option value="webhook">Webhook</option>
          <option value="api_key">API Key</option>
          <option value="organization">组织</option>
        </select>
        <span className="flex items-center text-sm text-muted-foreground">
          共 {total} 条记录
        </span>
      </div>

      {/* 日志列表 */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              加载中...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              暂无审计日志
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <Badge
                    className={`${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800"} text-xs`}
                  >
                    {log.action}
                  </Badge>
                  <span className="text-sm font-medium dark:text-gray-200 min-w-[80px]">
                    {log.resource_type}
                  </span>
                  {log.resource_id && (
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                      {log.resource_id.slice(0, 8)}...
                    </span>
                  )}
                  <span className="flex-1 text-xs text-muted-foreground truncate">
                    {log.details ? JSON.stringify(log.details) : ""}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-md border p-2 disabled:opacity-30 hover:bg-accent dark:border-gray-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm dark:text-gray-300">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-md border p-2 disabled:opacity-30 hover:bg-accent dark:border-gray-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
