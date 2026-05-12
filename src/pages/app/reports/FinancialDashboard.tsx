import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

const PIE_COLORS = [
  "#0A1628", "#C9A84C", "#1f3a6e", "#a8842a", "#3d5a8a",
  "#7a6428", "#566f99", "#5d4d20", "#283d5e",
];

function currentFY(): number {
  const d = new Date();
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

function fyRange(fy: number) {
  return {
    start: `${fy}-04-01`,
    end: `${fy + 1}-03-31`,
  };
}

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-IN", { month: "short" }) + " " + y.slice(2);
}

interface Client { id: string; client_name: string }

export default function FinancialDashboard() {
  const { isSandbox } = useEnvironment();
  const [fy, setFy] = useState(currentFY());
  const [clientId, setClientId] = useState<string>("all");
  const [clients, setClients] = useState<Client[]>([]);

  const [ledger, setLedger] = useState<Array<{ entry_date: string; category: string; debit_amount: number; credit_amount: number; client_id: string | null }>>([]);
  const [invoices, setInvoices] = useState<Array<{ outstanding_amount: number; total_invoice_value: number; status: string; client_id: string }>>([]);
  const [payments, setPayments] = useState<Array<{ amount: number; payment_date: string; client_id: string }>>([]);
  const [paysheets, setPaysheets] = useState<Array<{ total_net_salary: number; month_date: string; status: string; client_id: string }>>([]);

  useEffect(() => {
    supabase.from("clients")
      .select("id, client_name")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false).neq("status", "cancelled").eq("is_active", true)
      .order("client_name")
      .then(({ data }) => setClients((data ?? []) as Client[]));
  }, [isSandbox]);

  useEffect(() => {
    const { start, end } = fyRange(fy);
    const lq = supabase.from("financial_ledger")
      .select("entry_date, category, debit_amount, credit_amount, client_id")
      .gte("entry_date", start).lte("entry_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);
    const iq = supabase.from("invoices")
      .select("outstanding_amount, total_invoice_value, status, client_id, invoice_date")
      .gte("invoice_date", start).lte("invoice_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);
    const pq = supabase.from("payments")
      .select("amount, payment_date, client_id")
      .gte("payment_date", start).lte("payment_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);
    const psq = supabase.from("paysheets")
      .select("total_net_salary, month_date, status, client_id")
      .gte("month_date", start).lte("month_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false);

    Promise.all([lq, iq, pq, psq]).then(([l, i, p, ps]) => {
      const filt = (rows: Array<Record<string, unknown>>) =>
        clientId === "all" ? rows : rows.filter((r) => r.client_id === clientId);
      setLedger(filt((l.data ?? []) as Array<Record<string, unknown>>) as typeof ledger);
      setInvoices(filt((i.data ?? []) as Array<Record<string, unknown>>) as typeof invoices);
      setPayments(filt((p.data ?? []) as Array<Record<string, unknown>>) as typeof payments);
      setPaysheets(filt((ps.data ?? []) as Array<Record<string, unknown>>) as typeof paysheets);
    });
  }, [fy, isSandbox, clientId]);

  const kpis = useMemo(() => {
    let income = 0, expense = 0;
    ledger.forEach((r) => {
      if (INCOME_CATS.includes(r.category)) income += Number(r.credit_amount);
      if (EXPENSE_CATS.includes(r.category)) expense += Number(r.debit_amount);
    });
    const outstanding = invoices
      .filter((i) => i.status !== "paid")
      .reduce((s, i) => s + Number(i.outstanding_amount || 0), 0);
    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total_invoice_value || 0), 0);
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalPayroll = paysheets
      .filter((p) => p.status === "approved")
      .reduce((s, p) => s + Number(p.total_net_salary || 0), 0);
    const activeClients = clientId === "all"
      ? clients.length
      : new Set([clientId]).size;
    return { income, expense, net: income - expense, outstanding, totalInvoiced, totalCollected, totalPayroll, activeClients };
  }, [ledger, invoices, payments, paysheets, clients.length, clientId]);

  const monthlyChart = useMemo(() => {
    const months: string[] = [];
    for (let i = 0; i < 12; i++) {
      const m = ((3 + i) % 12) + 1; // Apr..Mar
      const year = m >= 4 ? fy : fy + 1;
      months.push(`${year}-${String(m).padStart(2, "0")}`);
    }
    const map: Record<string, { income: number; expense: number; collected: number; invoiced: number }> = {};
    months.forEach((m) => (map[m] = { income: 0, expense: 0, collected: 0, invoiced: 0 }));
    ledger.forEach((r) => {
      const k = monthKey(r.entry_date);
      if (!map[k]) return;
      if (INCOME_CATS.includes(r.category)) map[k].income += Number(r.credit_amount);
      if (EXPENSE_CATS.includes(r.category)) map[k].expense += Number(r.debit_amount);
    });
    payments.forEach((p) => {
      const k = monthKey(p.payment_date);
      if (map[k]) map[k].collected += Number(p.amount);
    });
    invoices.forEach((i) => {
      const anyI = i as unknown as { invoice_date: string };
      const k = monthKey(anyI.invoice_date);
      if (map[k]) map[k].invoiced += Number(i.total_invoice_value || 0);
    });
    let cumC = 0, cumI = 0;
    return months.map((m) => {
      cumC += map[m].collected;
      cumI += map[m].invoiced;
      return {
        month: monthLabel(m),
        Income: map[m].income,
        Expense: map[m].expense,
        CumCollected: cumC,
        CumInvoiced: cumI,
      };
    });
  }, [ledger, payments, invoices, fy]);

  const expensePie = useMemo(() => {
    const map: Record<string, number> = {};
    ledger.forEach((r) => {
      if (EXPENSE_CATS.includes(r.category)) {
        map[r.category] = (map[r.category] ?? 0) + Number(r.debit_amount);
      }
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: CAT_LABEL[k] ?? k, value: v }));
  }, [ledger]);

  const fyOptions = useMemo(() => {
    const cur = currentFY();
    return [cur - 2, cur - 1, cur, cur + 1];
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-app-navy">Financial Dashboard</h1>
        <div className="flex gap-2 items-end">
          <div>
            <Label>Financial Year</Label>
            <Select value={String(fy)} onValueChange={(v) => setFy(Number(v))}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fyOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>FY {y}-{String(y + 1).slice(2)}</SelectItem>
                ))}
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
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader><CardTitle className="text-sm text-green-700">Total Revenue</CardTitle></CardHeader><CardContent className="text-xl font-bold tabular-nums">{formatINR(kpis.income)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-red-700">Total Expenses</CardTitle></CardHeader><CardContent className="text-xl font-bold tabular-nums">{formatINR(kpis.expense)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-app-navy">Net Profit/(Loss)</CardTitle></CardHeader><CardContent className={`text-xl font-bold tabular-nums ${kpis.net >= 0 ? "text-green-700" : "text-red-700"}`}>{formatINR(kpis.net)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-amber-700">Outstanding Receivables</CardTitle></CardHeader><CardContent className="text-xl font-bold tabular-nums">{formatINR(kpis.outstanding)}</CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader><CardTitle className="text-sm">Total Invoiced</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{formatINR(kpis.totalInvoiced)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total Collected</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{formatINR(kpis.totalCollected)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total Payroll (Approved)</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{formatINR(kpis.totalPayroll)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Active Clients</CardTitle></CardHeader><CardContent className="text-lg font-semibold tabular-nums">{kpis.activeClients}</CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Income vs Expense by month</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`)} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
                <Bar dataKey="Income" fill="#16a34a" />
                <Bar dataKey="Expense" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Expense breakdown</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            {expensePie.length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">No expenses recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={100} label={(e) => e.name}>
                    {expensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cumulative invoicing vs collections</CardTitle></CardHeader>
        <CardContent style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`)} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Legend />
              <Line type="monotone" dataKey="CumInvoiced" stroke="#0A1628" strokeWidth={2} dot={false} name="Cumulative Invoiced" />
              <Line type="monotone" dataKey="CumCollected" stroke="#C9A84C" strokeWidth={2} dot={false} name="Cumulative Collected" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
