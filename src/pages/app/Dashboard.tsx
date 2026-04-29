import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR, formatDate } from "@/lib/format";
import { Briefcase, Users, Wallet, TrendingUp, AlertTriangle } from "lucide-react";

interface KPI { label: string; value: string; icon: React.ComponentType<{ className?: string }>; }

export default function Dashboard() {
  const { profile, role } = useAuth();
  const { isSandbox } = useEnvironment();
  const [counts, setCounts] = useState<{ clients: number; employees: number } | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; action: string; table_name: string | null; created_at: string }>>([]);
  const [fin, setFin] = useState({ billing: 0, received: 0, outstanding: 0, margin: 0, salaries: 0 });

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [{ count: c }, { count: e }, { data: logs }, { data: invs }, { data: psheets }] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true).eq("is_sandbox", isSandbox),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("status", "Active").eq("is_sandbox", isSandbox),
        supabase.from("audit_logs").select("id, action, table_name, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("invoices")
          .select("billing_amount, amount_received, outstanding_amount, net_margin")
          .eq("is_sandbox", isSandbox)
          .gte("month_date", monthStart).lte("month_date", monthEnd),
        supabase.from("paysheets")
          .select("total_net_salary")
          .eq("is_sandbox", isSandbox)
          .gte("month_date", monthStart).lte("month_date", monthEnd),
      ]);
      setCounts({ clients: c ?? 0, employees: e ?? 0 });
      setRecent((logs ?? []) as typeof recent);
      const billing = (invs ?? []).reduce((s, i) => s + Number(i.billing_amount || 0), 0);
      const received = (invs ?? []).reduce((s, i) => s + Number(i.amount_received || 0), 0);
      const outstanding = (invs ?? []).reduce((s, i) => s + Number(i.outstanding_amount || 0), 0);
      const margin = (invs ?? []).reduce((s, i) => s + Number(i.net_margin || 0), 0);
      const salaries = (psheets ?? []).reduce((s, p) => s + Number(p.total_net_salary || 0), 0);
      setFin({ billing, received, outstanding, margin, salaries });
    })();
  }, [isSandbox]);

  const kpis: KPI[] = [
    { label: "Total Billing (Month)", value: formatINR(fin.billing), icon: Wallet },
    { label: "Amount Received", value: formatINR(fin.received), icon: TrendingUp },
    { label: "Outstanding Dues", value: formatINR(fin.outstanding), icon: AlertTriangle },
    { label: "Net Margin", value: formatINR(fin.margin), icon: TrendingUp },
    { label: "Active Clients", value: String(counts?.clients ?? "—"), icon: Briefcase },
    { label: "Active Employees", value: String(counts?.employees ?? "—"), icon: Users },
    { label: "Admin Expenses", value: formatINR(0), icon: Wallet },
    { label: "Staff Salaries", value: formatINR(fin.salaries), icon: Users },
  ];

  const isAccountant = role === "accountant";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Welcome back, {profile?.full_name || profile?.email}</h1>
        <p className="text-sm text-app-muted">{isAccountant ? "Payroll uploads & monthly tasks" : "Operational overview"}</p>
      </div>

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
        </div>
      )}

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

        <Card className="border-app-border">
          <CardHeader><CardTitle className="text-base text-app-navy">Compliance Reminders</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <div>• EPF payment due by 15th of every month</div>
            <div>• ESI payment due by 15th of every month</div>
            <div>• GST return due by 20th of every month</div>
            <div>• Professional Tax due by 10th of every month</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-app-border bg-app-saffron/5">
        <CardContent className="p-4 text-sm text-app-muted">
          <strong className="text-app-navy">Phase 2 coming soon:</strong> Payroll upload &amp; calculation engine,
          financial reports, expenses, compliance calendar, and ECR/challan generation.
        </CardContent>
      </Card>
    </div>
  );
}
