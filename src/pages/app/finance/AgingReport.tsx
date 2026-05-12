import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR } from "@/lib/format";

interface Inv {
  id: string; invoice_number: string; invoice_date: string; due_date: string | null;
  outstanding_amount: number; client_id: string;
  clients: { client_name: string } | null;
}

interface Bucket { current: number; b1_30: number; b31_60: number; b61_90: number; b90_plus: number; total: number; }
interface Row extends Bucket { client_id: string; client_name: string; }

const todayStr = new Date().toISOString().slice(0, 10);

function bucketize(invs: Inv[], asOf: string): Row[] {
  const map = new Map<string, Row>();
  invs.forEach((i) => {
    const out = Number(i.outstanding_amount);
    if (out <= 0) return;
    const cn = i.clients?.client_name ?? "—";
    if (!map.has(i.client_id)) map.set(i.client_id, {
      client_id: i.client_id, client_name: cn,
      current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0,
    });
    const row = map.get(i.client_id)!;
    const ref = i.due_date ?? i.invoice_date;
    const days = Math.floor((new Date(asOf).getTime() - new Date(ref).getTime()) / 86400000);
    if (days <= 0) row.current += out;
    else if (days <= 30) row.b1_30 += out;
    else if (days <= 60) row.b31_60 += out;
    else if (days <= 90) row.b61_90 += out;
    else row.b90_plus += out;
    row.total += out;
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function AgingReport() {
  const { isSandbox } = useEnvironment();
  const [asOf, setAsOf] = useState(todayStr);
  const [invs, setInvs] = useState<Inv[]>([]);

  useEffect(() => {
    supabase.from("invoices")
      .select("id, invoice_number, invoice_date, due_date, outstanding_amount, client_id, clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false).neq("status", "cancelled").gt("outstanding_amount", 0)
      .lte("invoice_date", asOf)
      .then(({ data }) => setInvs((data ?? []) as unknown as Inv[]));
  }, [isSandbox, asOf]);

  const rows = useMemo(() => bucketize(invs, asOf), [invs, asOf]);
  const totals = useMemo(() => rows.reduce((acc, r) => ({
    current: acc.current + r.current, b1_30: acc.b1_30 + r.b1_30, b31_60: acc.b31_60 + r.b31_60,
    b61_90: acc.b61_90 + r.b61_90, b90_plus: acc.b90_plus + r.b90_plus, total: acc.total + r.total,
  }), { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 } as Bucket), [rows]);

  function exportExcel() {
    const data = rows.map((r) => ({
      Client: r.client_name, "Current": r.current, "1-30 days": r.b1_30, "31-60 days": r.b31_60,
      "61-90 days": r.b61_90, "90+ days": r.b90_plus, "Total Outstanding": r.total,
    }));
    data.push({ Client: "TOTAL", "Current": totals.current, "1-30 days": totals.b1_30, "31-60 days": totals.b31_60,
      "61-90 days": totals.b61_90, "90+ days": totals.b90_plus, "Total Outstanding": totals.total });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Aging");
    XLSX.writeFile(wb, `Aging_${asOf}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Receivables Aging Report</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>As of</Label><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
            <div className="ml-auto"><Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export</Button></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">Current</div><div className="font-bold tabular-nums">{formatINR(totals.current)}</div></div>
            <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">1-30</div><div className="font-bold tabular-nums">{formatINR(totals.b1_30)}</div></div>
            <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">31-60</div><div className="font-bold tabular-nums text-yellow-700">{formatINR(totals.b31_60)}</div></div>
            <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">61-90</div><div className="font-bold tabular-nums text-orange-700">{formatINR(totals.b61_90)}</div></div>
            <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">90+</div><div className="font-bold tabular-nums text-red-700">{formatINR(totals.b90_plus)}</div></div>
          </div>

          <Table>
            <TableHeader><TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">1-30</TableHead>
              <TableHead className="text-right">31-60</TableHead>
              <TableHead className="text-right">61-90</TableHead>
              <TableHead className="text-right">90+</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-app-muted">No outstanding invoices</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.client_id}>
                  <TableCell className="font-medium">{r.client_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.current)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.b1_30)}</TableCell>
                  <TableCell className="text-right tabular-nums text-yellow-700">{formatINR(r.b31_60)}</TableCell>
                  <TableCell className="text-right tabular-nums text-orange-700">{formatINR(r.b61_90)}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-700">{formatINR(r.b90_plus)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatINR(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">TOTAL</TableCell>
                <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.current)}</TableCell>
                <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.b1_30)}</TableCell>
                <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.b31_60)}</TableCell>
                <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.b61_90)}</TableCell>
                <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.b90_plus)}</TableCell>
                <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
