import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CreditCard, Printer, Ban, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { formatINR, formatDate } from "@/lib/format";
import { CancelDialog } from "@/components/CancelDialog";

interface Invoice {
  id: string; invoice_number: string; invoice_date: string; due_date: string;
  month: string; client_id: string;
  billing_lines: unknown; billing_amount: number; gst_applicable: boolean; gst_rcm: boolean;
  gst_percentage: number; gst_amount: number; tds_percentage: number; tds_amount: number;
  total_invoice_value: number; amount_receivable: number; net_margin: number;
  amount_received: number; outstanding_amount: number; amount_in_words: string | null;
  deduction_rows: unknown; total_deductions: number; status: string;
  service_period_from: string; service_period_to: string;
  cancelled_at: string | null; cancelled_by: string | null; cancellation_reason: string | null;
  replaced_by_id: string | null; replaces_id: string | null;
  clients: { client_name: string; client_code: string; address: string | null; gst_number: string | null } | null;
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSandbox } = useEnvironment();
  const { user, role } = useAuth();
  const isCEO = role === "ceo_admin";
  const [inv, setInv] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<{
    company_name: string; pan_number: string | null; gst_number: string | null;
    pf_code: string | null; esi_code: string | null; bank_account_number: string | null;
    bank_ifsc: string | null; bank_name: string | null; iso_certification: string | null;
    invoice_location_code: string | null; jurisdiction: string | null;
    registered_address: string | null; phone: string | null; email: string | null;
  } | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [pay, setPay] = useState({ amount: 0, payment_date: new Date().toISOString().slice(0,10), mode: "NEFT", reference: "", bank: "", notes: "" });

  async function load() {
    if (!id) return;
    const [{ data: i }, { data: c }] = await Promise.all([
      supabase.from("invoices").select("*, clients(client_name, client_code, address, gst_number)").eq("id", id).maybeSingle(),
      supabase.from("company_profile").select("*").maybeSingle(),
    ]);
    setInv(i as unknown as Invoice);
    setCompany(c as unknown as typeof company);
    if (i) setPay((p) => ({ ...p, amount: Number(i.outstanding_amount) }));
  }
  useEffect(() => { load(); }, [id]);

  async function recordPayment() {
    if (!inv) return;
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
    setShowPay(false);
    load();
  }

  async function cancelInvoice(reason: string) {
    if (!inv) return;
    const { error } = await supabase.rpc("cancel_invoice", { _id: inv.id, _reason: reason });
    if (error) {
      if (error.message.includes("RECEIPTS_EXIST")) {
        toast.error("Reverse all receipts first, then cancel.", {
          action: { label: "Open Receipts", onClick: () => navigate(`/app/finance/receipts?invoice=${inv.id}`) },
        });
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Invoice cancelled");
    setShowCancel(false);
    load();
  }

  async function recreateInvoice() {
    if (!inv) return;
    const { data, error } = await supabase.rpc("recreate_invoice", { _old_id: inv.id });
    if (error) return toast.error(error.message);
    toast.success("New draft created");
    navigate(`/app/invoices/${data as string}/edit`);
  }

  if (!inv || !company) return <div className="text-muted-foreground">Loading…</div>;

  const lines = (inv.billing_lines as Array<{ qty: number; description: string; sac_code: string; rate_per_month: number; working_days: number; no_of_duties: number; amount: number }>) ?? [];
  const isCancelled = inv.status === "cancelled";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold text-app-navy">{inv.invoice_number}</h1>
        <Badge className={isCancelled ? "bg-gray-200 text-gray-600 line-through" : ""}>{inv.status}</Badge>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          {!isCancelled && Number(inv.outstanding_amount) > 0 && (
            <Button onClick={() => setShowPay(true)} className="bg-app-navy text-white"><CreditCard className="h-4 w-4 mr-1" /> Record Payment</Button>
          )}
          {!isCancelled && isCEO && (
            <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setShowCancel(true)}>
              <Ban className="h-4 w-4 mr-1" /> Cancel Bill
            </Button>
          )}
          {isCancelled && isCEO && !inv.replaced_by_id && (
            <Button onClick={recreateInvoice} className="bg-app-navy text-white">
              <RefreshCw className="h-4 w-4 mr-1" /> Re-create Invoice
            </Button>
          )}
        </div>
      </div>

      {isCancelled && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
          <div className="font-semibold text-destructive">CANCELLED on {formatDate(inv.cancelled_at!)}</div>
          <div className="mt-1">Reason: {inv.cancellation_reason ?? "—"}</div>
          {inv.replaced_by_id && (
            <Link to={`/app/invoices/${inv.replaced_by_id}/view`} className="text-app-navy underline mt-1 inline-block">
              View replacement invoice →
            </Link>
          )}
        </div>
      )}

      {inv.replaces_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs">
          This invoice replaces <Link to={`/app/invoices/${inv.replaces_id}/view`} className="underline">a cancelled invoice</Link>.
        </div>
      )}

      {/* Invoice card (printable) */}
      <div className="bg-white border-2 border-app-navy/30 rounded-lg p-6 print:border-black">
        <div className="flex justify-between items-start border-b-2 pb-3">
          <div>
            <div className="text-xl font-bold text-app-navy">{company.company_name}</div>
            <div className="text-xs">{company.iso_certification}</div>
            <div className="text-xs">GSTIN: {company.gst_number ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">TAX INVOICE</div>
            <div className="text-xs">GSTIN: {company.gst_number ?? "—"}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 py-3 text-sm">
          <div>
            <div><strong>Customer ID:</strong> {inv.clients?.client_code}</div>
            <div><strong>Customer Name:</strong> {inv.clients?.client_name}</div>
            <div><strong>Address:</strong> {inv.clients?.address ?? "—"}</div>
            <div><strong>GSTIN:</strong> {inv.clients?.gst_number ?? "—"}</div>
            <div><strong>Month:</strong> {inv.month}</div>
          </div>
          <div className="text-right">
            <div><strong>Invoice No:</strong> {inv.invoice_number}</div>
            <div><strong>Date:</strong> {formatDate(inv.invoice_date)}</div>
            <div><strong>Place of Supply:</strong> AP</div>
            <div><strong>Service Period:</strong> {formatDate(inv.service_period_from)} to {formatDate(inv.service_period_to)}</div>
          </div>
        </div>

        <table className="w-full text-sm border border-app-border">
          <thead className="bg-app-surface">
            <tr>
              <th className="p-1 border">QTY</th><th className="p-1 border">DESCRIPTION</th>
              <th className="p-1 border">SAC</th><th className="p-1 border">RATE</th>
              <th className="p-1 border">DAYS</th><th className="p-1 border">DUTIES</th>
              <th className="p-1 border text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="p-1 border">{l.qty}</td>
                <td className="p-1 border">{l.description}</td>
                <td className="p-1 border">{l.sac_code}</td>
                <td className="p-1 border text-right">{formatINR(l.rate_per_month)}</td>
                <td className="p-1 border text-right">{l.working_days}</td>
                <td className="p-1 border text-right">{l.no_of_duties}</td>
                <td className="p-1 border text-right tabular-nums">{formatINR(l.amount)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={6} className="p-1 border text-right">Total Taxable Value</td>
              <td className="p-1 border text-right tabular-nums">{formatINR(Number(inv.billing_amount))}</td>
            </tr>
            {inv.gst_applicable && !inv.gst_rcm && (
              <>
                <tr><td colSpan={6} className="p-1 border text-right">CGST @ {Number(inv.gst_percentage)/2}%</td><td className="p-1 border text-right">{formatINR(Number(inv.gst_amount)/2)}</td></tr>
                <tr><td colSpan={6} className="p-1 border text-right">SGST @ {Number(inv.gst_percentage)/2}%</td><td className="p-1 border text-right">{formatINR(Number(inv.gst_amount)/2)}</td></tr>
              </>
            )}
            {inv.gst_applicable && inv.gst_rcm && (
              <tr><td colSpan={7} className="p-1 border text-center text-yellow-700 font-semibold">GST HAS TO BE COLLECTED UNDER RCM</td></tr>
            )}
            <tr className="font-bold bg-app-surface">
              <td colSpan={6} className="p-1 border text-right">TOTAL INVOICE VALUE</td>
              <td className="p-1 border text-right tabular-nums">{formatINR(Number(inv.total_invoice_value))}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid md:grid-cols-2 gap-4 mt-3 text-xs">
          <div>
            <div><strong>PAN:</strong> {company.pan_number}</div>
            <div><strong>PF Code:</strong> {company.pf_code}</div>
            <div><strong>ESI Code:</strong> {company.esi_code}</div>
            <div><strong>Bank:</strong> {company.bank_name} — {company.bank_account_number} ({company.bank_ifsc})</div>
            <div><strong>Phone:</strong> {company.phone} | {company.email}</div>
          </div>
          <div className="text-right">
            <div className="italic">In words: {inv.amount_in_words ?? "—"}</div>
            <div className="mt-3 text-xs">{company.jurisdiction}</div>
            <div className="mt-6 pt-2 border-t">For {company.company_name}</div>
            <div className="text-xs text-app-muted">Authorised Signatory</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-app-muted">{company.registered_address}</div>
        <div className="text-xs text-center mt-2 italic">Thanking you and Assuring you of our best services all times</div>
      </div>

      {/* Internal summary */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm space-y-1 print:hidden">
        <h3 className="font-semibold text-app-navy mb-2">Internal Summary (not on PDF)</h3>
        <Row label="Amount Receivable" value={Number(inv.amount_receivable)} />
        <Row label="Total Deductions" value={Number(inv.total_deductions)} />
        <Row label="Net Margin" value={Number(inv.net_margin)} highlight />
        <Row label="Amount Received" value={Number(inv.amount_received)} />
        <Row label="Outstanding" value={Number(inv.outstanding_amount)} red={Number(inv.outstanding_amount) > 0} />
      </div>

      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={pay.payment_date} onChange={(e) => setPay({ ...pay, payment_date: e.target.value })} /></div>
            <div><Label>Amount</Label><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} /></div>
            <div>
              <Label>Mode</Label>
              <Select value={pay.mode} onValueChange={(v) => setPay({ ...pay, mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["NEFT","RTGS","Cheque","Cash","UPI"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference / UTR</Label><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
            <div><Label>Bank</Label><Input value={pay.bank} onChange={(e) => setPay({ ...pay, bank: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPay(false)}>Cancel</Button>
            <Button className="bg-app-navy text-white" onClick={recordPayment}>Save Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, highlight, red }: { label: string; value: number; highlight?: boolean; red?: boolean }) {
  return (
    <div className={`flex justify-between ${highlight ? "text-green-700 font-bold" : ""} ${red ? "text-red-600 font-bold" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{formatINR(value)}</span>
    </div>
  );
}
