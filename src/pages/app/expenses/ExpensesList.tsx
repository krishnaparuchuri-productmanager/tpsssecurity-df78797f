import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { formatINR } from "@/lib/format";

const EXPENSE_CATS = ["epf_payment","esi_payment","gst_payment","pt_payment","staff_salary","salary_advance","admin_expense","vehicle_expense","other_expense"] as const;
const CAT_LABEL: Record<string, string> = {
  epf_payment: "EPF", esi_payment: "ESI", gst_payment: "GST", pt_payment: "PT",
  staff_salary: "Staff Salary", salary_advance: "Salary Advance",
  admin_expense: "Admin", vehicle_expense: "Vehicle", other_expense: "Other",
};

interface Row {
  id: string; entry_date: string; voucher_number: string; category: string;
  particulars: string; client_id: string | null; debit_amount: number; reference_type: string | null;
  client_name?: string;
}

export default function ExpensesList() {
  const { isSandbox } = useEnvironment();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [catFilter, setCatFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [clientMap, setClientMap] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("clients").select("id, client_name").then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((c: { id: string; client_name: string }) => { m[c.id] = c.client_name; });
      setClientMap(m);
    });
  }, []);

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    supabase
      .from("financial_ledger")
      .select("id, entry_date, voucher_number, category, particulars, client_id, debit_amount, reference_type")
      .in("category", EXPENSE_CATS)
      .gte("entry_date", start).lte("entry_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("entry_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [year, month, isSandbox]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (search && !r.particulars.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, catFilter, search]);

  const total = useMemo(() => filtered.reduce((s, r) => s + Number(r.debit_amount), 0), [filtered]);

  function exportExcel() {
    const data = filtered.map((r) => ({
      Date: r.entry_date,
      Voucher: r.voucher_number,
      Category: CAT_LABEL[r.category] ?? r.category,
      Particulars: r.particulars,
      Client: r.client_id ? (clientMap[r.client_id] ?? "") : "",
      Reference: r.reference_type ?? "",
      Amount: Number(r.debit_amount),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Expenses");
    XLSX.writeFile(wb, `Expenses_${year}-${String(month).padStart(2, "0")}.xlsx`);
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" /></div>
          <div><Label>Month</Label><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20" /></div>
          <div className="min-w-[180px]">
            <Label>Category</Label>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{CAT_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]"><Label>Search particulars</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. diesel" /></div>
          <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export</Button>
        </div>

        <div className="text-sm text-app-muted">
          {filtered.length} entries · Total: <span className="font-semibold text-app-navy">{formatINR(total)}</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Particulars</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-app-muted">No expenses for this period</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.entry_date}</TableCell>
                <TableCell className="font-mono text-xs">{r.voucher_number}</TableCell>
                <TableCell>{CAT_LABEL[r.category] ?? r.category}</TableCell>
                <TableCell>{r.particulars}</TableCell>
                <TableCell>{r.client_id ? (clientMap[r.client_id] ?? "—") : "—"}</TableCell>
                <TableCell>{r.reference_type ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-red-700">{formatINR(Number(r.debit_amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
