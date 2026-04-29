import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR, formatDate } from "@/lib/format";

const TYPES = ["EPF", "ESI", "GST", "PT", "TDS", "OTHER"];

interface Row {
  id: string; payment_type: string; payment_month: string; payment_date: string;
  amount: number; late_fee: number; interest: number; total_paid: number;
  challan_number: string | null; bank_name: string | null; reference_number: string | null;
}

export default function CompliancePaymentsList() {
  const { isSandbox } = useEnvironment();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [typeFilter, setTypeFilter] = useState("all");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const start = `${year}-01-01`, end = `${year}-12-31`;
    supabase.from("compliance_payments")
      .select("id, payment_type, payment_month, payment_date, amount, late_fee, interest, total_paid, challan_number, bank_name, reference_number")
      .gte("payment_month", start).lte("payment_month", end)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("payment_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [year, isSandbox]);

  const filtered = useMemo(() => rows.filter((r) => typeFilter === "all" || r.payment_type === typeFilter), [rows, typeFilter]);
  const totalPaid = useMemo(() => filtered.reduce((s, r) => s + Number(r.total_paid), 0), [filtered]);

  function exportExcel() {
    const data = filtered.map((r) => ({
      Type: r.payment_type, "Period": r.payment_month, "Paid On": r.payment_date,
      Amount: r.amount, "Late Fee": r.late_fee, Interest: r.interest, "Total Paid": r.total_paid,
      Challan: r.challan_number ?? "", Bank: r.bank_name ?? "", Reference: r.reference_number ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "CompliancePayments");
    XLSX.writeFile(wb, `CompliancePayments_${year}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Compliance Payments</h1>
        <Link to="/app/compliance/payments/new">
          <Button className="bg-app-navy text-white"><Plus className="h-4 w-4 mr-1" /> Record Payment</Button>
        </Link>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" /></div>
            <div className="min-w-[160px]">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto"><Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export</Button></div>
          </div>
          <div className="text-sm text-app-muted">{filtered.length} payments · Total Paid: <span className="font-semibold text-app-navy">{formatINR(totalPaid)}</span></div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Type</TableHead><TableHead>Period</TableHead><TableHead>Paid On</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Late Fee</TableHead>
              <TableHead className="text-right">Interest</TableHead><TableHead className="text-right">Total</TableHead>
              <TableHead>Challan</TableHead><TableHead>Bank</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-app-muted">No payments</TableCell></TableRow>}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.payment_type}</TableCell>
                  <TableCell>{r.payment_month?.slice(0, 7)}</TableCell>
                  <TableCell>{formatDate(r.payment_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.amount))}</TableCell>
                  <TableCell className="text-right tabular-nums text-yellow-700">{formatINR(Number(r.late_fee))}</TableCell>
                  <TableCell className="text-right tabular-nums text-yellow-700">{formatINR(Number(r.interest))}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatINR(Number(r.total_paid))}</TableCell>
                  <TableCell className="font-mono text-xs">{r.challan_number ?? "—"}</TableCell>
                  <TableCell>{r.bank_name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
