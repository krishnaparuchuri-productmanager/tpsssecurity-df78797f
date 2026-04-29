import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const EXPENSE_CATS = ["epf_payment","esi_payment","gst_payment","pt_payment","staff_salary","salary_advance","admin_expense","vehicle_expense","other_expense"] as const;
const CAT_LABEL: Record<string, string> = {
  epf_payment: "EPF", esi_payment: "ESI", gst_payment: "GST", pt_payment: "PT",
  staff_salary: "Staff Sal", salary_advance: "Adv Payout",
  admin_expense: "Admin", vehicle_expense: "Vehicle", other_expense: "Other",
};

interface Row { entry_date: string; category: string; debit_amount: number }

export default function ExpensesSummary() {
  const { isSandbox } = useEnvironment();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const start = new Date(year, month - 12, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    supabase
      .from("financial_ledger")
      .select("entry_date, category, debit_amount")
      .in("category", EXPENSE_CATS)
      .gte("entry_date", start).lte("entry_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [year, month, isSandbox]);

  const { thisMonth, ytd, byCatThis, trend, largest, count } = useMemo(() => {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    let mTotal = 0, yTotal = 0, mCount = 0;
    const cat: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    rows.forEach((r) => {
      const d = r.entry_date.slice(0, 7);
      const amt = Number(r.debit_amount);
      byMonth[d] = (byMonth[d] ?? 0) + amt;
      if (d === monthKey) {
        mTotal += amt;
        mCount += 1;
        cat[r.category] = (cat[r.category] ?? 0) + amt;
      }
      if (d.startsWith(String(year))) yTotal += amt;
    });
    const trendArr = Object.entries(byMonth).sort().map(([m, v]) => ({ month: m, amount: v }));
    const catArr = EXPENSE_CATS.map((c) => ({ name: CAT_LABEL[c], amount: cat[c] ?? 0 }));
    const largestEntry = catArr.reduce((max, c) => (c.amount > max.amount ? c : max), { name: "—", amount: 0 });
    return { thisMonth: mTotal, ytd: yTotal, byCatThis: catArr, trend: trendArr, largest: largestEntry, count: mCount };
  }, [rows, year, month]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" /></div>
        <div><Label>Month</Label><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20" /></div>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">This Month</CardTitle></CardHeader><CardContent className="text-xl font-bold tabular-nums text-red-700">{formatINR(thisMonth)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">YTD ({year})</CardTitle></CardHeader><CardContent className="text-xl font-bold tabular-nums">{formatINR(ytd)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">Largest Category</CardTitle></CardHeader><CardContent><div className="text-base font-semibold">{largest.name}</div><div className="text-sm tabular-nums">{formatINR(largest.amount)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-app-muted">Entries This Month</CardTitle></CardHeader><CardContent className="text-xl font-bold">{count}</CardContent></Card>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Expenses by Category — {String(month).padStart(2, "0")}/{year}</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer><BarChart data={byCatThis}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="amount" fill="#0A1628" />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">12-Month Expense Trend</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer><LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Line type="monotone" dataKey="amount" stroke="#C9A84C" strokeWidth={2} />
            </LineChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
