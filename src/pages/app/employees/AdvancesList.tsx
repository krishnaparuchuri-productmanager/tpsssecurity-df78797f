import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import { toast } from "sonner";

interface Row {
  id: string; advance_number: string; advance_type: string;
  total_amount: number; amount_remaining: number; monthly_deduction: number;
  status: string; advance_date: string;
  employee: { full_name: string; employee_code: string } | null;
  client: { client_name: string } | null;
}
const STATUS_COLORS: Record<string,string> = {
  pending: "bg-yellow-100 text-yellow-900",
  active: "bg-blue-100 text-blue-900",
  fully_recovered: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
  cancelled: "bg-gray-100 text-gray-900",
  approved: "bg-green-100 text-green-900",
};
export default function AdvancesList() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    const { data } = await supabase.from("employee_advances")
      .select("id, advance_number, advance_type, total_amount, amount_remaining, monthly_deduction, status, advance_date, employee:employees(full_name, employee_code), client:clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); }, [isSandbox]);

  async function cancel(id: string) {
    if (!confirm("Cancel this pending advance?")) return;
    const { error } = await supabase.rpc("cancel_advance", { _id: id } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Cancelled"); load();
  }

  const filtered = rows.filter(r => statusFilter === "all" || r.status === statusFilter);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Advances</h1>
        <Link to="/app/employees/advances/new"><Button className="bg-app-navy"><Plus className="h-4 w-4 mr-2" /> New Advance</Button></Link>
      </div>
      <div className="flex gap-2 flex-wrap">
        {["all","pending","active","fully_recovered","rejected","cancelled"].map(s => (
          <Button key={s} size="sm" variant={statusFilter===s?"default":"outline"} onClick={()=>setStatusFilter(s)}>{s}</Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-app-surface text-left">
              <tr>
                <th className="p-2">Adv No</th><th className="p-2">Employee</th><th className="p-2">Client</th>
                <th className="p-2">Type</th><th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Remaining</th><th className="p-2 text-right">Monthly</th>
                <th className="p-2">Date</th><th className="p-2">Status</th><th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No advances</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.advance_number}</td>
                  <td className="p-2">{r.employee?.full_name}</td>
                  <td className="p-2">{r.client?.client_name ?? "—"}</td>
                  <td className="p-2">{r.advance_type.replace("_"," ")}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(r.total_amount)}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(r.amount_remaining)}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(r.monthly_deduction)}</td>
                  <td className="p-2">{formatDate(r.advance_date)}</td>
                  <td className="p-2"><Badge className={STATUS_COLORS[r.status]||""}>{r.status}</Badge></td>
                  <td className="p-2">
                    {r.status === "pending" && <Button size="sm" variant="outline" onClick={()=>cancel(r.id)}>Cancel</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
