"use client";

import { useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  SlidersHorizontal,
  PlusCircle,
  Search,
  List,
  LayoutGrid,
  Info,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface RequestItem {
  id: string;
  method: string;
  endpoint: string;
  status_code: number;
  has_results: boolean;
  agent_id: string | null;
  user_id: string | null;
  duration_ms: number | null;
  request_body: any;
  response_summary: any;
  created_at: string;
}

interface RequestStats {
  total: number;
  by_method: Record<string, number>;
  with_results: number;
}

const METHOD_ICONS: Record<string, any> = {
  ADD: PlusCircle,
  SEARCH: Search,
  GET_ALL: List,
};

const METHOD_COLORS: Record<string, string> = {
  ADD: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  SEARCH: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  GET_ALL: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function RequestsPage() {
  const { currentProject } = useProjectStore();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30");
  const [showFilters, setShowFilters] = useState(false);
  const [filterHasResults, setFilterHasResults] = useState<string>("all");

  const loadData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const days = parseInt(dateRange);
      const params: Record<string, any> = { days: String(days), page_size: "100" };

      if (activeTab !== "overview" && activeTab !== "all") {
        params.method = activeTab.toUpperCase();
      }
      if (filterHasResults === "yes") params.has_results = "true";
      if (filterHasResults === "no") params.has_results = "false";

      const [reqData, statsData] = await Promise.allSettled([
        api.getRequests(currentProject.id, params),
        api.getRequestStats(currentProject.id, days),
      ]);

      if (reqData.status === "fulfilled") {
        setRequests(reqData.value.requests || []);
      }
      if (statsData.status === "fulfilled") {
        setStats(statsData.value);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentProject, dateRange, activeTab, filterHasResults]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!currentProject) {
    return <div className="text-muted-foreground">请先选择一个项目</div>;
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Requests</h1>
          <p className="text-muted-foreground">监控项目的 API 请求记录</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 日期范围 */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1d</SelectItem>
              <SelectItem value="7">7d</SelectItem>
              <SelectItem value="30">30d</SelectItem>
              <SelectItem value="90">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* 过滤器面板 */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Has Results</label>
                <Select value={filterHasResults} onValueChange={setFilterHasResults}>
                  <SelectTrigger className="w-[120px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="yes">有结果</SelectItem>
                    <SelectItem value="no">无结果</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1">
            <LayoutGrid className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="add" className="gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            ADD
            {stats?.by_method?.ADD ? (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {stats.by_method.ADD}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1">
            <Search className="h-3.5 w-3.5" />
            SEARCH
            {stats?.by_method?.SEARCH ? (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {stats.by_method.SEARCH}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            <List className="h-3.5 w-3.5" />
            GET ALL
            {stats?.by_method?.GET_ALL ? (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {stats.by_method.GET_ALL}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-sm text-muted-foreground">总请求数</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.with_results}</div>
                  <p className="text-sm text-muted-foreground">有结果的请求</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {stats.total > 0
                      ? Math.round((stats.with_results / stats.total) * 100)
                      : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">命中率</p>
                </CardContent>
              </Card>
            </div>
          )}
          {renderRequestList(requests, loading)}
        </TabsContent>

        {/* ADD Tab */}
        <TabsContent value="add">
          {renderRequestList(requests, loading)}
        </TabsContent>

        {/* SEARCH Tab */}
        <TabsContent value="search">
          {renderRequestList(requests, loading)}
        </TabsContent>

        {/* GET ALL Tab */}
        <TabsContent value="all">
          {renderRequestList(requests, loading)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function renderRequestList(requests: RequestItem[], loading: boolean) {
  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">加载中...</div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Info className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No requests found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          通过 API 或 MCP 接入后，请求记录将显示在此处。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 表头 */}
      <div className="grid grid-cols-[100px_1fr_100px_100px_80px_160px] gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
        <div>Method</div>
        <div>Endpoint</div>
        <div>Status</div>
        <div>Results</div>
        <div>Duration</div>
        <div>Time</div>
      </div>
      {requests.map((req) => {
        const MethodIcon = METHOD_ICONS[req.method] || Info;
        const colorClass = METHOD_COLORS[req.method] || "bg-gray-100 text-gray-800";
        return (
          <div
            key={req.id}
            className="grid grid-cols-[100px_1fr_100px_100px_80px_160px] items-center gap-4 rounded-md px-4 py-2.5 hover:bg-muted/50 text-sm"
          >
            <div>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                <MethodIcon className="h-3 w-3" />
                {req.method}
              </span>
            </div>
            <div className="font-mono text-xs truncate text-muted-foreground">
              {req.endpoint}
            </div>
            <div>
              <Badge variant={req.status_code < 400 ? "secondary" : "destructive"} className="text-xs">
                {req.status_code}
              </Badge>
            </div>
            <div>
              {req.has_results ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {req.duration_ms != null ? `${req.duration_ms}ms` : "-"}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDate(req.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
