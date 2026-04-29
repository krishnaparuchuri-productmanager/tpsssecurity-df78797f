import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR } from "@/lib/format";
import { Eye } from "lucide-react";

interface Row {
  id: string; receipt_number: string; payment_date: string; amount: number;
  payment_mode: string; reference_number: string | null;
  clients: { client_name: string } | null;
  invoices: { invoice_number: string } | null;
}

export default function ReceiptsList() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.from("payments")
      .select("id, receipt_number, payment_date, amount, payment_mode, reference_number, clients(client_name), invoices(invoice_number)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("payment_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [isSandbox]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Receipts</h1>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-2">Receipt #</th><th className="p-2">Date</th><th className="p-2">Client</th>
              <th className="p-2">Invoice</th><th className="p-2">Mode</th><th className="p-2">Reference</th>
              <th className="p-2 text-right">Amount</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No receipts yet</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-app-border">
                <td className="p-2 font-mono text-xs">{r.receipt_number}</td>
                <td className="p-2">{formatDate(r.payment_date)}</td>
                <td className="p-2">{r.clients?.client_name ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{r.invoices?.invoice_number ?? "—"}</td>
                <td className="p-2">{r.payment_mode}</td>
                <td className="p-2">{r.reference_number ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(Number(r.amount))}</td>
                <td className="p-2"><Link to={`/app/finance/receipts/${r.id}`}><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
