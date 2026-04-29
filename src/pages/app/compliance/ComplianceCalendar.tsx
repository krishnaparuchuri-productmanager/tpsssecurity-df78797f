import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ComplianceTaskDialog from "./ComplianceTaskDialog";
import CompleteTaskDialog from "./CompleteTaskDialog";
import { formatINR } from "@/lib/format";

export interface ComplianceTask {
  id: string;
  task_code: string;
  task_name: string;
  category: string;
  frequency: string;
  due_date: string;
  period_label: string;
  status: string;
  completed_date: string | null;
  challan_number: string | null;
  amount_paid: number | null;
  notes: string | null;
  assigned_to: string | null;
  reminder_days_before: number;
}

const CAT_COLORS: Record<string, string> = {
  EPF: "bg-blue-100 text-blue-800",
  ESI: "bg-emerald-100 text-emerald-800",
  GST: "bg-amber-100 text-amber-800",
  PT: "bg-purple-100 text-purple-800",
  TDS: "bg-rose-100 text-rose-800",
  Other: "bg-slate-100 text-slate-800",
};

function statusOf(t: ComplianceTask): "completed" | "overdue" | "upcoming" | "pending" {
  if (t.status === "completed") return "completed";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(t.due_date); due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  const diff = (due.getTime() - today.getTime()) / 86400000;
  if (diff <= 7) return "upcoming";
  return "pending";
}

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  upcoming: "bg-amber-100 text-amber-800",
  pending: "bg-slate-100 text-slate-700",
};

export default function ComplianceCalendar() {
  const { isSandbox } = useEnvironment();
  const { role, can } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [editTask, setEditTask] = useState<ComplianceTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [completeTask, setCompleteTask] = useState<ComplianceTask | null>(null);
  const [refresh, setRefresh] = useState(0);

  const canCreate = can("compliance", "can_create");
  const canEdit = can("compliance", "can_edit");
  const isAdmin = role === "ceo_admin" || role === "coo_ops";

  useEffect(() => {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10); // include next month for upcoming
    const upStart = new Date().toISOString().slice(0, 10);
    const upEnd = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const earliestStart = start < upStart ? start : upStart;
    const latestEnd = end > upEnd ? end : upEnd;

    supabase
      .from("compliance_tasks")
      .select("*")
      .gte("due_date", earliestStart).lte("due_date", latestEnd)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("due_date", { ascending: true })
      .then(({ data }) => setTasks((data ?? []) as unknown as ComplianceTask[]));
  }, [year, month, isSandbox, refresh]);

  const filtered = useMemo(() => tasks.filter((t) => {
    if (catFilter !== "all" && t.category !== catFilter) return false;
    if (statusFilter !== "all" && statusOf(t) !== statusFilter) return false;
    return true;
  }), [tasks, catFilter, statusFilter]);

  const monthTasks = useMemo(() => filtered.filter((t) => {
    const d = new Date(t.due_date);
    return d.getFullYear() === year && d.getMonth() === month - 1;
  }), [filtered, year, month]);

  const upcoming = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in30 = new Date(now.getTime() + 30 * 86400000);
    return filtered.filter((t) => {
      if (t.status === "completed") return false;
      const d = new Date(t.due_date);
      return d >= now && d <= in30;
    }).sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [filtered]);

  const kpi = useMemo(() => {
    const overdue = filtered.filter((t) => statusOf(t) === "overdue").length;
    const dueWeek = filtered.filter((t) => statusOf(t) === "upcoming").length;
    const monthCompleted = monthTasks.filter((t) => t.status === "completed").length;
    const monthTotal = monthTasks.length;
    const rate = monthTotal ? Math.round((monthCompleted / monthTotal) * 100) : 0;
    return { overdue, dueWeek, monthCompleted, rate, monthTotal };
  }, [filtered, monthTasks]);

  // Build calendar grid
  const grid = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: { day: number | null; tasks: ComplianceTask[] }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ day: null, tasks: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dayTasks = monthTasks.filter((t) => new Date(t.due_date).getDate() === d);
      cells.push({ day: d, tasks: dayTasks });
    }
    return cells;
  }, [year, month, monthTasks]);

  function changeMonth(delta: number) {
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m); setYear(y);
  }

  async function seedYear() {
    const from = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const to = new Date(year + 1, month - 1, 0).toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc("seed_compliance_tasks", { _from: from, _to: to });
    if (error) return toast.error(error.message);
    toast.success(`Seeded ${data} task slots (existing kept)`);
    setRefresh((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-app-navy">Compliance Calendar</h1>
        <div className="flex gap-2">
          {isAdmin && <Button variant="outline" onClick={seedYear}><Sparkles className="h-4 w-4 mr-1" /> Seed 12 Months</Button>}
          {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Task</Button>}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">Overdue</CardTitle></CardHeader><CardContent className="text-xl font-bold text-red-700">{kpi.overdue}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">Due This Week</CardTitle></CardHeader><CardContent className="text-xl font-bold text-amber-700">{kpi.dueWeek}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">Completed (Month)</CardTitle></CardHeader><CardContent className="text-xl font-bold text-green-700">{kpi.monthCompleted}/{kpi.monthTotal}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">Compliance Rate</CardTitle></CardHeader><CardContent className="text-xl font-bold">{kpi.rate}%</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <CardTitle className="text-base min-w-[140px] text-center">
                {new Date(year, month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => changeMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div><Label className="text-xs">Category</Label>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {["EPF","ESI","GST","PT","TDS","Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="upcoming">Due ≤7d</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" /></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-app-muted mb-1">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="text-center p-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => (
              <div key={i} className={`min-h-[80px] border border-app-border rounded p-1 ${cell.day ? "bg-white" : "bg-slate-50"}`}>
                {cell.day && (
                  <>
                    <div className="text-xs font-semibold text-app-navy">{cell.day}</div>
                    <div className="space-y-1 mt-1">
                      {cell.tasks.slice(0, 3).map((t) => {
                        const s = statusOf(t);
                        const dot = s === "completed" ? "bg-green-500" : s === "overdue" ? "bg-red-500" : s === "upcoming" ? "bg-amber-500" : "bg-slate-400";
                        return (
                          <button key={t.id} onClick={() => canEdit && setEditTask(t)}
                            className="w-full text-left text-[10px] truncate flex items-center gap-1 hover:underline"
                            title={`${t.task_name} — ${t.period_label}`}>
                            <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
                            <span className="truncate">{t.task_code}</span>
                          </button>
                        );
                      })}
                      {cell.tasks.length > 3 && <div className="text-[10px] text-app-muted">+{cell.tasks.length - 3}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Upcoming (next 30 days)</CardTitle></CardHeader>
        <CardContent>
          {upcoming.length === 0 && <div className="text-sm text-app-muted">No upcoming pending tasks. Use “Seed 12 Months” to pre-populate standard filings.</div>}
          <div className="space-y-2">
            {upcoming.map((t) => {
              const s = statusOf(t);
              return (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border border-app-border rounded p-3 bg-white">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <Badge className={CAT_COLORS[t.category] ?? CAT_COLORS.Other}>{t.category}</Badge>
                    <div>
                      <div className="font-medium text-app-navy">{t.task_name}</div>
                      <div className="text-xs text-app-muted">{t.period_label} · Due {t.due_date}{t.challan_number ? ` · Challan ${t.challan_number}` : ""}{t.amount_paid ? ` · ${formatINR(Number(t.amount_paid))}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_BADGE[s]}>{s}</Badge>
                    {canEdit && t.status !== "completed" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEditTask(t)}>Edit</Button>
                        <Button size="sm" onClick={() => setCompleteTask(t)}>Mark Complete</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ComplianceTaskDialog
        open={createOpen || !!editTask}
        task={editTask}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditTask(null); } }}
        onSaved={() => { setCreateOpen(false); setEditTask(null); setRefresh((k) => k + 1); }}
      />
      <CompleteTaskDialog
        task={completeTask}
        onOpenChange={(o) => { if (!o) setCompleteTask(null); }}
        onSaved={() => { setCompleteTask(null); setRefresh((k) => k + 1); }}
      />
    </div>
  );
}
