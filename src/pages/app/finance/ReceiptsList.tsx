import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatINR } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string; receipt_number: string; payment_date: string; amount: number;
  payment_mode: string; reference_number: string | null;
  clients: { client_name: string } | null;
  invoices: { invoice_number: string } | null;
}

interface OutstandingInvoice {
  id: string; invoice_number: string; outstanding_amount: number; client_id: string;
  clients: { client_name: string } | null;
}

export default function ReceiptsList() {
  const { isSandbox } = useEnvironment();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [pay, setPay] = useState({ amount: 0, payment_date: new Date().toISOString().slice(0, 10), mode: "NEFT", reference: "", bank: "", notes: "" });

  function load() {
    supabase.from("payments")
      .select("id, receipt_number, payment_date, amount, payment_mode, reference_number, clients(client_name), invoices(invoice_number)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("payment_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }
  useEffect(() => { load(); }, [isSandbox]);

  function openAdd() {
    supabase.from("invoices")
      .select("id, invoice_number, outstanding_amount, client_id, clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .neq("status", "cancelled").gt("outstanding_amount", 0)
      .order("invoice_date", { ascending: false })
      .then(({ data }) => setInvoices((data ?? []) as unknown as OutstandingInvoice[]));
    setInvoiceId("");
    setPay({ amount: 0, payment_date: new Date().toISOString().slice(0, 10), mode: "NEFT", reference: "", bank: "", notes: "" });
    setShowAdd(true);
  }

  function selectInvoice(id: string) {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) setPay((p) => ({ ...p, amount: Number(inv.outstanding_amount) }));
  }

  async function recordPayment() {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return toast.error("Select an invoice first");
    if (pay.amount <= 0) return toast.error("Amount must be positive");
    if (pay.amount > Number(inv.outstanding_amount)) return toast.error("Cannot exceed outstanding amount");
    const { data: rec, error } = await supabase.rpc("gen_receipt_number", { _d: pay.payment_date, _sandbox: isSandbox });
    if (error) return toast.error(error.message);
    const { error: insErr } = await supabase.from("payments").insert({
      receipt_number: rec as string,
      client_id: inv.client_id, invoice_id: inv.id,
      payment_date: pay.payment_date, amount: pay.amount,
      payment_mode: pay.mode, reference_number: pay.reference || null,
      bank_name: pay.bank || null, notes: pay.notes || null,
      recorded_by: user?.id, is_sandbox: isSandbox,
    });
    if (insErr) return toast.error(insErr.message);
    await logAudit({ action: "CREATE", table: "payments", newValues: pay });
    toast.success(`₹${pay.amount} recorded.`);
    setShowAdd(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Receipts</h1>
        <Button className="bg-app-navy text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Receipt</Button>
      </div>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-2">Receipt #</th><th className="p-2">Date</th><th className="p-2">Client</th>
              <th className="p-2">Invoice</th><th className="p-2">Mode</th><th className="p-2">Reference</th>
              <th className="p-2 text-right">Amount</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No receipts yet</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-app-border">
                <td className="p-2 font-mono text-xs">{r.receipt_number}</td>
                <td className="p-2">{formatDate(r.payment_date)}</td>
                <td className="p-2">{r.clients?.client_name ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{r.invoices?.invoice_number ?? "—"}</td>
                <td className="p-2">{r.payment_mode}</td>
                <td className="p-2">{r.reference_number ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(Number(r.amount))}</td>
                <td className="p-2"><Link to={`/app/finance/receipts/${r.id}`}><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Receipt</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Invoice</Label>
              <Select value={invoiceId} onValueChange={selectInvoice}>
                <SelectTrigger><SelectValue placeholder={invoices.length === 0 ? "No outstanding invoices" : "Select invoice…"} /></SelectTrigger>
                <SelectContent>
                  {invoices.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoice_number} — {i.clients?.client_name ?? "—"} ({formatINR(Number(i.outstanding_amount))} due)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={pay.payment_date} onChange={(e) => setPay({ ...pay, payment_date: e.target.value })} /></div>
            <div><Label>Amount</Label><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} /></div>
            <div>
              <Label>Mode</Label>
              <Select value={pay.mode} onValueChange={(v) => setPay({ ...pay, mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["NEFT", "RTGS", "Cheque", "Cash", "UPI"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference / UTR</Label><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
            <div><Label>Bank</Label><Input value={pay.bank} onChange={(e) => setPay({ ...pay, bank: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button className="bg-app-navy text-white" onClick={recordPayment}>Save Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
