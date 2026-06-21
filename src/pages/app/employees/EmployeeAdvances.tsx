import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";

export default function EmployeeAdvances() {
  const { id } = useParams();
  const [emp, setEmp] = useState<any>(null);
  const [advs, setAdvs] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: e }, { data: a }, { data: s }] = await Promise.all([
        supabase.from("employees").select("id, full_name, employee_code, max_advance_limit, current_advance_balance, uniform_advance_balance").eq("id", id).maybeSingle(),
        supabase.from("employee_advances").select("*").eq("employee_id", id).eq("is_deleted", false).order("created_at", { ascending: false }),
        supabase.from("advance_recovery_schedule").select("*, advance:employee_advances(advance_number)").eq("employee_id", id).eq("is_deleted", false).order("recovery_month"),
      ]);
      setEmp(e); setAdvs(a ?? []); setSchedule(s ?? []);
    })();
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/app/masters/employees"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        <h1 className="text-2xl font-bold text-app-navy">{emp?.full_name} — Advances</h1>
      </div>
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Code</div><div>{emp?.employee_code}</div></div>
          <div><div className="text-xs text-muted-foreground">Limit</div><div className="tabular-nums">{formatINR(emp?.max_advance_limit ?? 0)}</div></div>
          <div><div className="text-xs text-muted-foreground">Advance Outstanding</div><div className="tabular-nums font-bold text-app-navy">{formatINR(emp?.current_advance_balance ?? 0)}</div></div>
          <div><div className="text-xs text-muted-foreground">Uniform Advance Outstanding</div><div className="tabular-nums font-bold text-app-navy">{formatINR(emp?.uniform_advance_balance ?? 0)}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Advance History</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-app-surface text-left">
              <tr><th className="p-2">Adv No</th><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Remaining</th><th className="p-2">Status</th></tr>
            </thead>
            <tbody>
              {advs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No advances</td></tr>}
              {advs.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{a.advance_number}</td>
                  <td className="p-2">{formatDate(a.advance_date)}</td>
                  <td className="p-2">{a.advance_type.replace("_"," ")}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(a.total_amount)}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(a.amount_remaining)}</td>
                  <td className="p-2"><Badge variant="outline">{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recovery Schedule</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-app-surface text-left">
              <tr><th className="p-2">Month</th><th className="p-2">Adv No</th><th className="p-2 text-right">Scheduled</th><th className="p-2 text-right">Actual</th><th className="p-2">Status</th></tr>
            </thead>
            <tbody>
              {schedule.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No schedule</td></tr>}
              {schedule.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{formatDate(s.recovery_month)}</td>
                  <td className="p-2 font-mono text-xs">{s.advance?.advance_number}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(s.scheduled_amount)}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(s.actual_amount)}</td>
                  <td className="p-2"><Badge variant="outline">{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
