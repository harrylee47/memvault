"use client";

import { useProjectStore } from "@/store/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

export default function OrgPage() {
  const { currentOrg } = useProjectStore();

  if (!currentOrg) {
    return <div className="text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">组织管理</h1>
        <p className="text-muted-foreground">管理组织信息</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <CardTitle>{currentOrg.name}</CardTitle>
            <p className="text-sm text-muted-foreground">@{currentOrg.slug}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">当前计划:</span>
            <Badge>{currentOrg.plan.toUpperCase()}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
