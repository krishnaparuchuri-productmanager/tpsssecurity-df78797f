import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  partially_paid: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-200 text-gray-500 line-through",
};

interface Row {
  id: string; invoice_number: string; invoice_date: string; due_date: string | null;
  month: string; total_invoice_value: number; outstanding_amount: number; status: string;
  clients: { client_name: string } | null;
}

export default function InvoicesList() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.from("invoices")
      .select("id, invoice_number, invoice_date, due_date, month, total_invoice_value, outstanding_amount, status, clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("invoice_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [isSandbox]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Invoices</h1>
        <Link to="/app/invoices/new">
          <Button className="bg-app-navy text-white"><Plus className="h-4 w-4 mr-1" /> Create Invoice</Button>
        </Link>
      </div>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-2">Invoice #</th><th className="p-2">Date</th><th className="p-2">Client</th>
              <th className="p-2">Month</th>
              <th className="p-2 text-right">Total</th><th className="p-2 text-right">Outstanding</th>
              <th className="p-2">Status</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No invoices yet</td></tr>
            ) : rows.map((r) => {
              const overdue = r.due_date && r.due_date < today && Number(r.outstanding_amount) > 0;
              const status = overdue && r.status !== "paid" ? "overdue" : r.status;
              return (
                <tr key={r.id} className="border-t border-app-border">
                  <td className="p-2 font-mono text-xs">{r.invoice_number}</td>
                  <td className="p-2">{formatDate(r.invoice_date)}</td>
                  <td className="p-2">{r.clients?.client_name ?? "—"}</td>
                  <td className="p-2">{r.month}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(Number(r.total_invoice_value))}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(Number(r.outstanding_amount))}</td>
                  <td className="p-2"><Badge className={STATUS_BADGE[status]}>{status}</Badge></td>
                  <td className="p-2">
                    <Link to={`/app/invoices/${r.id}/view`}><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
