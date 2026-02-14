"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">成员管理</h1>
        <p className="text-muted-foreground">管理组织成员和权限</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            成员管理
          </CardTitle>
          <CardDescription>此功能将在 Phase 2 中完善（邀请、RBAC）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            成员管理功能即将推出
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
