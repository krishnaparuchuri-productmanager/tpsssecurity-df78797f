import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, ArrowUp, ArrowDown, Minus } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR } from "@/lib/format";
import { activity } from "@/lib/activity";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { addExcelBranding } from "@/lib/excelBranding";

const METRICS = [
  { value: "billing", label: "Billing" },
  { value: "received", label: "Received" },
  { value: "outstanding", label: "Outstanding" },
  { value: "employees", label: "Employees" },
  { value: "epf", label: "EPF (Total)" },
  { value: "esi", label: "ESI (Total)" },
  { value: "net_salary", label: "Net Salary" },
  { value: "expenses", label: "Expenses" },
];

interface SeriesRow { month_label: string; month_start: string; value: number; }

export default function MomAnalysis() {
  const { role } = useAuth();
  const company = useCompanyProfile();
  const canExport = role === "ceo_admin" || role === "coo_ops";
  const [metric, setMetric] = useState("billing");
  const [branchId, setBranchId] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; client_name: string }[]>([]);
  const [data, setData] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("branches").select("id, branch_name").eq("is_deleted", false).order("branch_name")
      .then(({ data }) => setBranches((data ?? []) as never));
    supabase.from("clients").select("id, client_name").eq("is_deleted", false).order("client_name")
      .then(({ data }) => setClients((data ?? []) as never));
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase.rpc("mom_metric_series", {
      _metric: metric,
      _branch_id: branchId === "all" ? null : branchId,
      _client_id: clientId === "all" ? null : clientId,
      _months: 12,
    }).then(({ data }) => {
      setData(((data ?? []) as SeriesRow[]).map((r) => ({ ...r, value: Number(r.value) })));
      setLoading(false);
    });
  }, [metric, branchId, clientId]);

  const tableRows = useMemo(() => data.map((r, i) => {
    const prev = i > 0 ? data[i - 1].value : null;
    const change = prev === null ? null : r.value - prev;
    const pct = prev && prev !== 0 ? (change! / prev) * 100 : null;
    return { ...r, change, pct };
  }), [data]);

  function exportExcel() {
    const rows = tableRows.map((r) => ({
      Month: r.month_label, Value: r.value,
      "Change (₹)": r.change ?? "", "Change (%)": r.pct === null ? "" : `${r.pct.toFixed(1)}%`,
    }));
    const wsMom = XLSX.utils.json_to_sheet(rows);
    if (company) addExcelBranding(wsMom, company);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMom, "MoM");
    const fname = `MoM_${metric}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fname);
    activity.export(fname, "excel");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Month-on-Month Analysis</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[160px]"><Label>Metric</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]"><Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]"><Label>Client (optional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canExport && <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export Excel</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Last 12 months — {METRICS.find((m) => m.value === metric)?.label}</CardTitle></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="value" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Detail</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Month</TableHead><TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Change (₹)</TableHead><TableHead className="text-right">Change (%)</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={4} className="text-center text-app-muted">Loading…</TableCell></TableRow>}
              {!loading && tableRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-app-muted">No data</TableCell></TableRow>}
              {tableRows.map((r) => {
                const sign = r.change === null ? 0 : r.change > 0 ? 1 : r.change < 0 ? -1 : 0;
                const cls = sign > 0 ? "text-green-700" : sign < 0 ? "text-red-700" : "text-app-muted";
                const Icon = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus;
                return (
                  <TableRow key={r.month_start}>
                    <TableCell>{r.month_label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(r.value)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${cls}`}>
                      {r.change === null ? "—" : <span className="inline-flex items-center justify-end gap-1"><Icon className="h-3 w-3" />{formatINR(Math.abs(r.change))}</span>}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${cls}`}>{r.pct === null ? "—" : `${r.pct.toFixed(1)}%`}</TableCell>
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
