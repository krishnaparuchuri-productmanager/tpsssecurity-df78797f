import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatINR } from "@/lib/format";

interface Row {
  id: string; voucher_number: string; entry_date: string; entry_type: string;
  category: string; particulars: string; debit_amount: number; credit_amount: number;
  clients: { client_name: string } | null;
}

export default function CashBook() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    let q = supabase.from("financial_ledger")
      .select("id, voucher_number, entry_date, entry_type, category, particulars, debit_amount, credit_amount, clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);
    q.order("entry_date", { ascending: true }).then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [isSandbox, from, to]);

  const { totalCredit, totalDebit, withBalance } = useMemo(() => {
    let bal = 0; let c = 0; let d = 0;
    const out = rows.map((r) => {
      bal += Number(r.credit_amount) - Number(r.debit_amount);
      c += Number(r.credit_amount); d += Number(r.debit_amount);
      return { ...r, balance: bal };
    });
    return { totalCredit: c, totalDebit: d, withBalance: out };
  }, [rows]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Cash Book</h1>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Credits" value={formatINR(totalCredit)} color="text-green-700" />
        <Stat label="Total Debits" value={formatINR(totalDebit)} color="text-red-700" />
        <Stat label="Net Balance" value={formatINR(totalCredit - totalDebit)} color="text-app-navy" />
      </div>
      <div className="flex gap-3 items-end">
        <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-2">Date</th><th className="p-2">Voucher</th>
              <th className="p-2">Particulars</th><th className="p-2">Client</th>
              <th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th>
              <th className="p-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {withBalance.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No ledger entries</td></tr>
            ) : withBalance.map((r) => (
              <tr key={r.id} className="border-t border-app-border">
                <td className="p-2">{formatDate(r.entry_date)}</td>
                <td className="p-2 font-mono text-xs">{r.voucher_number}</td>
                <td className="p-2">{r.particulars}</td>
                <td className="p-2">{r.clients?.client_name ?? "—"}</td>
                <td className="p-2 text-right tabular-nums text-red-600">{Number(r.debit_amount) > 0 ? formatINR(Number(r.debit_amount)) : "—"}</td>
                <td className="p-2 text-right tabular-nums text-green-700">{Number(r.credit_amount) > 0 ? formatINR(Number(r.credit_amount)) : "—"}</td>
                <td className="p-2 text-right tabular-nums font-semibold">{formatINR(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="border-app-border">
      <CardContent className="p-4">
        <div className="text-xs text-app-muted">{label}</div>
        <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
