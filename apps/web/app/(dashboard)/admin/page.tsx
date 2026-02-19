"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { Switch } from "@/components/ui/switch";
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
  CreditCard,
  Ticket,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Eye,
  Power,
  PowerOff,
  KeyRound,
  Settings2,
  UserPlus,
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
  plan_expires_at?: string | null;
  plan_activated_at?: string | null;
  member_count: number;
  project_count: number;
  created_at: string;
}

interface PlanItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_label: string | null;
  limits: { memories: number; requests: number; projects: number };
  features: string[];
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RedemptionCodeItem {
  id: string;
  code: string;
  plan_id: string;
  plan_name: string | null;
  plan_slug: string | null;
  duration_days: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

interface RedemptionLogItem {
  id: string;
  code_id: string;
  org_id: string;
  user_id: string | null;
  plan_slug: string;
  duration_days: number;
  activated_at: string;
  expires_at: string;
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // Plan 管理
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    slug: "",
    description: "",
    price_label: "",
    limits: { memories: 10000, requests: 1000, projects: 1 },
    features: "",
    sort_order: 0,
    is_active: true,
  });

  // 兑换码管理
  const [codes, setCodes] = useState<RedemptionCodeItem[]>([]);
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [codeForm, setCodeForm] = useState({
    plan_id: "",
    duration_days: 30,
    count: 1,
    prefix: "MV",
    max_uses: 1,
    note: "",
  });
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [viewingLogs, setViewingLogs] = useState<RedemptionLogItem[]>([]);

  // 重置密码 Dialog
  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false);
  const [resetPwdUser, setResetPwdUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPwd, setResettingPwd] = useState(false);

  // 系统设置
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [togglingRegistration, setTogglingRegistration] = useState(false);

  // 创建用户 Dialog
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ email: "", name: "", password: "" });
  const [creatingUser, setCreatingUser] = useState(false);

  // 组织编辑 Dialog
  const [orgEditDialogOpen, setOrgEditDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<AdminOrg | null>(null);
  const [orgEditForm, setOrgEditForm] = useState({
    plan: "free",
    plan_expires_at: "",
  });
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, orgsData, plansData, codesData, settingsData] = await Promise.allSettled([
        api.adminGetStats(),
        api.adminGetUsers(),
        api.adminGetOrganizations(),
        api.adminGetPlans(),
        api.adminGetRedemptionCodes(),
        api.getSystemSettings(),
      ]);

      if (statsData.status === "fulfilled") setStats(statsData.value);
      if (usersData.status === "fulfilled") setUsers(usersData.value.users || []);
      if (orgsData.status === "fulfilled") setOrgs(orgsData.value.organizations || []);
      if (plansData.status === "fulfilled") setPlans(plansData.value || []);
      if (codesData.status === "fulfilled") setCodes(codesData.value.codes || []);
      if (settingsData.status === "fulfilled") {
        setRegistrationEnabled(settingsData.value.registration_enabled !== "false");
      }
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

  const handleDeleteUser = async (u: AdminUser) => {
    if (!confirm(`确定要删除用户「${u.name}」(${u.email})？此操作不可恢复，将同时删除该用户关联的组织成员关系。`)) return;
    try {
      await api.adminDeleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast({ title: "用户已删除" });
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  const openResetPwd = (u: AdminUser) => {
    setResetPwdUser(u);
    setNewPassword("");
    setResetPwdDialogOpen(true);
  };

  const handleResetPwd = async () => {
    if (!resetPwdUser || newPassword.length < 6) return;
    setResettingPwd(true);
    try {
      await api.adminResetPassword(resetPwdUser.id, newPassword);
      toast({ title: "密码已重置" });
      setResetPwdDialogOpen(false);
    } catch (err: any) {
      toast({ title: "重置失败", description: err.message, variant: "destructive" });
    } finally {
      setResettingPwd(false);
    }
  };

  // ---- 组织 Plan 编辑 ----
  const openOrgEdit = (org: AdminOrg) => {
    setEditingOrg(org);
    setOrgEditForm({
      plan: org.plan || "free",
      plan_expires_at: org.plan_expires_at
        ? new Date(org.plan_expires_at).toISOString().slice(0, 16)
        : "",
    });
    setOrgEditDialogOpen(true);
  };

  const handleSaveOrg = async () => {
    if (!editingOrg) return;
    setSavingOrg(true);
    try {
      await api.adminUpdateOrganization(editingOrg.id, {
        plan: orgEditForm.plan,
        plan_expires_at: orgEditForm.plan_expires_at
          ? new Date(orgEditForm.plan_expires_at).toISOString()
          : null,
      });
      toast({ title: "组织已更新" });
      setOrgEditDialogOpen(false);
      // 刷新组织列表
      const data = await api.adminGetOrganizations();
      setOrgs(data.organizations || []);
    } catch (err: any) {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    } finally {
      setSavingOrg(false);
    }
  };

  // ---- Plan 管理方法 ----
  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      slug: "",
      description: "",
      price_label: "",
      limits: { memories: 10000, requests: 1000, projects: 1 },
      features: "",
      sort_order: plans.length,
      is_active: true,
    });
    setPlanDialogOpen(true);
  };

  const openEditPlan = (plan: PlanItem) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price_label: plan.price_label || "",
      limits: plan.limits,
      features: (plan.features || []).join("\n"),
      sort_order: plan.sort_order,
      is_active: plan.is_active,
    });
    setPlanDialogOpen(true);
  };

  const savePlan = async () => {
    try {
      const payload = {
        name: planForm.name,
        slug: planForm.slug,
        description: planForm.description || null,
        price_label: planForm.price_label || null,
        limits: planForm.limits,
        features: planForm.features.split("\n").map((f) => f.trim()).filter(Boolean),
        sort_order: planForm.sort_order,
        is_active: planForm.is_active,
      };

      if (editingPlan) {
        await api.adminUpdatePlan(editingPlan.id, payload);
        toast({ title: "Plan 已更新" });
      } else {
        await api.adminCreatePlan(payload);
        toast({ title: "Plan 已创建" });
      }

      setPlanDialogOpen(false);
      const data = await api.adminGetPlans();
      setPlans(data || []);
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("确定要删除此 Plan 吗？")) return;
    try {
      await api.adminDeletePlan(planId);
      toast({ title: "Plan 已删除" });
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  // ---- 兑换码管理方法 ----
  const openCreateCodes = () => {
    setCodeForm({
      plan_id: plans.length > 0 ? plans[0].id : "",
      duration_days: 30,
      count: 1,
      prefix: "MV",
      max_uses: 1,
      note: "",
    });
    setCodeDialogOpen(true);
  };

  const createCodes = async () => {
    try {
      const result = await api.adminCreateRedemptionCodes(codeForm);
      toast({ title: `已生成 ${result.count} 个兑换码` });
      setCodeDialogOpen(false);
      const data = await api.adminGetRedemptionCodes();
      setCodes(data.codes || []);
    } catch (err: any) {
      toast({ title: "生成失败", description: err.message, variant: "destructive" });
    }
  };

  const toggleCodeActive = async (codeId: string, isActive: boolean) => {
    try {
      await api.adminUpdateRedemptionCode(codeId, { is_active: !isActive });
      setCodes((prev) =>
        prev.map((c) => (c.id === codeId ? { ...c, is_active: !isActive } : c))
      );
      toast({ title: isActive ? "兑换码已停用" : "兑换码已启用" });
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    }
  };

  const deleteCode = async (codeId: string) => {
    if (!confirm("确定要删除此兑换码吗？")) return;
    try {
      await api.adminDeleteRedemptionCode(codeId);
      setCodes((prev) => prev.filter((c) => c.id !== codeId));
      toast({ title: "兑换码已删除" });
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  const viewLogs = async (codeId: string) => {
    try {
      const data = await api.adminGetRedemptionCodeLogs(codeId);
      setViewingLogs(data.logs || []);
      setLogsDialogOpen(true);
    } catch (err: any) {
      toast({ title: "获取记录失败", description: err.message, variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "已复制到剪贴板" });
  };

  // ---- 系统设置 ----
  const toggleRegistration = async () => {
    setTogglingRegistration(true);
    try {
      const newValue = !registrationEnabled;
      await api.adminUpdateSystemSettings({ registration_enabled: String(newValue) });
      setRegistrationEnabled(newValue);
      toast({ title: newValue ? "注册已开启" : "注册已关闭" });
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setTogglingRegistration(false);
    }
  };

  // ---- 创建用户 ----
  const openCreateUser = () => {
    setCreateUserForm({ email: "", name: "", password: "" });
    setCreateUserDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!createUserForm.email || !createUserForm.name || createUserForm.password.length < 6) return;
    setCreatingUser(true);
    try {
      await api.adminCreateUser(createUserForm);
      toast({ title: "用户已创建" });
      setCreateUserDialogOpen(false);
      const data = await api.adminGetUsers();
      setUsers(data.users || []);
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setCreatingUser(false);
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

      {/* 系统设置 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5" />
            系统设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">公开注册</div>
              <p className="text-xs text-muted-foreground">
                {registrationEnabled ? "允许新用户通过注册页面创建账号" : "已关闭公开注册，仅管理员可创建用户"}
              </p>
            </div>
            <Switch
              checked={registrationEnabled}
              onCheckedChange={toggleRegistration}
              disabled={togglingRegistration}
            />
          </div>
        </CardContent>
      </Card>

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
          <TabsTrigger value="plans">
            <CreditCard className="mr-1 h-4 w-4" />
            Plan 管理
          </TabsTrigger>
          <TabsTrigger value="codes">
            <Ticket className="mr-1 h-4 w-4" />
            兑换码管理
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
            <div className="flex-1" />
            <Button size="sm" onClick={openCreateUser}>
              <UserPlus className="mr-1 h-4 w-4" />
              新增用户
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_1fr_80px_80px_80px_120px_160px] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
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
                    className="grid grid-cols-[1fr_1fr_80px_80px_80px_120px_160px] items-center gap-3 rounded-md px-4 py-2 hover:bg-muted/50 text-sm"
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
                      {u.provider === "email" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="重置密码"
                          onClick={() => openResetPwd(u)}
                        >
                          <KeyRound className="h-3.5 w-3.5 text-orange-600" />
                        </Button>
                      )}
                      {u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="删除用户"
                          onClick={() => handleDeleteUser(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
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
                <div className="grid grid-cols-[1fr_100px_100px_80px_80px_120px_80px] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>组织名称</div>
                  <div>Slug</div>
                  <div>计划</div>
                  <div>成员</div>
                  <div>项目</div>
                  <div>创建时间</div>
                  <div>操作</div>
                </div>
                {orgs.map((org) => (
                  <div
                    key={org.id}
                    className="grid grid-cols-[1fr_100px_100px_80px_80px_120px_80px] items-center gap-3 rounded-md px-4 py-2 hover:bg-muted/50 text-sm"
                  >
                    <div className="font-medium truncate">{org.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      @{org.slug}
                    </div>
                    <div>
                      <Badge
                        variant={
                          org.plan === "max" || org.plan === "pro"
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
                    <div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="编辑 Plan"
                        onClick={() => openOrgEdit(org)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plan 管理 */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreatePlan}>
              <Plus className="mr-1 h-4 w-4" />
              创建 Plan
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_100px_100px_120px_80px_80px_120px] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>名称</div>
                  <div>Slug</div>
                  <div>价格</div>
                  <div>限制</div>
                  <div>排序</div>
                  <div>状态</div>
                  <div>操作</div>
                </div>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="grid grid-cols-[1fr_100px_100px_120px_80px_80px_120px] items-center gap-3 rounded-md px-4 py-2 hover:bg-muted/50 text-sm"
                  >
                    <div className="font-medium truncate">
                      {plan.name}
                      {plan.is_default && (
                        <Badge variant="outline" className="ml-2 text-[10px]">默认</Badge>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{plan.slug}</div>
                    <div className="text-xs">{plan.price_label || "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      M:{plan.limits.memories === -1 ? "∞" : plan.limits.memories} /
                      R:{plan.limits.requests === -1 ? "∞" : plan.limits.requests} /
                      P:{plan.limits.projects === -1 ? "∞" : plan.limits.projects}
                    </div>
                    <div className="text-center text-xs">{plan.sort_order}</div>
                    <div>
                      <Badge variant={plan.is_active ? "secondary" : "destructive"} className="text-[10px]">
                        {plan.is_active ? "启用" : "停用"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="编辑"
                        onClick={() => openEditPlan(plan)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!plan.is_default && plans.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="删除"
                          onClick={() => deletePlan(plan.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 兑换码管理 */}
        <TabsContent value="codes" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreateCodes}>
              <Plus className="mr-1 h-4 w-4" />
              批量生成兑换码
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <div className="grid grid-cols-[180px_100px_80px_80px_80px_80px_140px_140px] gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>兑换码</div>
                  <div>Plan</div>
                  <div>时长</div>
                  <div>使用</div>
                  <div>状态</div>
                  <div>过期</div>
                  <div>备注</div>
                  <div>操作</div>
                </div>
                {codes.map((code) => (
                  <div
                    key={code.id}
                    className="grid grid-cols-[180px_100px_80px_80px_80px_80px_140px_140px] items-center gap-3 rounded-md px-4 py-2 hover:bg-muted/50 text-sm"
                  >
                    <div className="font-mono text-xs truncate">{code.code}</div>
                    <div>
                      <Badge variant="outline" className="text-[10px]">
                        {code.plan_slug || code.plan_id.slice(0, 8)}
                      </Badge>
                    </div>
                    <div className="text-xs">{code.duration_days}天</div>
                    <div className="text-xs">{code.used_count}/{code.max_uses}</div>
                    <div>
                      <Badge variant={code.is_active ? "secondary" : "destructive"} className="text-[10px]">
                        {code.is_active ? "启用" : "停用"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {code.expires_at
                        ? new Date(code.expires_at).toLocaleDateString("zh-CN")
                        : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {code.note || "-"}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="复制兑换码"
                        onClick={() => copyCode(code.code)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={code.is_active ? "停用" : "启用"}
                        onClick={() => toggleCodeActive(code.id, code.is_active)}
                      >
                        {code.is_active ? (
                          <PowerOff className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <Power className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="查看使用记录"
                        onClick={() => viewLogs(code.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="删除"
                        onClick={() => deleteCode(code.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {codes.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    暂无兑换码，点击上方按钮生成
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 重置密码 Dialog */}
      <Dialog open={resetPwdDialogOpen} onOpenChange={setResetPwdDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为用户 {resetPwdUser?.name} ({resetPwdUser?.email}) 设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>新密码</Label>
              <Input
                type="password"
                placeholder="至少 6 位字符"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResetPwd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwdDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleResetPwd} disabled={resettingPwd || newPassword.length < 6}>
              {resettingPwd ? "重置中..." : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 组织 Plan 编辑 Dialog */}
      <Dialog open={orgEditDialogOpen} onOpenChange={setOrgEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑组织计划</DialogTitle>
            <DialogDescription>
              {editingOrg?.name} (@{editingOrg?.slug})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan</Label>
              <Select
                value={orgEditForm.plan}
                onValueChange={(v) => setOrgEditForm({ ...orgEditForm, plan: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter((p) => p.is_active).map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.name} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>到期时间</Label>
              <Input
                type="datetime-local"
                value={orgEditForm.plan_expires_at}
                onChange={(e) => setOrgEditForm({ ...orgEditForm, plan_expires_at: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                留空表示永不过期（适用于 free plan）
              </p>
              {orgEditForm.plan_expires_at && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 h-auto text-xs"
                  onClick={() => setOrgEditForm({ ...orgEditForm, plan_expires_at: "" })}
                >
                  清除到期时间
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveOrg} disabled={savingOrg}>
              {savingOrg ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan 创建/编辑 Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "编辑 Plan" : "创建 Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>名称</Label>
                <Input
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  placeholder="Starter Plan"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={planForm.slug}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                  placeholder="starter"
                />
              </div>
            </div>
            <div>
              <Label>描述</Label>
              <Input
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Plan description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>价格标签</Label>
                <Input
                  value={planForm.price_label}
                  onChange={(e) => setPlanForm({ ...planForm, price_label: e.target.value })}
                  placeholder="$19/month"
                />
              </div>
              <div>
                <Label>排序权重</Label>
                <Input
                  type="number"
                  value={planForm.sort_order}
                  onChange={(e) => setPlanForm({ ...planForm, sort_order: e.target.value === "" ? ("" as any) : parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Memories 限制</Label>
                <Input
                  type="number"
                  value={planForm.limits.memories}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      limits: { ...planForm.limits, memories: e.target.value === "" ? ("" as any) : parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-[10px] text-muted-foreground mt-1">-1 = 无限</p>
              </div>
              <div>
                <Label>Requests 限制</Label>
                <Input
                  type="number"
                  value={planForm.limits.requests}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      limits: { ...planForm.limits, requests: e.target.value === "" ? ("" as any) : parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-[10px] text-muted-foreground mt-1">-1 = 无限</p>
              </div>
              <div>
                <Label>Projects 限制</Label>
                <Input
                  type="number"
                  value={planForm.limits.projects}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      limits: { ...planForm.limits, projects: e.target.value === "" ? ("" as any) : parseInt(e.target.value) },
                    })
                  }
                />
                <p className="text-[10px] text-muted-foreground mt-1">-1 = 无限</p>
              </div>
            </div>
            <div>
              <Label>Features（每行一个）</Label>
              <Textarea
                value={planForm.features}
                onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                placeholder={"Unlimited end users\n10,000 Memories\nCommunity Support"}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={savePlan}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 兑换码生成 Dialog */}
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量生成兑换码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>关联 Plan</Label>
              <Select
                value={codeForm.plan_id}
                onValueChange={(v) => setCodeForm({ ...codeForm, plan_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 Plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter((p) => p.is_active).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>订阅时长（天）</Label>
                <Input
                  type="number"
                  value={codeForm.duration_days}
                  onChange={(e) => setCodeForm({ ...codeForm, duration_days: e.target.value === "" ? ("" as any) : parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>生成数量</Label>
                <Input
                  type="number"
                  value={codeForm.count}
                  onChange={(e) => setCodeForm({ ...codeForm, count: e.target.value === "" ? ("" as any) : parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>前缀</Label>
                <Input
                  value={codeForm.prefix}
                  onChange={(e) => setCodeForm({ ...codeForm, prefix: e.target.value.toUpperCase() })}
                  placeholder="MV"
                />
              </div>
              <div>
                <Label>最大使用次数</Label>
                <Input
                  type="number"
                  value={codeForm.max_uses}
                  onChange={(e) => setCodeForm({ ...codeForm, max_uses: e.target.value === "" ? ("" as any) : parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Input
                value={codeForm.note}
                onChange={(e) => setCodeForm({ ...codeForm, note: e.target.value })}
                placeholder="可选备注信息"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={createCodes} disabled={!codeForm.plan_id}>
              生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 使用记录 Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>兑换码使用记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {viewingLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无使用记录</p>
            ) : (
              viewingLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-sm border rounded-md p-3"
                >
                  <div>
                    <div className="font-medium">
                      Plan: <Badge variant="outline" className="text-[10px]">{log.plan_slug}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      组织 ID: {log.org_id.slice(0, 8)}... | 时长: {log.duration_days}天
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>激活: {new Date(log.activated_at).toLocaleDateString("zh-CN")}</div>
                    <div>到期: {new Date(log.expires_at).toLocaleDateString("zh-CN")}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 创建用户 Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
            <DialogDescription>创建新的平台用户账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>用户名</Label>
              <Input
                value={createUserForm.name}
                onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })}
                placeholder="用户名"
              />
            </div>
            <div>
              <Label>邮箱</Label>
              <Input
                type="email"
                value={createUserForm.email}
                onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>密码</Label>
              <Input
                type="password"
                value={createUserForm.password}
                onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                placeholder="至少 6 位字符"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={creatingUser || !createUserForm.email || !createUserForm.name || createUserForm.password.length < 6}
            >
              {creatingUser ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
