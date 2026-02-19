"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { Check, Gift, Clock, Mail } from "lucide-react";

interface BillingData {
  plan: string;
  plan_expires_at: string | null;
  plan_activated_at: string | null;
  billing_period_start: string;
  billing_period_end: string;
  usage: {
    memories: number;
    requests: number;
    projects: number;
  };
  limits: {
    memories: number;
    requests: number;
    projects: number;
  };
}

interface PlanData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_label: string | null;
  limits: { memories: number; requests: number; projects: number };
  features: string[];
  sort_order: number;
  is_default: boolean;
}

export default function BillingPage() {
  const { currentOrg } = useProjectStore();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    Promise.allSettled([
      api.getBillingUsage(currentOrg.id),
      api.getPlans(),
    ]).then(([billingResult, plansResult]) => {
      if (billingResult.status === "fulfilled") setBilling(billingResult.value);
      if (plansResult.status === "fulfilled") setPlans(plansResult.value || []);
    }).finally(() => setLoading(false));
  }, [currentOrg]);

  const handleRedeem = async () => {
    if (!currentOrg || !redeemCode.trim()) return;
    setRedeeming(true);
    try {
      const result = await api.redeemCode(currentOrg.id, redeemCode.trim());
      toast({
        title: "兑换成功",
        description: `已激活 ${result.plan_name}，有效期至 ${new Date(result.expires_at).toLocaleDateString("zh-CN")}`,
      });
      setRedeemCode("");
      const data = await api.getBillingUsage(currentOrg.id);
      setBilling(data);
    } catch (err: any) {
      toast({ title: "兑换失败", description: err.message, variant: "destructive" });
    } finally {
      setRedeeming(false);
    }
  };

  if (!currentOrg) {
    return <div className="text-muted-foreground">请先选择一个组织</div>;
  }

  if (loading) {
    return <div className="text-muted-foreground">加载中...</div>;
  }

  const currentPlan = billing?.plan || "free";
  const usage = billing?.usage || { memories: 0, requests: 0, projects: 0 };
  const limits = billing?.limits || { memories: 10000, requests: 1000, projects: 1 };

  const formatLimit = (value: number | undefined) => {
    if (value == null) return "0";
    return value === -1 ? "Unlimited" : value.toLocaleString();
  };

  const calcPercent = (used: number, limit: number) =>
    limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const requestUsagePercent = calcPercent(usage.requests ?? 0, limits.requests);
  const memoryUsagePercent = calcPercent(usage.memories ?? 0, limits.memories);
  const projectUsagePercent = calcPercent(usage.projects ?? 0, limits.projects);

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(s)} - ${fmt(e)}`;
  };

  const currentPlanData = plans.find((p) => p.slug === currentPlan);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing and usage</h1>
      </div>

      {/* 当前计划 + 用量 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 当前计划卡片 */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold capitalize">{currentPlanData?.name || `${currentPlan} Plan`}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {currentPlanData?.description || ""}
            </p>
            {billing?.plan_expires_at && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  到期时间：{new Date(billing.plan_expires_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 用量卡片 */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Requests */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Requests（当月）</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {(usage.requests ?? 0).toLocaleString()} / {formatLimit(limits.requests)}
                  </span>
                  <Badge variant={requestUsagePercent > 80 ? "destructive" : "secondary"} className="text-xs">
                    {requestUsagePercent}%
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    requestUsagePercent > 80 ? "bg-destructive" : "bg-primary"
                  }`}
                  style={{ width: `${Math.max(1, requestUsagePercent)}%` }}
                />
              </div>
            </div>

            {/* Memories */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Memories</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {(usage.memories ?? 0).toLocaleString()} / {formatLimit(limits.memories)}
                  </span>
                  <Badge variant={memoryUsagePercent > 80 ? "destructive" : "secondary"} className="text-xs">
                    {memoryUsagePercent}%
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    memoryUsagePercent > 80 ? "bg-destructive" : "bg-indigo-500"
                  }`}
                  style={{ width: `${Math.max(1, memoryUsagePercent)}%` }}
                />
              </div>
            </div>

            {/* Projects */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Projects</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {(usage.projects ?? 0).toLocaleString()} / {formatLimit(limits.projects)}
                  </span>
                  <Badge variant={projectUsagePercent > 80 ? "destructive" : "secondary"} className="text-xs">
                    {projectUsagePercent}%
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    projectUsagePercent > 80 ? "bg-destructive" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.max(1, projectUsagePercent)}%` }}
                />
              </div>
            </div>

            {billing && (
              <p className="text-sm text-muted-foreground pt-1">
                Current Billing: {formatPeriod(billing.billing_period_start, billing.billing_period_end)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 兑换码 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-5 w-5" />
            <h3 className="font-semibold">兑换码</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            输入兑换码激活或延长订阅计划
          </p>
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="输入兑换码，如 MV-A3F2-K9X1-P7M4"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              className="font-mono"
            />
            <Button onClick={handleRedeem} disabled={redeeming || !redeemCode.trim()}>
              {redeeming ? "兑换中..." : "兑换"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Plans 列表 */}
      <div>
        <h2 className="text-xl font-bold mb-4">MemVault Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.slug === currentPlan;
            return (
              <Card
                key={plan.id}
                className={isCurrent ? "ring-2 ring-primary" : ""}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="text-2xl font-bold">{plan.price_label || "Free"}</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature: string) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => window.open("mailto:contact@memvault.io?subject=Upgrade to " + plan.name, "_blank")}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Contact Us
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
