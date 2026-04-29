import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/format";

const INCOME_CATS = ["client_billing", "payment_received", "other_income"];
const EXPENSE_CATS = ["staff_salary", "epf_payment", "esi_payment", "gst_payment", "pt_payment", "salary_advance", "admin_expense", "vehicle_expense", "other_expense"];

export default function MonthlySummary() {
  const { isSandbox } = useEnvironment();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows, setRows] = useState<Array<{ category: string; debit_amount: number; credit_amount: number }>>([]);

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2,"0")}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    supabase.from("financial_ledger")
      .select("category, debit_amount, credit_amount")
      .gte("entry_date", start).lte("entry_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .then(({ data }) => setRows((data ?? []) as unknown as typeof rows));
  }, [year, month, isSandbox]);

  const { income, expense, net } = useMemo(() => {
    let inc = 0, exp = 0;
    rows.forEach((r) => {
      if (INCOME_CATS.includes(r.category)) inc += Number(r.credit_amount);
      if (EXPENSE_CATS.includes(r.category)) exp += Number(r.debit_amount);
    });
    return { income: inc, expense: exp, net: inc - exp };
  }, [rows]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Monthly Summary</h1>
      <div className="flex gap-2 items-end">
        <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
        <div><Label>Month</Label><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader><CardTitle className="text-base text-green-700">Total Income</CardTitle></CardHeader><CardContent className="text-2xl font-bold tabular-nums">{formatINR(income)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base text-red-700">Total Expenses</CardTitle></CardHeader><CardContent className="text-2xl font-bold tabular-nums">{formatINR(expense)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base text-app-navy">Net Profit/Loss</CardTitle></CardHeader><CardContent className={`text-2xl font-bold tabular-nums ${net >= 0 ? "text-green-700" : "text-red-700"}`}>{formatINR(net)}</CardContent></Card>
      </div>
      <div className="bg-white border border-app-border rounded-lg p-4 text-sm">
        <p className="text-app-muted">Detailed CA-ready Excel export will be added next iteration.</p>
      </div>
    </div>
  );
}
