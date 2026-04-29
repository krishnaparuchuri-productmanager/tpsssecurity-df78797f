import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatINR } from "@/lib/format";

const INCOME_CATS = ["client_billing", "payment_received", "other_income"];
const EXPENSE_CATS = ["staff_salary", "epf_payment", "esi_payment", "gst_payment", "pt_payment", "salary_advance", "admin_expense", "vehicle_expense", "other_expense"];

const CAT_LABEL: Record<string, string> = {
  client_billing: "Client Billing",
  payment_received: "Payments Received",
  other_income: "Other Income",
  staff_salary: "Staff Salaries",
  epf_payment: "EPF Payments",
  esi_payment: "ESI Payments",
  gst_payment: "GST Payments",
  pt_payment: "PT Payments",
  salary_advance: "Salary Advances",
  admin_expense: "Admin Expenses",
  vehicle_expense: "Vehicle Expenses",
  other_expense: "Other Expenses",
};

interface Row { category: string; debit_amount: number; credit_amount: number }

export default function MonthlySummary() {
  const { isSandbox } = useEnvironment();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2,"0")}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    supabase.from("financial_ledger")
      .select("category, debit_amount, credit_amount")
      .gte("entry_date", start).lte("entry_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [year, month, isSandbox]);

  const { income, expense, net, byCat } = useMemo(() => {
    let inc = 0, exp = 0;
    const map: Record<string, { debit: number; credit: number }> = {};
    rows.forEach((r) => {
      const k = r.category;
      if (!map[k]) map[k] = { debit: 0, credit: 0 };
      map[k].debit += Number(r.debit_amount);
      map[k].credit += Number(r.credit_amount);
      if (INCOME_CATS.includes(k)) inc += Number(r.credit_amount);
      if (EXPENSE_CATS.includes(k)) exp += Number(r.debit_amount);
    });
    return { income: inc, expense: exp, net: inc - exp, byCat: map };
  }, [rows]);

  function exportExcel() {
    const incomeRows = INCOME_CATS.map((c) => ({
      Category: CAT_LABEL[c] ?? c, Amount: byCat[c]?.credit ?? 0,
    }));
    incomeRows.push({ Category: "TOTAL INCOME", Amount: income });

    const expenseRows = EXPENSE_CATS.map((c) => ({
      Category: CAT_LABEL[c] ?? c, Amount: byCat[c]?.debit ?? 0,
    }));
    expenseRows.push({ Category: "TOTAL EXPENSES", Amount: expense });

    const summary = [
      { Item: "Period", Value: `${String(month).padStart(2,"0")}/${year}` },
      { Item: "Total Income", Value: income },
      { Item: "Total Expenses", Value: expense },
      { Item: "Net Profit/(Loss)", Value: net },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), "Income");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), "Expenses");
    XLSX.writeFile(wb, `MonthlySummary_${year}-${String(month).padStart(2,"0")}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Monthly Summary</h1>
        <Button variant="outline" onClick={exportExcel}>
          <Download className="h-4 w-4 mr-1" /> Export Excel (CA-ready)
        </Button>
      </div>
      <div className="flex gap-2 items-end">
        <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
        <div><Label>Month</Label><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card><CardHeader><CardTitle className="text-base text-green-700">Total Income</CardTitle></CardHeader><CardContent className="text-2xl font-bold tabular-nums">{formatINR(income)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base text-red-700">Total Expenses</CardTitle></CardHeader><CardContent className="text-2xl font-bold tabular-nums">{formatINR(expense)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base text-app-navy">Net Profit/Loss</CardTitle></CardHeader><CardContent className={`text-2xl font-bold tabular-nums ${net >= 0 ? "text-green-700" : "text-red-700"}`}>{formatINR(net)}</CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-app-border rounded-lg p-4">
          <h2 className="font-semibold text-app-navy mb-2">Income breakdown</h2>
          <table className="w-full text-sm">
            <tbody>
              {INCOME_CATS.map((c) => (
                <tr key={c} className="border-t border-app-border">
                  <td className="p-2">{CAT_LABEL[c]}</td>
                  <td className="p-2 text-right tabular-nums text-green-700">{formatINR(byCat[c]?.credit ?? 0)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-app-navy font-bold">
                <td className="p-2">Total</td>
                <td className="p-2 text-right tabular-nums">{formatINR(income)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bg-white border border-app-border rounded-lg p-4">
          <h2 className="font-semibold text-app-navy mb-2">Expense breakdown</h2>
          <table className="w-full text-sm">
            <tbody>
              {EXPENSE_CATS.map((c) => (
                <tr key={c} className="border-t border-app-border">
                  <td className="p-2">{CAT_LABEL[c]}</td>
                  <td className="p-2 text-right tabular-nums text-red-700">{formatINR(byCat[c]?.debit ?? 0)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-app-navy font-bold">
                <td className="p-2">Total</td>
                <td className="p-2 text-right tabular-nums">{formatINR(expense)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
