import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, formatDate } from "@/lib/format";
import { Briefcase, Users, Wallet, TrendingUp, AlertTriangle, ShieldCheck, ShieldAlert, FileText, MapPin } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface KPI { label: string; value: string; icon: React.ComponentType<{ className?: string }>; }
interface MonthBucket { label: string; key: string; billing: number; received: number }

export default function Dashboard() {
  const { profile, role } = useAuth();
  const { isSandbox } = useEnvironment();
  const [params, setParams] = useSearchParams();
  const branchId = params.get("branch") ?? "all";

  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [counts, setCounts] = useState<{ clients: number; employees: number; deployments: number } | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; action: string; table_name: string | null; created_at: string }>>([]);
  const [fin, setFin] = useState({ billing: 0, received: 0, outstanding: 0, margin: 0, salaries: 0 });
  const [chart, setChart] = useState<MonthBucket[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [compliance, setCompliance] = useState({ done: 0, total: 0, overdue: 0 });
  const [failedLogins7d, setFailedLogins7d] = useState(0);

  useEffect(() => {
    supabase.from("branches").select("id, branch_name").eq("is_deleted", false).eq("is_active", true).order("branch_name")
      .then(({ data }) => setBranches((data ?? []) as never));
  }, []);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const sixStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);

      const buckets: MonthBucket[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          label: d.toLocaleDateString("en-US", { month: "short" }),
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          billing: 0, received: 0,
        });
      }

      const branchEq = branchId !== "all" ? branchId : null;
      let cQ = supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true).eq("is_sandbox", isSandbox);
      let eQ = supabase.from("employees").select("*", { count: "exact", head: true }).eq("status", "Active").eq("is_sandbox", isSandbox);
      let dQ = supabase.from("employee_deployments").select("*", { count: "exact", head: true }).eq("is_current", true).eq("is_deleted", false).eq("is_sandbox", isSandbox);
      let invQ = supabase.from("invoices")
        .select("billing_amount, amount_received, outstanding_amount, net_margin")
        .eq("is_sandbox", isSandbox)
        .gte("month_date", monthStart).lte("month_date", monthEnd);
      let psQ = supabase.from("paysheets")
        .select("total_net_salary")
        .eq("is_sandbox", isSandbox)
        .gte("month_date", monthStart).lte("month_date", monthEnd);
      let inv6Q = supabase.from("invoices")
        .select("month_date, billing_amount, amount_received")
        .eq("is_sandbox", isSandbox).eq("is_deleted", false)
        .gte("month_date", sixStart);
      let pendQ = supabase.from("paysheets").select("*", { count: "exact", head: true })
        .eq("status", "submitted").eq("is_sandbox", isSandbox).eq("is_deleted", false);

      if (branchEq) {
        cQ = cQ.eq("branch_id", branchEq);
        eQ = eQ.eq("branch_id", branchEq);
        invQ = invQ.eq("branch_id", branchEq);
        inv6Q = inv6Q.eq("branch_id", branchEq);
        psQ = psQ.eq("branch_id", branchEq);
        pendQ = pendQ.eq("branch_id", branchEq);
      }

      const [{ count: c }, { count: e }, { count: dep }, { data: logs }, { data: invs }, { data: psheets }, { data: invs6 }, { count: pending }] = await Promise.all([
        cQ, eQ, dQ,
        supabase.from("audit_logs").select("id, action, table_name, created_at").order("created_at", { ascending: false }).limit(5),
        invQ, psQ, inv6Q, pendQ,
      ]);
      setCounts({ clients: c ?? 0, employees: e ?? 0, deployments: dep ?? 0 });
      setRecent((logs ?? []) as typeof recent);
      const billing = (invs ?? []).reduce((s, i) => s + Number(i.billing_amount || 0), 0);
      const received = (invs ?? []).reduce((s, i) => s + Number(i.amount_received || 0), 0);
      const outstanding = (invs ?? []).reduce((s, i) => s + Number(i.outstanding_amount || 0), 0);
      const margin = (invs ?? []).reduce((s, i) => s + Number(i.net_margin || 0), 0);
      const salaries = (psheets ?? []).reduce((s, p) => s + Number(p.total_net_salary || 0), 0);
      setFin({ billing, received, outstanding, margin, salaries });
      setPendingCount(pending ?? 0);

      (invs6 ?? []).forEach((row: { month_date: string; billing_amount: number; amount_received: number }) => {
        const k = row.month_date.slice(0, 7);
        const b = buckets.find((x) => x.key === k);
        if (b) {
          b.billing += Number(row.billing_amount || 0);
          b.received += Number(row.amount_received || 0);
        }
      });
      setChart(buckets);

      // Compliance tile (live)
      const { data: tasks } = await supabase.from("compliance_tasks")
        .select("status, due_date")
        .gte("due_date", monthStart).lte("due_date", monthEnd)
        .eq("is_deleted", false);
      const all = (tasks ?? []) as Array<{ status: string; due_date: string }>;
      const done = all.filter((t) => t.status === "completed").length;
      const overdue = all.filter((t) => t.status !== "completed" && t.due_date < today).length;
      setCompliance({ done, total: all.length, overdue });

      // Security: failed logins (CEO only)
      if (role === "ceo_admin") {
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const { count: fl } = await supabase
          .from("audit_logs")
          .select("*", { count: "exact", head: true })
          .eq("action", "login_failed")
          .gte("created_at", since);
        setFailedLogins7d(fl ?? 0);
      }
    })();
  }, [isSandbox, branchId, role]);

  function setBranch(v: string) {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("branch"); else next.set("branch", v);
    setParams(next);
  }

  const kpis: KPI[] = [
    { label: "Total Billing (Month)", value: formatINR(fin.billing), icon: Wallet },
    { label: "Amount Received", value: formatINR(fin.received), icon: TrendingUp },
    { label: "Outstanding Dues", value: formatINR(fin.outstanding), icon: AlertTriangle },
    { label: "Net Margin", value: formatINR(fin.margin), icon: TrendingUp },
    { label: "Active Clients", value: String(counts?.clients ?? "—"), icon: Briefcase },
    { label: "Active Employees", value: String(counts?.employees ?? "—"), icon: Users },
    { label: "Active Deployments", value: String(counts?.deployments ?? "—"), icon: MapPin },
    { label: "Staff Salaries", value: formatINR(fin.salaries), icon: Users },
  ];

  const isAccountant = role === "accountant";
  const canSeeApprovals = role === "ceo_admin" || role === "coo_ops";

  // Compliance tile color
  const compTotal = compliance.total;
  const compClass = compTotal === 0
    ? "border-app-border"
    : compliance.overdue > 0
      ? "border-red-300 bg-red-50"
      : compliance.done < compTotal
        ? "border-yellow-300 bg-yellow-50"
        : "border-green-300 bg-green-50";
  const compTextClass = compTotal === 0
    ? "text-app-navy"
    : compliance.overdue > 0
      ? "text-red-800"
      : compliance.done < compTotal
        ? "text-yellow-900"
        : "text-green-800";

  const QuickLinksCard = (
    <Card className="border-app-border">
      <CardHeader><CardTitle className="text-base text-app-navy">Quick Actions</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link to="/app/reports/annual-summary"><Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" /> Annual Report</Button></Link>
        <Link to="/app/compliance/ecr"><Button variant="outline" size="sm"><ShieldCheck className="h-4 w-4 mr-1" /> ECR Generate</Button></Link>
        <Link to="/app/compliance/ecr"><Button variant="outline" size="sm"><ShieldCheck className="h-4 w-4 mr-1" /> ESI Challan</Button></Link>
        <Link to="/app/finance/statement"><Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" /> Statement of Account</Button></Link>
        <Link to="/app/finance/aging"><Button variant="outline" size="sm"><AlertTriangle className="h-4 w-4 mr-1" /> Aging Report</Button></Link>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-app-navy">Welcome back, {profile?.full_name || profile?.email}</h1>
          <p className="text-sm text-app-muted">{isAccountant ? "Payroll uploads & monthly tasks" : "Operational overview"}</p>
        </div>
        {role === "ceo_admin" && (
          <div className="min-w-[220px]">
            <Label className="text-xs">Branch</Label>
            <Select value={branchId} onValueChange={setBranch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {canSeeApprovals && pendingCount > 0 && (
        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-300 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-yellow-700" />
            <div>
              <div className="font-semibold text-yellow-900">{pendingCount} paysheet{pendingCount > 1 ? "s" : ""} awaiting your approval</div>
              <div className="text-xs text-yellow-800">Review and approve to release payments.</div>
            </div>
          </div>
          <Link to="/app/payroll/approvals">
            <Button variant="outline" className="border-yellow-700 text-yellow-900">Review now</Button>
          </Link>
        </div>
      )}

      {!isAccountant && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <Card key={k.label} className="border-app-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-app-muted">{k.label}</div>
                    <div className="text-lg font-bold text-app-navy mt-1 tabular-nums">{k.value}</div>
                  </div>
                  <k.icon className="h-4 w-4 text-app-saffron" />
                </div>
              </CardContent>
            </Card>
          ))}
          <Link to="/app/compliance" className="contents">
            <Card className={`cursor-pointer hover:shadow-md transition-shadow ${compClass}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-app-muted">Compliance (this month)</div>
                    <div className={`text-lg font-bold mt-1 tabular-nums ${compTextClass}`}>
                      {compliance.done} / {compliance.total} completed
                    </div>
                    {compliance.overdue > 0 && (
                      <div className="text-xs text-red-700 mt-0.5">{compliance.overdue} overdue</div>
                    )}
                  </div>
                  <ShieldCheck className="h-4 w-4 text-app-saffron" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {!isAccountant && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border-app-border lg:col-span-2">
            <CardHeader><CardTitle className="text-base text-app-navy">Invoiced vs Received — last 6 months</CardTitle></CardHeader>
            <CardContent style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Legend />
                  <Bar dataKey="billing" name="Invoiced" fill="hsl(var(--primary))" />
                  <Bar dataKey="received" name="Received" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {QuickLinksCard}
        </div>
      )}

      {isAccountant && QuickLinksCard}

      {!isAccountant && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-app-border">
            <CardHeader><CardTitle className="text-base text-app-navy">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity yet</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recent.map((r) => (
                    <li key={r.id} className="flex justify-between border-b border-app-border/60 pb-1">
                      <span><span className="font-mono text-xs text-app-saffron">{r.action}</span> {r.table_name ?? ""}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {role === "ceo_admin" ? (
            <Card className={`border-app-border ${failedLogins7d > 5 ? "border-red-300 bg-red-50" : ""}`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className={`h-5 w-5 ${failedLogins7d > 5 ? "text-red-700" : "text-app-saffron"}`} />
                  <span className={failedLogins7d > 5 ? "text-red-900" : "text-app-navy"}>Security Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs text-app-muted">Failed login attempts (last 7 days)</div>
                  <div className={`text-2xl font-bold tabular-nums ${failedLogins7d > 5 ? "text-red-700" : "text-app-navy"}`}>
                    {failedLogins7d}
                  </div>
                  {failedLogins7d > 5 && (
                    <div className="text-xs text-red-800 mt-1">Multiple failed attempts detected — please review.</div>
                  )}
                </div>
                <Link to="/app/admin/activity-log" className="text-sm text-app-saffron hover:underline">
                  View Activity Log →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-app-border">
              <CardHeader><CardTitle className="text-base text-app-navy">Compliance Reminders</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <div>• EPF payment due by 15th of every month</div>
                <div>• ESI payment due by 15th of every month</div>
                <div>• GST return due by 20th of every month</div>
                <div>• Professional Tax due by 10th of every month</div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
