import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatINR, formatDate } from "@/lib/format";
import { Check } from "lucide-react";

export default function FfsApprovals() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<any[]>([]);
  const [payments, setPayments] = useState<Record<string, { date: string; mode: string; ref: string }>>({});

  async function load() {
    const { data } = await supabase.from("employee_ffs")
      .select("id, ffs_number, net_payable, relieving_date, total_earnings, total_deductions_ffs, employee:employees(full_name), client:clients(client_name)")
      .eq("status","submitted").eq("is_sandbox", isSandbox).eq("is_deleted", false);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [isSandbox]);

  async function approve(id: string, withPayment: boolean) {
    const p = payments[id];
    const payment = withPayment && p?.date ? { payment_date: p.date, payment_mode: p.mode, payment_reference: p.ref } : null;
    const { error } = await supabase.rpc("approve_ffs", { _id: id, _payment: payment } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Approved"); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">FFS Approvals ({rows.length})</h1>
      {rows.length === 0 && <p className="text-muted-foreground">No pending FFS.</p>}
      {rows.map(r => (
        <Card key={r.id}>
          <CardHeader><CardTitle className="text-base">{r.ffs_number} — {r.employee?.full_name}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><div className="text-xs text-muted-foreground">Client</div>{r.client?.client_name ?? "—"}</div>
              <div><div className="text-xs text-muted-foreground">Relieving</div>{formatDate(r.relieving_date)}</div>
              <div><div className="text-xs text-muted-foreground">Earnings</div><span className="tabular-nums">{formatINR(r.total_earnings)}</span></div>
              <div><div className="text-xs text-muted-foreground">Net Payable</div><span className="font-bold tabular-nums">{formatINR(r.net_payable)}</span></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div><Label className="text-xs">Payment Date</Label><Input type="date" value={payments[r.id]?.date ?? ""} onChange={e=>setPayments({...payments,[r.id]:{...payments[r.id], date:e.target.value, mode:payments[r.id]?.mode??"NEFT", ref:payments[r.id]?.ref??""}})} /></div>
              <div><Label className="text-xs">Mode</Label><Input value={payments[r.id]?.mode ?? "NEFT"} onChange={e=>setPayments({...payments,[r.id]:{...payments[r.id], mode:e.target.value, date:payments[r.id]?.date??"", ref:payments[r.id]?.ref??""}})} /></div>
              <div><Label className="text-xs">Reference</Label><Input value={payments[r.id]?.ref ?? ""} onChange={e=>setPayments({...payments,[r.id]:{...payments[r.id], ref:e.target.value, date:payments[r.id]?.date??"", mode:payments[r.id]?.mode??"NEFT"}})} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={()=>approve(r.id, false)} variant="outline"><Check className="h-4 w-4 mr-1" /> Approve only</Button>
              <Button onClick={()=>approve(r.id, true)} className="bg-green-600 hover:bg-green-700"><Check className="h-4 w-4 mr-1" /> Approve & Mark Paid</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
