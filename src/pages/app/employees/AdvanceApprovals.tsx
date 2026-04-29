import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatINR, formatDate } from "@/lib/format";
import { Check, X } from "lucide-react";

interface Pending {
  id: string; advance_number: string; total_amount: number; monthly_deduction: number;
  advance_type: string; advance_date: string; reason: string | null;
  recovery_start_month: string;
  employee: { full_name: string; employee_code: string } | null;
  client: { client_name: string } | null;
}
export default function AdvanceApprovals() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<Pending[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase.from("employee_advances")
      .select("id, advance_number, total_amount, monthly_deduction, advance_type, advance_date, reason, recovery_start_month, employee:employees(full_name, employee_code), client:clients(client_name)")
      .eq("status","pending").eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("created_at");
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); }, [isSandbox]);

  async function approve(id: string) {
    const { error } = await supabase.rpc("approve_advance", { _id: id } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Approved"); load();
  }
  async function reject(id: string) {
    const r = reasons[id] || "";
    if (r.length < 10 || r.length > 200) { toast.error("Reason must be 10–200 chars"); return; }
    const { error } = await supabase.rpc("reject_advance", { _id: id, _reason: r } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected"); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Advance Approvals ({rows.length})</h1>
      {rows.length === 0 && <p className="text-muted-foreground">No pending advances.</p>}
      {rows.map(r => (
        <Card key={r.id}>
          <CardHeader><CardTitle className="text-base">{r.advance_number} — {r.employee?.full_name} ({r.client?.client_name ?? "—"})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Type</div><div>{r.advance_type.replace("_"," ")}</div></div>
              <div><div className="text-xs text-muted-foreground">Total</div><div className="tabular-nums">{formatINR(r.total_amount)}</div></div>
              <div><div className="text-xs text-muted-foreground">Monthly Deduction</div><div className="tabular-nums">{formatINR(r.monthly_deduction)}</div></div>
              <div><div className="text-xs text-muted-foreground">Recovery From</div><div>{formatDate(r.recovery_start_month)}</div></div>
            </div>
            {r.reason && <div className="text-sm bg-app-surface p-2 rounded">Reason: {r.reason}</div>}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Textarea placeholder="Rejection reason (10–200 chars, required only when rejecting)" value={reasons[r.id]||""} onChange={e => setReasons({ ...reasons, [r.id]: e.target.value })} rows={2} maxLength={200} />
              </div>
              <Button onClick={() => approve(r.id)} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-1" /> Approve</Button>
              <Button onClick={() => reject(r.id)} variant="destructive"><X className="h-4 w-4 mr-1" /> Reject</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
