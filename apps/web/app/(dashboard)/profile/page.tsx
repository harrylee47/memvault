"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { User, KeyRound, Copy, Check } from "lucide-react";

export default function ProfilePage() {
  const { user, loadUser } = useAuthStore();

  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await api.updateMe({ name: name.trim() });
      await loadUser();
      toast({ title: "昵称已更新" });
    } catch (err: any) {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: "两次输入的密码不一致", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "新密码至少 6 位字符", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await api.updateMe({ old_password: oldPassword, new_password: newPassword });
      toast({ title: "密码已修改" });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "修改失败", description: err.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return <div className="text-muted-foreground">加载中...</div>;
  }

  const isEmailUser = user.provider === "email" || !user.provider;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">个人资料</h1>
        <p className="text-muted-foreground">查看和管理你的账户信息</p>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User ID */}
          <div className="space-y-2">
            <Label>User ID</Label>
            <div className="flex items-center gap-2">
              <Input value={user.id} readOnly className="font-mono text-sm opacity-80" />
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={() => copyToClipboard(user.id, "user-id")}
                title="复制 User ID"
              >
                {copiedField === "user-id" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              此 ID 用于 Agent 配置中的 userId 参数，在接入引导中已自动填入
            </p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label>邮箱</Label>
            <div className="flex items-center gap-2">
              <Input value={user.email} readOnly className="opacity-80" />
              <Badge variant="outline" className="flex-shrink-0">
                {user.provider || "email"}
              </Badge>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>昵称</Label>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入你的昵称"
              />
              <Button
                onClick={handleSaveName}
                disabled={savingName || name.trim() === user.name}
                className="flex-shrink-0"
              >
                {savingName ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>

          {/* 账户信息 */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <Label className="text-muted-foreground">账户状态</Label>
              <div className="mt-1">
                <Badge variant={user.is_active ? "secondary" : "destructive"}>
                  {user.is_active ? "活跃" : "已禁用"}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">角色</Label>
              <div className="mt-1">
                <Badge variant={user.is_admin ? "default" : "secondary"}>
                  {user.is_admin ? "管理员" : "普通用户"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 修改密码 - 仅邮箱注册用户 */}
      {isEmailUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              修改密码
            </CardTitle>
            <CardDescription>
              修改你的登录密码
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>当前密码</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="输入当前密码"
              />
            </div>
            <div className="space-y-2">
              <Label>新密码</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位字符"
              />
            </div>
            <div className="space-y-2">
              <Label>确认新密码</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
            >
              {savingPassword ? "修改中..." : "修改密码"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
