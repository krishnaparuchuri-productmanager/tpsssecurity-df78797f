import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR, formatDate } from "@/lib/format";

interface Inv {
  id: string; invoice_number: string; invoice_date: string;
  total_taxable_value: number; gst_amount: number; gst_percentage: number;
  total_invoice_value: number; gst_applicable: boolean; gst_rcm: boolean;
  client_id: string;
  clients: { client_name: string; gst_number: string | null; state: string } | null;
}

export default function GstReport() {
  const { isSandbox } = useEnvironment();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [invs, setInvs] = useState<Inv[]>([]);

  useEffect(() => {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    supabase.from("invoices")
      .select("id, invoice_number, invoice_date, total_taxable_value, gst_amount, gst_percentage, total_invoice_value, gst_applicable, gst_rcm, client_id, clients(client_name, gst_number, state)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false).eq("gst_applicable", true)
      .gte("invoice_date", start).lte("invoice_date", end)
      .order("invoice_date").then(({ data }) => setInvs((data ?? []) as unknown as Inv[]));
  }, [isSandbox, year, month]);

  const fwd = useMemo(() => invs.filter((i) => !i.gst_rcm), [invs]);
  const rcm = useMemo(() => invs.filter((i) => i.gst_rcm), [invs]);

  const fwdTotals = useMemo(() => fwd.reduce((acc, i) => ({
    taxable: acc.taxable + Number(i.total_taxable_value),
    gst: acc.gst + Number(i.gst_amount),
    total: acc.total + Number(i.total_invoice_value),
  }), { taxable: 0, gst: 0, total: 0 }), [fwd]);
  const rcmTotals = useMemo(() => rcm.reduce((acc, i) => ({
    taxable: acc.taxable + Number(i.total_taxable_value),
    gst: acc.gst + Number(i.gst_amount),
    total: acc.total + Number(i.total_invoice_value),
  }), { taxable: 0, gst: 0, total: 0 }), [rcm]);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const mkRows = (list: Inv[]) => list.map((i) => ({
      "Invoice #": i.invoice_number, Date: i.invoice_date, Client: i.clients?.client_name ?? "",
      "Client GSTIN": i.clients?.gst_number ?? "", "Place of Supply": i.clients?.state ?? "",
      "Taxable Value": Number(i.total_taxable_value), "GST %": Number(i.gst_percentage),
      "GST Amount": Number(i.gst_amount), "Invoice Total": Number(i.total_invoice_value),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mkRows(fwd)), "GSTR-1");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mkRows(rcm)), "RCM");
    XLSX.writeFile(wb, `GST_${year}-${String(month).padStart(2, "0")}.xlsx`);
  }

  function renderTable(list: Inv[], totals: { taxable: number; gst: number; total: number }) {
    return (
      <Table>
        <TableHeader><TableRow>
          <TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead>
          <TableHead>GSTIN</TableHead><TableHead>State</TableHead>
          <TableHead className="text-right">Taxable</TableHead>
          <TableHead className="text-right">GST %</TableHead>
          <TableHead className="text-right">GST</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {list.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-app-muted">No invoices</TableCell></TableRow>}
          {list.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
              <TableCell>{formatDate(i.invoice_date)}</TableCell>
              <TableCell>{i.clients?.client_name ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{i.clients?.gst_number ?? "—"}</TableCell>
              <TableCell>{i.clients?.state ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(Number(i.total_taxable_value))}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(i.gst_percentage).toFixed(2)}%</TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(Number(i.gst_amount))}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatINR(Number(i.total_invoice_value))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="font-bold">TOTAL</TableCell>
            <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.taxable)}</TableCell>
            <TableCell></TableCell>
            <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.gst)}</TableCell>
            <TableCell className="text-right tabular-nums font-bold">{formatINR(totals.total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">GST Report</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" /></div>
            <div><Label>Month</Label><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20" /></div>
            <div className="ml-auto"><Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Export GSTR-1 + RCM</Button></div>
          </div>
          <Tabs defaultValue="fwd">
            <TabsList>
              <TabsTrigger value="fwd">GSTR-1 (Forward charge)</TabsTrigger>
              <TabsTrigger value="rcm">RCM</TabsTrigger>
            </TabsList>
            <TabsContent value="fwd" className="pt-4">{renderTable(fwd, fwdTotals)}</TabsContent>
            <TabsContent value="rcm" className="pt-4">{renderTable(rcm, rcmTotals)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
