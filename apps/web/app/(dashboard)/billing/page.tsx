"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { Check } from "lucide-react";

interface BillingData {
  plan: string;
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

const PLANS = [
  {
    id: "free",
    name: "Hobby Plan",
    price: "Free",
    features: [
      "Unlimited end users",
      "10,000 Memories",
      "1,000 retrieval API calls/month",
      "1 Project",
      "Community Support",
    ],
    buttonText: "Current Plan",
  },
  {
    id: "starter",
    name: "Starter Plan",
    price: "$19/month",
    features: [
      "Unlimited end users",
      "50,000 Memories",
      "5,000 retrieval API calls/month",
      "3 Projects",
      "Community Support",
    ],
    buttonText: "Upgrade to Starter",
  },
  {
    id: "pro",
    name: "Pro Plan",
    price: "$249/month",
    features: [
      "Unlimited end users",
      "Unlimited Memories",
      "50,000 retrieval API calls/month",
      "Unlimited Projects",
      "Graph Memory",
      "Private Slack Channel",
      "Advanced Analytics",
      "Multiple Project Support",
    ],
    buttonText: "Upgrade to Pro",
  },
  {
    id: "enterprise",
    name: "Enterprise Plan",
    price: "Flexible Pricing",
    features: [
      "Unlimited end users",
      "Unlimited Memories",
      "Unlimited API calls/month",
      "Unlimited Projects",
      "Private Slack Channel",
      "Advanced Analytics",
      "Graph Memory",
      "On-prem deployment",
      "Audit Logs",
      "SSO",
      "Custom Integrations",
      "SLA",
    ],
    buttonText: "Contact Us",
  },
];

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: "Includes limited requests and memories to test core memory workflows.",
  starter: "More capacity for growing teams with moderate usage.",
  pro: "Full-featured plan for production workloads with advanced capabilities.",
  enterprise: "Custom solution for large-scale deployments with dedicated support.",
};

export default function BillingPage() {
  const { currentOrg } = useProjectStore();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    api
      .getBillingUsage(currentOrg.id)
      .then(setBilling)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentOrg]);

  const handleUpgrade = async (planId: string) => {
    if (!currentOrg) return;
    if (planId === "enterprise") {
      toast({ title: "请联系我们", description: "enterprise@memvault.io" });
      return;
    }
    setUpgrading(planId);
    try {
      await api.updateOrgPlan(currentOrg.id, planId);
      toast({ title: "计划已更新" });
      // Reload billing data
      const data = await api.getBillingUsage(currentOrg.id);
      setBilling(data);
    } catch (err: any) {
      toast({ title: "升级失败", description: err.message, variant: "destructive" });
    } finally {
      setUpgrading(null);
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

  const formatLimit = (value: number) => (value === -1 ? "Unlimited" : value.toLocaleString());

  const requestUsagePercent =
    limits.requests === -1 ? 0 : Math.min(100, Math.round((usage.requests / limits.requests) * 100));

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    return `${fmt(s)} - ${fmt(e)}`;
  };

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
            <h2 className="text-xl font-bold capitalize">{currentPlan} Plan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {PLAN_DESCRIPTIONS[currentPlan]}
            </p>
            {currentPlan === "free" && (
              <Button className="mt-4" onClick={() => handleUpgrade("pro")}>
                Upgrade to Pro
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 用量卡片 */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold">{usage.requests.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">
                / {formatLimit(limits.requests)} requests
              </span>
              <Badge variant={requestUsagePercent > 80 ? "destructive" : "secondary"}>
                {requestUsagePercent}% Used
              </Badge>
            </div>
            {/* 进度条 */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  requestUsagePercent > 80 ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${Math.max(1, requestUsagePercent)}%` }}
              />
            </div>
            {billing && (
              <p className="text-sm text-muted-foreground">
                Current Billing: {formatPeriod(billing.billing_period_start, billing.billing_period_end)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plans 列表 */}
      <div>
        <h2 className="text-xl font-bold mb-4">MemVault Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <Card
                key={plan.id}
                className={isCurrent ? "ring-2 ring-primary" : ""}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="text-2xl font-bold">{plan.price}</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || upgrading === plan.id}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {upgrading === plan.id
                      ? "处理中..."
                      : isCurrent
                      ? "Current Plan"
                      : plan.buttonText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
