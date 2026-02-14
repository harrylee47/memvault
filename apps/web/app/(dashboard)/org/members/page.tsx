"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/components/ui/toaster";
import { Plus, Trash2, Users, Shield, Mail } from "lucide-react";

interface Member {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  member: "成员",
  viewer: "观察者",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  member: "secondary",
  viewer: "outline",
};

export default function MembersPage() {
  const { currentOrg } = useProjectStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const loadMembers = async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const data = await api.getOrgMembers(currentOrg.id);
      setMembers(data);
    } catch (err) {
      console.error(err);
      toast({ title: "加载成员列表失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [currentOrg]);

  const handleInvite = async () => {
    if (!currentOrg || !inviteEmail) return;
    setInviting(true);
    try {
      await api.addOrgMember(currentOrg.id, { email: inviteEmail, role: inviteRole });
      toast({ title: "邀请成功", description: `已邀请 ${inviteEmail}` });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("member");
      loadMembers();
    } catch (err: any) {
      toast({ title: "邀请失败", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!currentOrg) return;
    setUpdatingRoleId(memberId);
    try {
      await api.updateMemberRole(currentOrg.id, memberId, newRole);
      toast({ title: "角色已更新" });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } catch (err: any) {
      toast({ title: "更新角色失败", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemove = async (member: Member) => {
    if (!currentOrg) return;
    if (!confirm(`确定要移除成员 ${member.name || member.email} 吗？此操作不可撤销。`)) return;
    try {
      await api.removeMember(currentOrg.id, member.id);
      toast({ title: "成员已移除" });
      loadMembers();
    } catch (err: any) {
      toast({ title: "移除失败", description: err.message, variant: "destructive" });
    }
  };

  if (!currentOrg) {
    return <div className="text-muted-foreground">请先选择一个组织</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">成员管理</h1>
          <p className="text-muted-foreground">管理组织成员和权限</p>
        </div>
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              邀请成员
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>邀请新成员</DialogTitle>
              <DialogDescription>输入邮箱地址并选择角色来邀请新成员加入组织</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>邮箱地址</Label>
                <Input
                  type="email"
                  placeholder="member@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">管理员 - 完全管理权限</SelectItem>
                    <SelectItem value="member">成员 - 读写权限</SelectItem>
                    <SelectItem value="viewer">观察者 - 只读权限</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                取消
              </Button>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                {inviting ? "邀请中..." : "发送邀请"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">暂无成员</div>
          ) : (
            <div className="space-y-1">
              {/* 表头 */}
              <div className="grid grid-cols-[1fr_1fr_150px_180px_80px] gap-4 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
                <div>姓名</div>
                <div>邮箱</div>
                <div>角色</div>
                <div>加入时间</div>
                <div>操作</div>
              </div>
              {/* 成员行 */}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-[1fr_1fr_150px_180px_80px] items-center gap-4 rounded-md px-4 py-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {(member.name || member.email)?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="font-medium">{member.name || "-"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {member.email}
                  </div>
                  <div>
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value)}
                      disabled={updatingRoleId === member.id}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="member">成员</SelectItem>
                        <SelectItem value="viewer">观察者</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(member.joined_at)}
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(member)}
                      title="移除成员"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
