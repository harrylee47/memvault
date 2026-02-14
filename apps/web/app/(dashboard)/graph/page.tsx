"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">图谱可视化</h1>
        <p className="text-muted-foreground">实体关系图谱</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            图谱可视化
          </CardTitle>
          <CardDescription>此功能将在 Phase 3 中实现，需要启用图存储 (Neo4j)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
            <div className="text-center text-muted-foreground">
              <Network className="mx-auto mb-4 h-12 w-12 opacity-40" />
              <p>图谱可视化功能即将推出</p>
              <p className="mt-1 text-sm">请在配置中心启用图存储后使用</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
