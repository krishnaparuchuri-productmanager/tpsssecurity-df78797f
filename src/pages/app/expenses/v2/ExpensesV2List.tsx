import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download, Check } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { formatINR, formatDate } from "@/lib/format";

interface Row {
  id: string; expense_number: string; expense_date: string;
  description: string; amount: number; payment_mode: string; status: string;
  reference_number: string | null;
  category_id: string;
}
interface Cat { id: string; category_name: string; }

export default function ExpensesV2List() {
  const { isSandbox } = useEnvironment();
  const { role } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const canApprove = role === "ceo_admin" || role === "coo_ops";

  useEffect(() => {
    supabase.from("expense_categories").select("id, category_name").eq("is_active", true)
      .order("sort_order").then(({ data }) => setCats((data ?? []) as Cat[]));
  }, []);

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    supabase.from("expenses")
      .select("id, expense_number, expense_date, description, amount, payment_mode, status, reference_number, category_id")
      .gte("expense_date", start).lte("expense_date", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("expense_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [year, month, isSandbox, refreshKey]);

  const catMap = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.category_name])), [cats]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (catFilter !== "all" && r.category_id !== catFilter) return false;
    if (search && !r.description.toLowerCase().includes(search.toLowerCase()) &&
        !r.expense_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, statusFilter, catFilter, search]);

  const totals = useMemo(() => ({
    count: filtered.length,
    sum: filtered.reduce((s, r) => s + Number(r.amount), 0),
    approved: filtered.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0),
    draft: filtered.filter((r) => r.status === "draft").reduce((s, r) => s + Number(r.amount), 0),
  }), [filtered]);

  async function approve(id: string) {
    const { error } = await supabase.rpc("approve_expense", { _id: id });
    if (error) return toast.error(error.message);
    toast.success("Expense approved & posted to ledger");
    setRefreshKey((k) => k + 1);
  }

  function exportExcel() {
    const data = filtered.map((r) => ({
      "Voucher #": r.expense_number, Date: r.expense_date, Category: catMap[r.category_id] ?? "",
      Description: r.description, Amount: Number(r.amount), "Payment Mode": r.payment_mode,
      Reference: r.reference_number ?? "", Status: r.status,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Expenses");
    XLSX.writeFile(wb, `Expenses_${year}-${String(month).padStart(2, "0")}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Expenses (v2)</h1>
        <Link to="/app/expenses/v2/new">
          <Button className="bg-app-navy text-white"><Plus className="h-4 w-4 mr-1" /> New Expense</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Total entries</div><div className="text-xl font-bold tabular-nums">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Total Amount</div><div className="text-xl font-bold tabular-nums">{formatINR(totals.sum)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Approved</div><div className="text-xl font-bold tabular-nums text-green-700">{formatINR(totals.approved)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Draft (pending)</div><div className="text-xl font-bold tabular-nums text-yellow-700">{formatINR(totals.draft)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" /></div>
            <div><Label>Month</Label><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20" /></div>
            <div className="min-w-[160px]">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Label>Category</Label>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]"><Label>Search</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="voucher / description" /></div>
            <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead>
                <TableHead>Description</TableHead><TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-app-muted">No expenses for this period</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.expense_number}</TableCell>
                  <TableCell>{formatDate(r.expense_date)}</TableCell>
                  <TableCell>{catMap[r.category_id] ?? "—"}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{r.description}</TableCell>
                  <TableCell>{r.payment_mode}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.amount))}</TableCell>
                  <TableCell>
                    <Badge className={r.status === "approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canApprove && r.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => approve(r.id)}>
                        <Check className="h-3 w-3 mr-1" /> Approve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
