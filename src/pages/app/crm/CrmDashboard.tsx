import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { AlertCircle, TrendingUp, Users, Globe, Pencil, CheckCircle2, XCircle, Clock } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  new:                 "bg-blue-100 text-blue-700",
  contacted:           "bg-purple-100 text-purple-700",
  qualified:           "bg-indigo-100 text-indigo-700",
  site_visit_planned:  "bg-orange-100 text-orange-700",
  proposal_pending:    "bg-yellow-100 text-yellow-800",
  quotation_submitted: "bg-amber-100 text-amber-700",
  negotiation:         "bg-teal-100 text-teal-700",
  on_hold:             "bg-gray-100 text-gray-600",
  won:                 "bg-green-100 text-green-700",
  lost:                "bg-red-100 text-red-700",
  closed:              "bg-gray-200 text-gray-500",
};

interface Row {
  id: string; lead_number: string; company_name: string; contact_person_name: string;
  phone: string; status: string; priority: string; source: string;
  next_followup_at: string | null; assigned_to_user_id: string | null; created_at: string;
}

interface StatusBucket { status: string; count: number }

export default function CrmDashboard() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<Row[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("user_profiles").select("id, full_name")
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach((u: any) => { m[u.id] = u.full_name; });
        setUserMap(m);
      });
    supabase.from("crm_leads")
      .select("id, lead_number, company_name, contact_person_name, phone, status, priority, source, next_followup_at, assigned_to_user_id, created_at")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [isSandbox]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString();

  const totalLeads = rows.length;
  const newThisWeek = rows.filter((r) => r.created_at >= weekAgoStr).length;
  const overdue = rows.filter((r) => r.next_followup_at && r.next_followup_at < now.toISOString() && !["won","lost","closed"].includes(r.status)).length;
  const pendingFollowup = rows.filter((r) => r.next_followup_at && r.next_followup_at.slice(0,10) === todayStr && !["won","lost","closed"].includes(r.status)).length;
  const won = rows.filter((r) => r.status === "won").length;
  const lost = rows.filter((r) => r.status === "lost").length;
  const websiteLeads = rows.filter((r) => r.source === "website").length;
  const activeLeads = rows.filter((r) => !["won","lost","closed"].includes(r.status)).length;

  const byStatus: StatusBucket[] = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const overdueRows = rows
    .filter((r) => r.next_followup_at && r.next_followup_at < now.toISOString() && !["won","lost","closed"].includes(r.status))
    .slice(0, 8);

  const todayRows = rows
    .filter((r) => r.next_followup_at && r.next_followup_at.slice(0, 10) === todayStr && !["won","lost","closed"].includes(r.status))
    .slice(0, 8);

  const recentRows = rows.slice(0, 8);

  const conversionRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;

  const KPICard = ({ label, value, sub, icon: Icon, color = "text-app-navy" }: {
    label: string; value: number | string; sub?: string;
    icon: React.ComponentType<{ className?: string }>; color?: string;
  }) => (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-app-muted uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-app-muted mt-0.5">{sub}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-app-surface flex items-center justify-center">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">CRM Dashboard</h1>
        <Link to="/app/crm/leads/new">
          <Button className="bg-app-navy text-white">+ New Lead</Button>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Total Leads" value={totalLeads} icon={Users} />
        <KPICard label="New This Week" value={newThisWeek} icon={TrendingUp} color="text-blue-600" />
        <KPICard label="Website Leads" value={websiteLeads} icon={Globe} color="text-indigo-600" />
        <KPICard label="Overdue" value={overdue} sub="need immediate action" icon={AlertCircle} color="text-red-600" />
        <KPICard label="Won" value={won} sub={`${conversionRate}% conversion`} icon={CheckCircle2} color="text-green-600" />
        <KPICard label="Lost" value={lost} icon={XCircle} color="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Pipeline by Status</CardTitle></CardHeader>
          <CardContent>
            {byStatus.length === 0 ? (
              <p className="text-sm text-app-muted">No leads yet</p>
            ) : (
              <div className="space-y-2">
                {byStatus.map(({ status, count }) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={`text-xs ${STATUS_COLOR[status] ?? "bg-gray-100 text-gray-600"}`}>
                      {status.replace(/_/g, " ")}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-app-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-app-navy rounded-full"
                          style={{ width: `${Math.round((count / totalLeads) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-5 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Overdue Follow-ups ({overdue})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueRows.length === 0 ? (
              <p className="text-sm text-app-muted">All follow-ups are on track 🎉</p>
            ) : (
              <div className="space-y-2">
                {overdueRows.map((r) => (
                  <Link key={r.id} to={`/app/crm/leads/${r.id}`} className="block">
                    <div className="flex items-center justify-between p-2 rounded border border-red-100 bg-red-50 hover:bg-red-100 transition-colors">
                      <div>
                        <div className="text-xs font-medium truncate max-w-[140px]">{r.company_name || r.contact_person_name}</div>
                        <div className="text-[10px] text-red-600">{formatDate(r.next_followup_at)}</div>
                      </div>
                      <Badge className={`text-[10px] ${STATUS_COLOR[r.status] ?? ""}`}>{r.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </Link>
                ))}
                {overdue > 8 && (
                  <Link to="/app/crm/leads" className="text-xs text-blue-600 hover:underline block text-center pt-1">
                    View all {overdue} overdue →
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" /> Today's Follow-ups ({pendingFollowup})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayRows.length === 0 ? (
              <p className="text-sm text-app-muted">No follow-ups scheduled today</p>
            ) : (
              <div className="space-y-2">
                {todayRows.map((r) => (
                  <Link key={r.id} to={`/app/crm/leads/${r.id}`} className="block">
                    <div className="flex items-center justify-between p-2 rounded border border-app-border hover:bg-app-surface transition-colors">
                      <div>
                        <div className="text-xs font-medium truncate max-w-[140px]">{r.company_name || r.contact_person_name}</div>
                        <div className="text-[10px] text-app-muted">
                          {r.assigned_to_user_id ? userMap[r.assigned_to_user_id] ?? "Unassigned" : "Unassigned"}
                        </div>
                      </div>
                      <Badge className={`text-[10px] ${STATUS_COLOR[r.status] ?? ""}`}>{r.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Leads</CardTitle>
          <Link to="/app/crm/leads" className="text-xs text-blue-600 hover:underline">View all →</Link>
        </CardHeader>
        <CardContent>
          {recentRows.length === 0 ? (
            <p className="text-sm text-app-muted text-center py-4">
              No leads yet.{" "}
              <Link to="/app/crm/leads/new" className="text-blue-600 hover:underline">Create your first lead →</Link>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-app-muted border-b border-app-border">
                    <th className="text-left pb-2">Lead #</th>
                    <th className="text-left pb-2">Company</th>
                    <th className="text-left pb-2">Contact</th>
                    <th className="text-left pb-2">Status</th>
                    <th className="text-left pb-2">Source</th>
                    <th className="text-left pb-2">Assigned</th>
                    <th className="text-left pb-2">Created</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((r) => (
                    <tr key={r.id} className="border-b border-app-border last:border-0 hover:bg-app-surface/50">
                      <td className="py-2 font-mono text-xs">{r.lead_number}</td>
                      <td className="py-2 font-medium max-w-[120px] truncate">{r.company_name || "—"}</td>
                      <td className="py-2 text-xs">
                        <div>{r.contact_person_name}</div>
                        <div className="text-app-muted">{r.phone}</div>
                      </td>
                      <td className="py-2">
                        <Badge className={`text-[10px] ${STATUS_COLOR[r.status] ?? ""}`}>{r.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="py-2 text-xs text-app-muted">{r.source}</td>
                      <td className="py-2 text-xs">{r.assigned_to_user_id ? userMap[r.assigned_to_user_id] ?? "—" : "—"}</td>
                      <td className="py-2 text-xs text-app-muted">{formatDate(r.created_at)}</td>
                      <td className="py-2">
                        <Link to={`/app/crm/leads/${r.id}`}>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
