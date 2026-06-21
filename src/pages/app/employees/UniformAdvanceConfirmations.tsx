import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatINR, formatDate } from "@/lib/format";
import { Check } from "lucide-react";

interface ConfRow {
  id: string;
  paysheet_id: string;
  employee_id: string;
  employee_name: string;
  client_name: string | null;
  month: string;
  month_date: string;
  deduction_amount: number;
  balance_before: number | null;
  balance_after: number | null;
  status: string;
  confirmed_at: string | null;
  employee: { uniform_advance_balance: number } | null;
}

export default function UniformAdvanceConfirmations() {
  const { isSandbox } = useEnvironment();
  const { role } = useAuth();
  const [allRows, setAllRows] = useState<ConfRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [confirming, setConfirming] = useState<string | null>(null);

  const canConfirm = role === "ceo_admin" || role === "coo_ops" || role === "accountant";

  async function load() {
    const { data, error } = await (supabase as any)
      .from("uniform_advance_confirmations")
      .select("*, employee:employees(uniform_advance_balance)")
      .eq("is_sandbox", isSandbox)
      .order("month_date", { ascending: false })
      .order("employee_name");
    if (error) { toast.error(error.message); return; }
    setAllRows((data ?? []) as ConfRow[]);
  }

  useEffect(() => { load(); }, [isSandbox]);

  const months = [
    ...new Map(allRows.map(r => [r.month, r.month_date])).entries(),
  ].sort((a, b) => b[1].localeCompare(a[1])).map(([m]) => m);

  const rows = selectedMonth === "all" ? allRows : allRows.filter(r => r.month === selectedMonth);
  const pendingCount = rows.filter(r => r.status === "pending").length;

  async function confirm(id: string) {
    setConfirming(id);
    const { error } = await (supabase as any).rpc("confirm_uniform_advance", { _id: id });
    setConfirming(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Confirmed — employee balance updated");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-app-navy">Uniform Advance Confirmations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Confirm paysheet deductions to reduce employee uniform advance balances
          </p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 font-medium">
          {pendingCount} deduction{pendingCount !== 1 ? "s" : ""} pending confirmation
        </div>
      )}

      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-2">Employee</th>
              <th className="p-2">Site</th>
              <th className="p-2">Month</th>
              <th className="p-2 text-right">Deduction</th>
              <th className="p-2 text-right">Bal. Before</th>
              <th className="p-2 text-right">Bal. After</th>
              <th className="p-2">Status</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No records found</td></tr>
            )}
            {rows.map(r => {
              const curBal = Number(r.employee?.uniform_advance_balance ?? 0);
              const previewAfter = Math.max(0, curBal - Number(r.deduction_amount));
              const isPending = r.status === "pending";
              return (
                <tr key={r.id} className={`border-t border-app-border ${isPending ? "" : "bg-green-50/30"}`}>
                  <td className="p-2 font-medium">{r.employee_name}</td>
                  <td className="p-2 text-muted-foreground text-xs">{r.client_name ?? "—"}</td>
                  <td className="p-2">{r.month}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{formatINR(Number(r.deduction_amount))}</td>
                  <td className="p-2 text-right tabular-nums">
                    {isPending ? formatINR(curBal) : formatINR(Number(r.balance_before ?? 0))}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {isPending
                      ? <span className="text-amber-700">{formatINR(previewAfter)} *</span>
                      : <span className="text-green-700 font-semibold">{formatINR(Number(r.balance_after ?? 0))}</span>
                    }
                  </td>
                  <td className="p-2">
                    {isPending
                      ? <Badge variant="outline" className="border-amber-400 text-amber-700 text-xs">Pending</Badge>
                      : <div>
                          <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">Confirmed</Badge>
                          {r.confirmed_at && <div className="text-[10px] text-muted-foreground mt-0.5">{formatDate(r.confirmed_at)}</div>}
                        </div>
                    }
                  </td>
                  <td className="p-2">
                    {isPending && canConfirm && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                        disabled={confirming === r.id}
                        onClick={() => confirm(r.id)}
                      >
                        <Check className="h-3 w-3 mr-1" /> Confirm
                      </Button>
                    )}
                    {isPending && !canConfirm && (
                      <span className="text-xs text-muted-foreground">Awaiting accountant</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.some(r => r.status === "pending") && (
        <p className="text-xs text-muted-foreground">* Preview — balance applied upon confirmation</p>
      )}
    </div>
  );
}
