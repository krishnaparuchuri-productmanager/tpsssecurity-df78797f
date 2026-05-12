import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, TrendingDown, TrendingUp, Minus } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR, formatDate } from "@/lib/format";
import { activity } from "@/lib/activity";
import { drawLetterhead, getCompanyHeader, jsPDF, autoTable } from "@/lib/reportPdf";

interface InvoiceRow {
  id: string; invoice_number: string; month_date: string; billing_amount: number;
  gst_amount: number; tds_amount: number; total_deductions: number; net_margin: number;
  amount_received: number; outstanding_amount: number;
}

function fyDefault(): { from: string; to: string } {
  const now = new Date();
  const y = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

export default function ClientBillingHistory() {
  const def = fyDefault();
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [clients, setClients] = useState<{ id: string; client_name: string }[]>([]);
  const [rows, setRows] = useState<InvoiceRow[]>([]);

  useEffect(() => {
    supabase.from("clients").select("id, client_name").eq("is_deleted", false).order("client_name")
      .then(({ data }) => setClients((data ?? []) as never));
  }, []);

  useEffect(() => {
    if (!clientId) { setRows([]); return; }
    supabase.from("invoices")
      .select("id, invoice_number, month_date, billing_amount, gst_amount, tds_amount, total_deductions, net_margin, amount_received, outstanding_amount")
      .eq("client_id", clientId).eq("is_deleted", false)
      .gte("month_date", from).lte("month_date", to)
      .order("month_date", { ascending: true })
      .then(({ data }) => setRows((data ?? []) as InvoiceRow[]));
  }, [clientId, from, to]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    billing: acc.billing + Number(r.billing_amount || 0),
    gst: acc.gst + Number(r.gst_amount || 0),
    tds: acc.tds + Number(r.tds_amount || 0),
    deductions: acc.deductions + Number(r.total_deductions || 0),
    margin: acc.margin + Number(r.net_margin || 0),
    received: acc.received + Number(r.amount_received || 0),
    outstanding: acc.outstanding + Number(r.outstanding_amount || 0),
  }), { billing: 0, gst: 0, tds: 0, deductions: 0, margin: 0, received: 0, outstanding: 0 }), [rows]);

  const trend = useMemo(() => {
    if (rows.length < 2) return 0;
    const first = Number(rows[0].outstanding_amount);
    const last = Number(rows[rows.length - 1].outstanding_amount);
    return last - first;
  }, [rows]);

  const clientName = clients.find((c) => c.id === clientId)?.client_name ?? "";

  function exportExcel() {
    const data = rows.map((r) => ({
      Month: formatDate(r.month_date), "Invoice #": r.invoice_number,
      Billing: Number(r.billing_amount), GST: Number(r.gst_amount), TDS: Number(r.tds_amount),
      Deductions: Number(r.total_deductions), "Net Margin": Number(r.net_margin),
      Received: Number(r.amount_received), Outstanding: Number(r.outstanding_amount),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Billing");
    const fname = `${clientName || "Client"}_BillingHistory_${from}_to_${to}.xlsx`;
    XLSX.writeFile(wb, fname);
    activity.export(fname, "excel");
  }

  async function exportPdf() {
    const header = await getCompanyHeader();
    const doc = new jsPDF();
    const startY = drawLetterhead(doc, header, "Client Billing History");
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`Client: ${clientName}`, 14, startY);
    doc.text(`Period: ${formatDate(from)} to ${formatDate(to)}`, 14, startY + 5);

    autoTable(doc, {
      startY: startY + 10,
      head: [["Month", "Invoice #", "Billing", "GST", "TDS", "Deductions", "Net Margin", "Received", "Outstanding"]],
      body: rows.map((r) => [
        formatDate(r.month_date), r.invoice_number,
        formatINR(Number(r.billing_amount)), formatINR(Number(r.gst_amount)),
        formatINR(Number(r.tds_amount)), formatINR(Number(r.total_deductions)),
        formatINR(Number(r.net_margin)), formatINR(Number(r.amount_received)),
        formatINR(Number(r.outstanding_amount)),
      ]),
      foot: [["Totals", "", formatINR(totals.billing), formatINR(totals.gst), formatINR(totals.tds),
              formatINR(totals.deductions), formatINR(totals.margin), formatINR(totals.received), formatINR(totals.outstanding)]],
      styles: { fontSize: 8 }, headStyles: { fillColor: [10, 22, 40] }, footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    });
    const fname = `${clientName || "Client"}_BillingHistory_${from}_to_${to}.pdf`;
    doc.save(fname);
    activity.export(fname, "pdf");
  }

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendCls = trend > 0 ? "text-red-700" : trend < 0 ? "text-green-700" : "text-app-muted";
  const trendLabel = trend > 0 ? "Worsening" : trend < 0 ? "Improving" : "Stable";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Client Billing History</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[240px]"><Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button variant="outline" onClick={exportExcel} disabled={!clientId}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" onClick={exportPdf} disabled={!clientId}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      {clientId && rows.length > 0 && (
        <Card>
          <CardContent className="pt-4 flex items-center gap-2">
            <TrendIcon className={`h-5 w-5 ${trendCls}`} />
            <div className={`text-sm font-medium ${trendCls}`}>Outstanding trend: {trendLabel}</div>
            <div className="text-xs text-app-muted ml-2">(net change of {formatINR(Math.abs(trend))} from first to last invoice)</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Month</TableHead><TableHead>Invoice #</TableHead>
              <TableHead className="text-right">Billing</TableHead><TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">TDS</TableHead><TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Margin</TableHead><TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!clientId && <TableRow><TableCell colSpan={9} className="text-center text-app-muted">Select a client</TableCell></TableRow>}
              {clientId && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-app-muted">No invoices in range</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.month_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.billing_amount))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.gst_amount))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.tds_amount))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.total_deductions))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.net_margin))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.amount_received))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.outstanding_amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.billing)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.gst)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.tds)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.deductions)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.margin)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.received)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.outstanding)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
