import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { Briefcase, Users, Wallet, AlertTriangle, ShieldCheck, FileText, ShieldAlert } from "lucide-react";

export default function DashboardV3C() {
  const { profile, role } = useAuth();
  const { isSandbox } = useEnvironment();
  const [params, setParams] = useSearchParams();
  const branchId = params.get("branch") ?? "all";
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [counts, setCounts] = useState({ clients: 0, employees: 0 });
  const [fin, setFin] = useState({ billing: 0, received: 0, outstanding: 0 });
  const [compliance, setCompliance] = useState({ done: 0, total: 0 });
  const [failedLogins7d, setFailedLogins7d] = useState(0);

  useEffect(() => {
    supabase.from("branches").select("id, branch_name").eq("is_deleted", false).order("branch_name")
      .then(({ data }) => setBranches((data ?? []) as never));
  }, []);

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    let cQ = supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true).eq("is_sandbox", isSandbox).eq("is_deleted", false);
    let eQ = supabase.from("employees").select("*", { count: "exact", head: true }).eq("status", "Active").eq("is_sandbox", isSandbox).eq("is_deleted", false);
    let iQ = supabase.from("invoices").select("billing_amount, amount_received, outstanding_amount").eq("is_sandbox", isSandbox).eq("is_deleted", false).gte("month_date", monthStart).lte("month_date", monthEnd);
    if (branchId !== "all") {
      cQ = cQ.eq("branch_id", branchId); eQ = eQ.eq("branch_id", branchId); iQ = iQ.eq("branch_id", branchId);
    }

    Promise.all([cQ, eQ, iQ]).then(([c, e, inv]) => {
      setCounts({ clients: c.count ?? 0, employees: e.count ?? 0 });
      const data = (inv.data ?? []) as Array<{ billing_amount: number; amount_received: number; outstanding_amount: number }>;
      setFin({
        billing: data.reduce((s, r) => s + Number(r.billing_amount || 0), 0),
        received: data.reduce((s, r) => s + Number(r.amount_received || 0), 0),
        outstanding: data.reduce((s, r) => s + Number(r.outstanding_amount || 0), 0),
      });
    });

    supabase.from("compliance_tasks").select("status").gte("due_date", monthStart).lte("due_date", monthEnd).eq("is_deleted", false)
      .then(({ data }) => {
        const all = (data ?? []) as Array<{ status: string }>;
        setCompliance({ done: all.filter((t) => t.status === "completed").length, total: all.length });
      });

    if (role === "ceo_admin") {
      supabase.from("user_activity_log").select("*", { count: "exact", head: true }).eq("activity_type", "login_failed")
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .then(({ count }) => setFailedLogins7d(count ?? 0));
    }
  }, [isSandbox, branchId, role]);

  function setBranch(v: string) {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("branch"); else next.set("branch", v);
    setParams(next);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-app-navy">Welcome back, {profile?.full_name || profile?.email}</h1>
          <p className="text-sm text-app-muted">Operational overview (Phase 3C)</p>
        </div>
        {role === "ceo_admin" && (
          <div className="min-w-[220px]">
            <Label className="text-xs">Branch</Label>
            <Select value={branchId} onValueChange={setBranch}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-app-muted">Active Clients</div><div className="text-lg font-bold text-app-navy mt-1 tabular-nums">{counts.clients}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-app-muted">Total Employees</div><div className="text-lg font-bold text-app-navy mt-1 tabular-nums">{counts.employees}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-app-muted">Month Billing</div><div className="text-lg font-bold text-app-navy mt-1 tabular-nums">{formatINR(fin.billing)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-app-muted">Outstanding</div><div className="text-lg font-bold text-app-navy mt-1 tabular-nums">{formatINR(fin.outstanding)}</div></CardContent></Card>
        <Link to="/app/compliance">
          <Card className="hover:shadow-md transition-shadow cursor-pointer"><CardContent className="p-4">
            <div className="text-xs text-app-muted">Compliance Status (this month)</div>
            <div className="text-lg font-bold text-app-navy mt-1 tabular-nums">{compliance.done} / {compliance.total}</div>
            <div className="text-xs text-app-muted">Click to view calendar →</div>
          </CardContent></Card>
        </Link>
        <Card><CardContent className="p-4"><div className="text-xs text-app-muted">Received</div><div className="text-lg font-bold text-app-navy mt-1 tabular-nums">{formatINR(fin.received)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base text-app-navy">Quick Links</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to="/app/reports/annual-summary"><Button variant="outline"><FileText className="h-4 w-4 mr-1" /> Annual Report</Button></Link>
          <Link to="/app/compliance/ecr"><Button variant="outline"><ShieldCheck className="h-4 w-4 mr-1" /> ECR Generate</Button></Link>
          <Link to="/app/compliance/ecr"><Button variant="outline"><ShieldCheck className="h-4 w-4 mr-1" /> ESI Challan</Button></Link>
          <Link to="/app/finance/statement"><Button variant="outline"><FileText className="h-4 w-4 mr-1" /> Statement of Account</Button></Link>
          <Link to="/app/finance/aging"><Button variant="outline"><AlertTriangle className="h-4 w-4 mr-1" /> Aging Report</Button></Link>
        </CardContent>
      </Card>

      {role === "ceo_admin" && (
        <Card className={failedLogins7d > 5 ? "border-red-300 bg-red-50" : ""}>
          <CardContent className="pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldAlert className={`h-5 w-5 ${failedLogins7d > 5 ? "text-red-700" : "text-app-muted"}`} />
              <div>
                <div className={`font-semibold ${failedLogins7d > 5 ? "text-red-900" : "text-app-navy"}`}>Security: {failedLogins7d} failed login attempts (last 7 days)</div>
                {failedLogins7d > 5 && <div className="text-xs text-red-800">Multiple failed attempts detected — please review.</div>}
              </div>
            </div>
            <Link to="/app/admin/activity-log"><Button variant="outline" size="sm">View Activity Log →</Button></Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
