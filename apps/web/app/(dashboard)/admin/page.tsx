"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  Users,
  Building2,
  Brain,
  Bot,
  ArrowUpRight,
  FolderKanban,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
} from "lucide-react";

interface AdminStats {
  users: number;
  organizations: number;
  projects: number;
  memories: number;
  agents: number;
  requests: number;
  orgs_by_plan: Record<string, number>;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  provider: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  member_count: number;
  project_count: number;
  created_at: string;
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, orgsData] = await Promise.allSettled([
        api.adminGetStats(),
        api.adminGetUsers(),
        api.adminGetOrganizations(),
      ]);

      if (statsData.status === "fulfilled") setStats(statsData.value);
      if (usersData.status === "fulfilled") setUsers(usersData.value.users || []);
      if (orgsData.status === "fulfilled") setOrgs(orgsData.value.organizations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    try {
      const data = await api.adminGetUsers(userSearch ? { search: userSearch } : {});
      setUsers(data.users || []);
    } catch (err: any) {
      toast({ title: "搜索失败", description: err.message, variant: "destructive" });
    }
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    setUpdatingUser(userId);
    try {
      await api.adminUpdateUser(userId, { is_active: !isActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !isActive } : u))
      );
      toast({ title: isActive ? "用户已禁用" : "用户已启用" });
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingUser(null);
    }
  };

  const toggleUserAdmin = async (userId: string, isAdmin: boolean) => {
    setUpdatingUser(userId);
    try {
      await api.adminUpdateUser(userId, { is_admin: !isAdmin });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: !isAdmin } : u))
      );
      toast({ title: isAdmin ? "已移除管理员权限" : "已授予管理员权限" });
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingUser(null);
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldOff className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">无权访问</h2>
        <p className="text-muted-foreground mt-1">此页面仅限系统管理员访问</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">系统管理</h1>
        <p className="text-muted-foreground">管理平台用户、组织和系统配置</p>
      </div>

      {/* 统计概览 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">用户</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.users}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">组织</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.organizations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">项目</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.projects}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">记忆</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.memories}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Agent</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.agents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">请求</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.requests}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="mr-1 h-4 w-4" />
            用户管理
          </TabsTrigger>
          <TabsTrigger value="orgs">
            <Building2 className="mr-1 h-4 w-4" />
            组织管理
          </TabsTrigger>
        </TabsList>

        {/* 用户管理 */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="搜索用户（邮箱或姓名）..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={searchUsers}>
              <Search className="mr-1 h-4 w-4" />
              搜索
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_100px_80px_80px_140px_120px] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>姓名</div>
                  <div>邮箱</div>
                  <div>来源</div>
                  <div>状态</div>
                  <div>管理员</div>
                  <div>注册时间</div>
                  <div>操作</div>
                </div>
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-[1fr_1fr_100px_80px_80px_140px_120px] items-center gap-3 rounded-md px-4 py-2 hover:bg-muted/50 text-sm"
                  >
                    <div className="font-medium truncate">{u.name}</div>
                    <div className="text-muted-foreground truncate">{u.email}</div>
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        {u.provider}
                      </Badge>
                    </div>
                    <div>
                      <Badge variant={u.is_active ? "secondary" : "destructive"} className="text-[10px]">
                        {u.is_active ? "活跃" : "禁用"}
                      </Badge>
                    </div>
                    <div>
                      {u.is_admin && (
                        <Badge className="text-[10px]">Admin</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(u.created_at)}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={u.is_active ? "禁用用户" : "启用用户"}
                        disabled={updatingUser === u.id}
                        onClick={() => toggleUserActive(u.id, u.is_active)}
                      >
                        {u.is_active ? (
                          <UserX className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={u.is_admin ? "移除管理员" : "设为管理员"}
                        disabled={updatingUser === u.id || u.id === user?.id}
                        onClick={() => toggleUserAdmin(u.id, u.is_admin)}
                      >
                        {u.is_admin ? (
                          <ShieldOff className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 组织管理 */}
        <TabsContent value="orgs" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_120px_100px_80px_80px_140px] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>组织名称</div>
                  <div>Slug</div>
                  <div>计划</div>
                  <div>成员</div>
                  <div>项目</div>
                  <div>创建时间</div>
                </div>
                {orgs.map((org) => (
                  <div
                    key={org.id}
                    className="grid grid-cols-[1fr_120px_100px_80px_80px_140px] items-center gap-3 rounded-md px-4 py-2 hover:bg-muted/50 text-sm"
                  >
                    <div className="font-medium truncate">{org.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      @{org.slug}
                    </div>
                    <div>
                      <Badge
                        variant={
                          org.plan === "enterprise"
                            ? "default"
                            : org.plan === "pro"
                            ? "default"
                            : "secondary"
                        }
                        className="text-[10px] capitalize"
                      >
                        {org.plan}
                      </Badge>
                    </div>
                    <div className="text-center">{org.member_count}</div>
                    <div className="text-center">{org.project_count}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(org.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
