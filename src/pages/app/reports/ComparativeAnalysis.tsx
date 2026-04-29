import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR } from "@/lib/format";
import { activity } from "@/lib/activity";

const METRICS = ["billing", "received", "outstanding", "employees", "epf", "esi", "net_salary", "expenses"];
const LABEL: Record<string, string> = {
  billing: "Billing", received: "Received", outstanding: "Outstanding", employees: "Employee Count",
  epf: "EPF (Total)", esi: "ESI (Total)", net_salary: "Net Salary", expenses: "Total Expenses",
};

interface MetricRow { metric: string; a: number; b: number; }

function ymToFirstDay(ym: string): string {
  return `${ym}-01`;
}

export default function ComparativeAnalysis() {
  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const [monthA, setMonthA] = useState(prevMonth);
  const [monthB, setMonthB] = useState(thisMonth);
  const [branchId, setBranchId] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; client_name: string }[]>([]);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("branches").select("id, branch_name").eq("is_deleted", false).order("branch_name")
      .then(({ data }) => setBranches((data ?? []) as never));
    supabase.from("clients").select("id, client_name").eq("is_deleted", false).order("client_name")
      .then(({ data }) => setClients((data ?? []) as never));
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const result: MetricRow[] = [];
      for (const m of METRICS) {
        const { data } = await supabase.rpc("mom_metric_series", {
          _metric: m,
          _branch_id: branchId === "all" ? null : branchId,
          _client_id: clientId === "all" ? null : clientId,
          _months: 24,
        });
        const series = (data ?? []) as Array<{ month_start: string; value: number }>;
        const a = series.find((r) => r.month_start === ymToFirstDay(monthA))?.value ?? 0;
        const b = series.find((r) => r.month_start === ymToFirstDay(monthB))?.value ?? 0;
        result.push({ metric: m, a: Number(a), b: Number(b) });
      }
      // Net Margin = billing - expenses (rough)
      const billing = result.find((r) => r.metric === "billing")!;
      const expenses = result.find((r) => r.metric === "expenses")!;
      result.push({ metric: "net_margin", a: billing.a - expenses.a, b: billing.b - expenses.b });
      setRows(result);
      setLoading(false);
    })();
  }, [monthA, monthB, branchId, clientId]);

  function diffPct(a: number, b: number) {
    if (a === 0) return b === 0 ? 0 : null;
    return ((b - a) / Math.abs(a)) * 100;
  }

  function exportExcel() {
    const out = rows.map((r) => {
      const d = r.b - r.a;
      const p = diffPct(r.a, r.b);
      return {
        Metric: r.metric === "net_margin" ? "Net Margin" : LABEL[r.metric],
        [`Month A (${monthA})`]: r.a,
        [`Month B (${monthB})`]: r.b,
        Difference: d,
        "% Change": p === null ? "" : `${p.toFixed(1)}%`,
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), "Comparative");
    const fname = `Comparative_${monthA}_vs_${monthB}.xlsx`;
    XLSX.writeFile(wb, fname);
    activity.export(fname, "excel");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Comparative Analysis</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>Month A</Label><Input type="month" value={monthA} onChange={(e) => setMonthA(e.target.value)} /></div>
            <div><Label>Month B</Label><Input type="month" value={monthB} onChange={(e) => setMonthB(e.target.value)} /></div>
            <div className="min-w-[160px]"><Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]"><Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export Excel</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Side-by-side</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Month A ({monthA})</TableHead>
              <TableHead className="text-right">Month B ({monthB})</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead className="text-right">% Change</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center text-app-muted">Loading…</TableCell></TableRow>}
              {!loading && rows.map((r) => {
                const d = r.b - r.a;
                const p = diffPct(r.a, r.b);
                const highlight = p !== null && Math.abs(p) > 10 ? "bg-yellow-50" : "";
                const cls = d > 0 ? "text-green-700" : d < 0 ? "text-red-700" : "";
                return (
                  <TableRow key={r.metric} className={highlight}>
                    <TableCell className="font-medium">{r.metric === "net_margin" ? "Net Margin" : LABEL[r.metric]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(r.a)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(r.b)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${cls}`}>{formatINR(d)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${cls}`}>{p === null ? "—" : `${p.toFixed(1)}%`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
