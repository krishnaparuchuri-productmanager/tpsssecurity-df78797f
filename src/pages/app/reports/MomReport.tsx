import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { addExcelBranding } from "@/lib/excelBranding";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { formatINR } from "@/lib/format";

const INCOME_CATS = ["client_billing", "payment_received", "other_income"];
const EXPENSE_CATS = [
  "staff_salary", "epf_payment", "esi_payment", "gst_payment", "pt_payment",
  "salary_advance", "admin_expense", "vehicle_expense", "other_expense",
];
const CAT_LABEL: Record<string, string> = {
  client_billing: "Client Billing",
  payment_received: "Payments Received",
  other_income: "Other Income",
  staff_salary: "Staff Salaries",
  epf_payment: "EPF",
  esi_payment: "ESI",
  gst_payment: "GST",
  pt_payment: "PT",
  salary_advance: "Salary Advances",
  admin_expense: "Admin",
  vehicle_expense: "Vehicle",
  other_expense: "Other",
};

type Metric = "revenue" | "expense" | "net" | "payroll" | "collections" | "invoicing";

function ymToday(offsetMonths = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(fromYM: string, toYM: string): string[] {
  const out: string[] = [];
  const [fy, fm] = fromYM.split("-").map(Number);
  const [ty, tm] = toYM.split("-").map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
    if (out.length > 60) break;
  }
  return out;
}

function ymLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", { month: "short" }) + " " + y.slice(2);
}

function ymStart(ym: string) { return `${ym}-01`; }
function ymEnd(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

interface Client { id: string; client_name: string }

export default function MomReport() {
  const { isSandbox } = useEnvironment();
  const company = useCompanyProfile();
  const [fromYM, setFromYM] = useState(ymToday(-11));
  const [toYM, setToYM] = useState(ymToday(0));
  const [metric, setMetric] = useState<Metric>("revenue");
  const [clientId, setClientId] = useState<string>("all");
  const [clients, setClients] = useState<Client[]>([]);

  const [ledger, setLedger] = useState<Array<{ entry_date: string; category: string; debit_amount: number; credit_amount: number; client_id: string | null }>>([]);
  const [paysheets, setPaysheets] = useState<Array<{ total_net_salary: number; month_date: string; status: string; client_id: string }>>([]);
  const [payments, setPayments] = useState<Array<{ amount: number; payment_date: string; client_id: string }>>([]);
  const [invoices, setInvoices] = useState<Array<{ total_invoice_value: number; invoice_date: string; client_id: string }>>([]);

  useEffect(() => {
    supabase.from("clients")
      .select("id, client_name")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false).eq("is_active", true)
      .order("client_name")
      .then(({ data }) => setClients((data ?? []) as Client[]));
  }, [isSandbox]);

  useEffect(() => {
    const start = ymStart(fromYM);
    const end = ymEnd(toYM);
    const lq = supabase.from("financial_ledger")
      .select("entry_date, category, debit_amount, credit_amount, client_id")
      .gte("entry_date", start).lte("entry_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);
    const psq = supabase.from("paysheets")
      .select("total_net_salary, month_date, status, client_id")
      .gte("month_date", start).lte("month_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);
    const pq = supabase.from("payments")
      .select("amount, payment_date, client_id")
      .gte("payment_date", start).lte("payment_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);
    const iq = supabase.from("invoices")
      .select("total_invoice_value, invoice_date, client_id")
      .gte("invoice_date", start).lte("invoice_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false).neq("status", "cancelled");
    Promise.all([lq, psq, pq, iq]).then(([l, ps, p, i]) => {
      const filt = (rows: Array<Record<string, unknown>>) =>
        clientId === "all" ? rows : rows.filter((r) => r.client_id === clientId);
      setLedger(filt((l.data ?? []) as Array<Record<string, unknown>>) as typeof ledger);
      setPaysheets(filt((ps.data ?? []) as Array<Record<string, unknown>>) as typeof paysheets);
      setPayments(filt((p.data ?? []) as Array<Record<string, unknown>>) as typeof payments);
      setInvoices(filt((i.data ?? []) as Array<Record<string, unknown>>) as typeof invoices);
    });
  }, [fromYM, toYM, isSandbox, clientId]);

  const months = useMemo(() => monthsBetween(fromYM, toYM), [fromYM, toYM]);

  // Build category × month grid
  const grid = useMemo(() => {
    const cats = [...INCOME_CATS, ...EXPENSE_CATS];
    const m: Record<string, Record<string, number>> = {};
    cats.forEach((c) => { m[c] = {}; months.forEach((mm) => (m[c][mm] = 0)); });
    ledger.forEach((r) => {
      const k = r.entry_date.slice(0, 7);
      if (!m[r.category] || !(k in m[r.category])) return;
      if (INCOME_CATS.includes(r.category)) m[r.category][k] += Number(r.credit_amount);
      else if (EXPENSE_CATS.includes(r.category)) m[r.category][k] += Number(r.debit_amount);
    });
    return m;
  }, [ledger, months]);

  const totals = useMemo(() => {
    const income: Record<string, number> = {};
    const expense: Record<string, number> = {};
    months.forEach((mm) => {
      income[mm] = INCOME_CATS.reduce((s, c) => s + (grid[c]?.[mm] ?? 0), 0);
      expense[mm] = EXPENSE_CATS.reduce((s, c) => s + (grid[c]?.[mm] ?? 0), 0);
    });
    return { income, expense };
  }, [grid, months]);

  const trendSeries = useMemo(() => {
    const psMap: Record<string, number> = {};
    paysheets.filter((p) => p.status === "approved").forEach((p) => {
      const k = (p.month_date ?? "").slice(0, 7);
      psMap[k] = (psMap[k] ?? 0) + Number(p.total_net_salary || 0);
    });
    const payMap: Record<string, number> = {};
    payments.forEach((p) => {
      const k = p.payment_date.slice(0, 7);
      payMap[k] = (payMap[k] ?? 0) + Number(p.amount || 0);
    });
    const invMap: Record<string, number> = {};
    invoices.forEach((i) => {
      const k = i.invoice_date.slice(0, 7);
      invMap[k] = (invMap[k] ?? 0) + Number(i.total_invoice_value || 0);
    });
    return months.map((mm) => {
      const income = totals.income[mm];
      const expense = totals.expense[mm];
      let value = 0;
      switch (metric) {
        case "revenue": value = income; break;
        case "expense": value = expense; break;
        case "net": value = income - expense; break;
        case "payroll": value = psMap[mm] ?? 0; break;
        case "collections": value = payMap[mm] ?? 0; break;
        case "invoicing": value = invMap[mm] ?? 0; break;
      }
      return { month: ymLabel(mm), value };
    });
  }, [metric, months, totals, paysheets, payments, invoices]);

  const topMovers = useMemo(() => {
    if (months.length < 2) return [];
    const last = months[months.length - 1];
    const prev = months[months.length - 2];
    const cats = [...INCOME_CATS, ...EXPENSE_CATS];
    return cats.map((c) => {
      const a = grid[c]?.[prev] ?? 0;
      const b = grid[c]?.[last] ?? 0;
      const delta = b - a;
      const pct = a === 0 ? (b === 0 ? 0 : 100) : ((b - a) / Math.abs(a)) * 100;
      return { category: CAT_LABEL[c] ?? c, prev: a, last: b, delta, pct };
    })
      .filter((r) => r.prev !== 0 || r.last !== 0)
      .sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct))
      .slice(0, 3);
  }, [grid, months]);

  function pct(prev: number, cur: number) {
    if (prev === 0) return cur === 0 ? "—" : "+100%";
    const v = ((cur - prev) / Math.abs(prev)) * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  }

  function exportExcel() {
    const header = ["Category", ...months.map(ymLabel), "Total"];
    const rows: Array<Array<string | number>> = [header];
    const pushSection = (title: string, cats: string[]) => {
      rows.push([title]);
      cats.forEach((c) => {
        const vals = months.map((mm) => grid[c]?.[mm] ?? 0);
        const tot = vals.reduce((a, b) => a + b, 0);
        rows.push([CAT_LABEL[c] ?? c, ...vals, tot]);
      });
    };
    pushSection("INCOME", INCOME_CATS);
    rows.push(["Total Income", ...months.map((mm) => totals.income[mm]), months.reduce((s, mm) => s + totals.income[mm], 0)]);
    pushSection("EXPENSES", EXPENSE_CATS);
    rows.push(["Total Expenses", ...months.map((mm) => totals.expense[mm]), months.reduce((s, mm) => s + totals.expense[mm], 0)]);
    rows.push(["Net", ...months.map((mm) => totals.income[mm] - totals.expense[mm]),
      months.reduce((s, mm) => s + totals.income[mm] - totals.expense[mm], 0)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (company) addExcelBranding(ws, company);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MoM Analysis");
    XLSX.writeFile(wb, `MoM_${fromYM}_to_${toYM}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-app-navy">Month-on-Month Analysis</h1>
        <Button variant="outline" onClick={exportExcel}>
          <Download className="h-4 w-4 mr-1" /> Export Excel
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div><Label>From</Label><Input type="month" value={fromYM} onChange={(e) => setFromYM(e.target.value)} /></div>
        <div><Label>To</Label><Input type="month" value={toYM} onChange={(e) => setToYM(e.target.value)} /></div>
        <div>
          <Label>Trend metric</Label>
          <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="net">Net</SelectItem>
              <SelectItem value="payroll">Payroll</SelectItem>
              <SelectItem value="collections">Collections</SelectItem>
              <SelectItem value="invoicing">Invoicing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base capitalize">{metric} trend</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`)} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#0A1628" strokeWidth={2} name={metric} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top movers (latest vs previous month)</CardTitle></CardHeader>
        <CardContent>
          {topMovers.length === 0 ? (
            <div className="text-sm text-muted-foreground">Not enough data.</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3">
              {topMovers.map((t) => (
                <div key={t.category} className="border border-app-border rounded-md p-3">
                  <div className="text-sm font-medium text-app-navy">{t.category}</div>
                  <div className="text-xs text-muted-foreground">Prev {formatINR(t.prev)} → Last {formatINR(t.last)}</div>
                  <div className={`text-lg font-bold ${t.delta >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {t.delta >= 0 ? "+" : ""}{t.pct.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-navy text-white">
            <tr>
              <th className="p-2 text-left sticky left-0 bg-app-navy">Category</th>
              {months.map((mm) => <th key={mm} className="p-2 text-right whitespace-nowrap">{ymLabel(mm)}</th>)}
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-right">MoM Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-green-50"><td className="p-2 font-semibold" colSpan={months.length + 3}>INCOME</td></tr>
            {INCOME_CATS.map((c) => {
              const vals = months.map((mm) => grid[c]?.[mm] ?? 0);
              const total = vals.reduce((a, b) => a + b, 0);
              const last = vals[vals.length - 1] ?? 0;
              const prev = vals[vals.length - 2] ?? 0;
              return (
                <tr key={c} className="border-t border-app-border">
                  <td className="p-2 sticky left-0 bg-white">{CAT_LABEL[c]}</td>
                  {vals.map((v, i) => <td key={i} className="p-2 text-right tabular-nums">{formatINR(v)}</td>)}
                  <td className="p-2 text-right tabular-nums font-semibold">{formatINR(total)}</td>
                  <td className={`p-2 text-right tabular-nums ${last - prev >= 0 ? "text-green-700" : "text-red-700"}`}>{pct(prev, last)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-app-navy font-bold bg-green-50">
              <td className="p-2 sticky left-0 bg-green-50">Total Income</td>
              {months.map((mm) => <td key={mm} className="p-2 text-right tabular-nums">{formatINR(totals.income[mm])}</td>)}
              <td className="p-2 text-right tabular-nums">{formatINR(months.reduce((s, mm) => s + totals.income[mm], 0))}</td>
              <td className="p-2"></td>
            </tr>

            <tr className="bg-red-50"><td className="p-2 font-semibold" colSpan={months.length + 3}>EXPENSES</td></tr>
            {EXPENSE_CATS.map((c) => {
              const vals = months.map((mm) => grid[c]?.[mm] ?? 0);
              const total = vals.reduce((a, b) => a + b, 0);
              const last = vals[vals.length - 1] ?? 0;
              const prev = vals[vals.length - 2] ?? 0;
              return (
                <tr key={c} className="border-t border-app-border">
                  <td className="p-2 sticky left-0 bg-white">{CAT_LABEL[c]}</td>
                  {vals.map((v, i) => <td key={i} className="p-2 text-right tabular-nums">{formatINR(v)}</td>)}
                  <td className="p-2 text-right tabular-nums font-semibold">{formatINR(total)}</td>
                  <td className={`p-2 text-right tabular-nums ${last - prev <= 0 ? "text-green-700" : "text-red-700"}`}>{pct(prev, last)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-app-navy font-bold bg-red-50">
              <td className="p-2 sticky left-0 bg-red-50">Total Expenses</td>
              {months.map((mm) => <td key={mm} className="p-2 text-right tabular-nums">{formatINR(totals.expense[mm])}</td>)}
              <td className="p-2 text-right tabular-nums">{formatINR(months.reduce((s, mm) => s + totals.expense[mm], 0))}</td>
              <td className="p-2"></td>
            </tr>

            <tr className="border-t-2 border-app-navy font-bold bg-app-navy text-white">
              <td className="p-2 sticky left-0 bg-app-navy">Net</td>
              {months.map((mm) => {
                const v = totals.income[mm] - totals.expense[mm];
                return <td key={mm} className="p-2 text-right tabular-nums">{formatINR(v)}</td>;
              })}
              <td className="p-2 text-right tabular-nums">
                {formatINR(months.reduce((s, mm) => s + totals.income[mm] - totals.expense[mm], 0))}
              </td>
              <td className="p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
