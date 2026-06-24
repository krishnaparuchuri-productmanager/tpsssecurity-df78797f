import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatINR, formatDate } from "@/lib/format";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { addExcelBranding } from "@/lib/excelBranding";

interface Client { id: string; client_name: string; client_code: string; gst_number: string | null; address: string | null; }
interface Invoice {
  id: string; invoice_number: string; invoice_date: string; due_date: string | null;
  total_invoice_value: number; amount_received: number; outstanding_amount: number;
}
interface Payment { id: string; invoice_id: string; receipt_number: string; payment_date: string; amount: number; payment_mode: string; }

interface Line { date: string; particulars: string; ref: string; debit: number; credit: number; balance: number; }

export default function StatementOfAccount() {
  const { isSandbox } = useEnvironment();
  const company = useCompanyProfile();
  const today = new Date();
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(`${today.getFullYear()}-04-01`);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    supabase.from("clients").select("id, client_name, client_code, gst_number, address")
      .eq("is_deleted", false).order("client_name")
      .then(({ data }) => setClients((data ?? []) as Client[]));
  }, []);

  useEffect(() => {
    if (!clientId) { setInvoices([]); setPayments([]); return; }
    supabase.from("invoices")
      .select("id, invoice_number, invoice_date, due_date, total_invoice_value, amount_received, outstanding_amount")
      .eq("client_id", clientId).eq("is_sandbox", isSandbox).eq("is_deleted", false).neq("status", "cancelled")
      .gte("invoice_date", from).lte("invoice_date", to)
      .order("invoice_date").then(({ data }) => setInvoices((data ?? []) as Invoice[]));
    supabase.from("payments")
      .select("id, invoice_id, receipt_number, payment_date, amount, payment_mode")
      .eq("client_id", clientId).eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .gte("payment_date", from).lte("payment_date", to)
      .order("payment_date").then(({ data }) => setPayments((data ?? []) as Payment[]));
  }, [clientId, from, to, isSandbox]);

  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);

  const lines: Line[] = useMemo(() => {
    const events: Array<{ date: string; debit: number; credit: number; particulars: string; ref: string }> = [];
    invoices.forEach((i) => events.push({
      date: i.invoice_date, debit: Number(i.total_invoice_value), credit: 0,
      particulars: `Invoice ${i.invoice_number}`, ref: i.invoice_number,
    }));
    payments.forEach((p) => events.push({
      date: p.payment_date, debit: 0, credit: Number(p.amount),
      particulars: `Payment received (${p.payment_mode})`, ref: p.receipt_number,
    }));
    events.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return events.map((e) => { bal += e.debit - e.credit; return { ...e, balance: bal }; });
  }, [invoices, payments]);

  const totals = useMemo(() => ({
    debit: lines.reduce((s, l) => s + l.debit, 0),
    credit: lines.reduce((s, l) => s + l.credit, 0),
    closing: lines.length ? lines[lines.length - 1].balance : 0,
  }), [lines]);

  function exportExcel() {
    const data = lines.map((l) => ({
      Date: l.date, Particulars: l.particulars, Reference: l.ref,
      Debit: l.debit || "", Credit: l.credit || "", Balance: l.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    if (company) addExcelBranding(ws, company);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `Statement_${client?.client_code ?? "client"}_${from}_to_${to}.xlsx`);
  }

  function exportPDF() {
    if (!client) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text("Statement of Account", 14, 18);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Client: ${client.client_name}`, 14, 26);
    doc.text(`Period: ${formatDate(from)} to ${formatDate(to)}`, 14, 32);
    if (client.gst_number) doc.text(`GST: ${client.gst_number}`, 14, 38);
    autoTable(doc, {
      startY: 44,
      head: [["Date", "Particulars", "Ref", "Debit (Rs.)", "Credit (Rs.)", "Balance (Rs.)"]],
      body: lines.map((l) => [
        formatDate(l.date), l.particulars, l.ref,
        l.debit ? l.debit.toFixed(2) : "",
        l.credit ? l.credit.toFixed(2) : "",
        l.balance.toFixed(2),
      ]),
      foot: [["", "Total", "", totals.debit.toFixed(2), totals.credit.toFixed(2), totals.closing.toFixed(2)]],
      styles: { fontSize: 8 }, headStyles: { fillColor: [10, 22, 40] },
    });
    doc.save(`Statement_${client.client_code}_${from}_to_${to}.pdf`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Statement of Account</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[260px]">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button variant="outline" onClick={exportExcel} disabled={!clientId}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={exportPDF} disabled={!clientId}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          </div>

          {clientId && client && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">Total Billed</div><div className="text-xl font-bold tabular-nums">{formatINR(totals.debit)}</div></div>
                <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">Total Received</div><div className="text-xl font-bold tabular-nums text-green-700">{formatINR(totals.credit)}</div></div>
                <div className="bg-app-surface p-3 rounded border border-app-border"><div className="text-xs text-app-muted">Closing Balance</div><div className={`text-xl font-bold tabular-nums ${totals.closing > 0 ? "text-red-700" : "text-green-700"}`}>{formatINR(totals.closing)}</div></div>
              </div>

              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Particulars</TableHead><TableHead>Ref</TableHead>
                  <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {lines.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-app-muted">No transactions in this period</TableCell></TableRow>}
                  {lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDate(l.date)}</TableCell>
                      <TableCell>{l.particulars}</TableCell>
                      <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.debit ? formatINR(l.debit) : ""}</TableCell>
                      <TableCell className="text-right tabular-nums text-green-700">{l.credit ? formatINR(l.credit) : ""}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatINR(l.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
