import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { calcInvoicePreview, r2 } from "@/lib/calc";
import { formatINR } from "@/lib/format";

interface BillingLine {
  qty: number; description: string; sac_code: string;
  rate_per_month: number; working_days: number; no_of_duties: number; amount: number;
}
interface DeductionRow {
  label: string; source: string; value: number; is_enabled: boolean;
}

const SAC_SUGGESTIONS = ["998525", "998533", "998519", "998539"];

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [params] = useSearchParams();
  const paysheetParam = params.get("paysheet");
  const { isSandbox } = useEnvironment();
  const { user } = useAuth();

  const [clients, setClients] = useState<Array<{ id: string; client_name: string; client_code: string;
    contact_email: string | null; address: string | null; gst_number: string | null;
    gst_applicable: boolean; gst_rcm: boolean; gst_percentage: number;
    tds_percentage: number; tds_rate: number; }>>([]);
  const [clientId, setClientId] = useState("");
  const [paysheetId, setPaysheetId] = useState<string | null>(paysheetParam);

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [monthDate, setMonthDate] = useState(new Date().toISOString().slice(0, 10).replace(/\d{2}$/, "01"));
  const [month, setMonth] = useState(new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase().replace(" ", "-"));
  const [billingLines, setBillingLines] = useState<BillingLine[]>([]);
  const [tdsPct, setTdsPct] = useState(1);
  const [gstApplicable, setGstApplicable] = useState(false);
  const [gstRcm, setGstRcm] = useState(false);
  const [gstPct, setGstPct] = useState(18);
  const [deductionRows, setDeductionRows] = useState<DeductionRow[]>([]);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load clients
  useEffect(() => {
    supabase.from("clients").select("*")
      .eq("is_active", true).eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("client_name")
      .then(({ data }) => setClients((data ?? []) as unknown as typeof clients));
  }, [isSandbox]);

  // On client change → load billing lines + deduction template
  useEffect(() => {
    if (!clientId) return;
    const c = clients.find((x) => x.id === clientId);
    if (c) {
      setGstApplicable(!!c.gst_applicable);
      setGstRcm(!!c.gst_rcm);
      setGstPct(Number(c.gst_percentage ?? 18));
      setTdsPct(Number(c.tds_rate ?? c.tds_percentage ?? 1));
    }
    (async () => {
      const [{ data: lines }, { data: tpl }] = await Promise.all([
        supabase.from("client_billing_lines").select("*")
          .eq("client_id", clientId).eq("is_active", true).eq("is_deleted", false)
          .order("sort_order"),
        supabase.from("invoice_deduction_templates").select("template_rows").eq("client_id", clientId).maybeSingle(),
      ]);
      if (lines && lines.length > 0) {
        setBillingLines(lines.map((l) => ({
          qty: 1, description: l.description, sac_code: l.sac_code ?? "",
          rate_per_month: Number(l.rate_per_month), working_days: 30, no_of_duties: 30,
          amount: Number(l.rate_per_month),
        })));
      }
      if (tpl?.template_rows) {
        const rows = (tpl.template_rows as unknown as Array<{ label: string; source: string; default_value?: number; is_enabled: boolean }>)
          .map((r) => ({ label: r.label, source: r.source, value: Number(r.default_value ?? 0), is_enabled: !!r.is_enabled }));
        setDeductionRows(rows);
      } else {
        setDeductionRows([
          { label: "Net Salary", source: "auto_net_sal", value: 0, is_enabled: true },
          { label: "PF Employer (13%)", source: "auto_pf", value: 0, is_enabled: true },
          { label: "ESI Employer (3.25%)", source: "auto_esi", value: 0, is_enabled: true },
          { label: "Uniform Amount", source: "manual", value: 0, is_enabled: false },
        ]);
      }
    })();
  }, [clientId, clients]);

  // Pre-fill from paysheet
  useEffect(() => {
    if (!paysheetId) return;
    (async () => {
      const { data: ps } = await supabase.from("paysheets").select("client_id, month, month_date, total_net_salary, total_epf_employer, total_esi_employer").eq("id", paysheetId).maybeSingle();
      if (ps) {
        setClientId(ps.client_id);
        setMonth(ps.month);
        setMonthDate(ps.month_date);
        setDeductionRows((cur) => cur.map((d) => {
          if (d.source === "auto_net_sal") return { ...d, value: Number(ps.total_net_salary) };
          if (d.source === "auto_pf") return { ...d, value: Number(ps.total_epf_employer) };
          if (d.source === "auto_esi") return { ...d, value: Number(ps.total_esi_employer) };
          return d;
        }));
      }
    })();
  }, [paysheetId]);

  // Load existing invoice
  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
      if (data) {
        setClientId(data.client_id);
        setPaysheetId(data.paysheet_id);
        setInvoiceDate(data.invoice_date);
        setMonth(data.month); setMonthDate(data.month_date);
        setBillingLines(data.billing_lines as unknown as BillingLine[]);
        setTdsPct(Number(data.tds_percentage));
        setGstApplicable(!!data.gst_applicable); setGstRcm(!!data.gst_rcm);
        setGstPct(Number(data.gst_percentage));
        setDeductionRows(data.deduction_rows as unknown as DeductionRow[]);
        setInvoiceNotes(data.invoice_notes ?? "");
      }
    })();
  }, [id, isEdit]);

  function updateLine(i: number, patch: Partial<BillingLine>) {
    setBillingLines((cur) => {
      const next = [...cur];
      const merged = { ...next[i], ...patch };
      merged.amount = r2((merged.qty || 0) * (merged.rate_per_month || 0));
      next[i] = merged;
      return next;
    });
  }

  const preview = calcInvoicePreview({
    billingLines, tdsPct, gstApplicable, gstRcm, gstPct, amountReceived: 0, deductionRows,
  });

  async function save(markSent = false) {
    if (!clientId) return toast.error("Client required");
    if (billingLines.length === 0) return toast.error("Add at least one billing line");
    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        paysheet_id: paysheetId,
        month, month_date: monthDate, invoice_date: invoiceDate,
        billing_lines: billingLines as unknown as never,
        tds_percentage: tdsPct,
        gst_applicable: gstApplicable, gst_rcm: gstRcm, gst_percentage: gstPct,
        deduction_rows: deductionRows as unknown as never,
        invoice_notes: invoiceNotes || null,
        is_sandbox: isSandbox,
        created_by: user?.id,
        status: markSent ? "sent" as const : "draft" as const,
      };
      let invId = id;
      if (isEdit && id) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("invoices").insert({ ...payload, invoice_number: "" } as never).select("id").single();
        if (error) throw error;
        invId = data.id;
      }
      await logAudit({ action: isEdit ? "UPDATE" : "CREATE", table: "invoices", recordId: invId!, newValues: payload });
      toast.success(isEdit ? "Invoice updated" : "Invoice created");
      navigate(`/app/invoices/${invId}/view`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const client = clients.find((c) => c.id === clientId);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold text-app-navy">{isEdit ? "Edit Invoice" : "Create Invoice"}</h1>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-4 grid md:grid-cols-3 gap-4">
        <div>
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Invoice Date</Label>
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
        <div>
          <Label>Month (label)</Label>
          <Input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="MAR-2026" />
        </div>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-app-navy">Billing Lines</h2>
          <Button size="sm" variant="outline" onClick={() => setBillingLines([...billingLines, { qty: 1, description: "", sac_code: "998525", rate_per_month: 0, working_days: 30, no_of_duties: 30, amount: 0 }])}>
            <Plus className="h-3 w-3 mr-1" /> Add Row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-app-muted">
              <tr>
                <th className="p-1">QTY</th><th className="p-1">DESCRIPTION</th><th className="p-1">SAC</th>
                <th className="p-1">RATE/MONTH</th><th className="p-1">DAYS</th><th className="p-1">DUTIES</th>
                <th className="p-1 text-right">AMOUNT</th><th></th>
              </tr>
            </thead>
            <tbody>
              {billingLines.map((l, i) => (
                <tr key={i} className="border-t border-app-border">
                  <td className="p-1"><Input className="h-8 w-16" type="number" value={l.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} /></td>
                  <td className="p-1"><Input className="h-8" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} /></td>
                  <td className="p-1">
                    <Input className="h-8 w-24" list="sacs" value={l.sac_code} onChange={(e) => updateLine(i, { sac_code: e.target.value })} />
                  </td>
                  <td className="p-1"><Input className="h-8 w-24" type="number" value={l.rate_per_month} onChange={(e) => updateLine(i, { rate_per_month: Number(e.target.value) })} /></td>
                  <td className="p-1"><Input className="h-8 w-16" type="number" value={l.working_days} onChange={(e) => updateLine(i, { working_days: Number(e.target.value) })} /></td>
                  <td className="p-1"><Input className="h-8 w-16" type="number" value={l.no_of_duties} onChange={(e) => updateLine(i, { no_of_duties: Number(e.target.value) })} /></td>
                  <td className="p-1 text-right tabular-nums font-semibold">{formatINR(l.amount)}</td>
                  <td><Button variant="ghost" size="icon" onClick={() => setBillingLines(billingLines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="sacs">{SAC_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        </div>

        <div className="grid md:grid-cols-3 gap-3 pt-2">
          <div>
            <Label>TDS %</Label>
            <Input type="number" step="0.01" value={tdsPct} onChange={(e) => setTdsPct(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <Label>GST applicable</Label>
              <div className="h-10 flex items-center"><Switch checked={gstApplicable} onCheckedChange={setGstApplicable} /></div>
            </div>
            {gstApplicable && (
              <>
                <div>
                  <Label>RCM</Label>
                  <div className="h-10 flex items-center"><Switch checked={gstRcm} onCheckedChange={setGstRcm} /></div>
                </div>
                <div>
                  <Label>GST %</Label>
                  <Input type="number" step="0.01" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Deductions (internal) */}
      <div className="bg-white border border-app-border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-app-navy">Internal Deductions (not on client PDF)</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={!clientId}
            onClick={async () => {
              if (!clientId) return;
              const tpl = deductionRows.map((d) => ({
                label: d.label, source: d.source,
                default_value: d.value, is_enabled: d.is_enabled,
              }));
              const { data: existing } = await supabase
                .from("invoice_deduction_templates")
                .select("id").eq("client_id", clientId).maybeSingle();
              const payload = {
                client_id: clientId,
                template_rows: tpl as unknown as never,
                updated_by: user?.id ?? null,
              };
              const { error } = existing
                ? await supabase.from("invoice_deduction_templates").update(payload).eq("id", existing.id)
                : await supabase.from("invoice_deduction_templates").insert(payload as never);
              if (error) toast.error(error.message);
              else toast.success("Saved as client default template");
            }}
          >
            Save as default template for client
          </Button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {deductionRows.map((d, i) => (
              <tr key={i} className="border-t border-app-border">
                <td className="p-1 w-10">
                  <Switch checked={d.is_enabled} onCheckedChange={(v) => setDeductionRows((cur) => cur.map((x, j) => j === i ? { ...x, is_enabled: v } : x))} />
                </td>
                <td className="p-1"><Input className="h-8" value={d.label} onChange={(e) => setDeductionRows((cur) => cur.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /></td>
                <td className="p-1 w-32"><Input className="h-8" type="number" value={d.value} onChange={(e) => setDeductionRows((cur) => cur.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x))} /></td>
                <td className="w-10"><Button variant="ghost" size="icon" onClick={() => setDeductionRows(deductionRows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button size="sm" variant="outline" onClick={() => setDeductionRows([...deductionRows, { label: "", source: "manual", value: 0, is_enabled: true }])}>
          <Plus className="h-3 w-3 mr-1" /> Add Custom Deduction
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-app-border rounded-lg p-4">
          <Label>Notes</Label>
          <Textarea rows={4} value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} />
        </div>
        <div className="bg-white border border-app-border rounded-lg p-4 text-sm space-y-1">
          <Row label="Billing Amount" value={preview.billing_amount} />
          {gstApplicable && !gstRcm && <Row label={`GST @ ${gstPct}%`} value={preview.gst_amount} />}
          {gstApplicable && gstRcm && <div className="text-xs text-yellow-700">GST has to be collected under RCM</div>}
          <Row label={`TDS @ ${tdsPct}%`} value={-preview.tds_amount} />
          <Row label="Total Invoice Value" value={preview.total_invoice_value} bold />
          <Row label="Amount Receivable" value={preview.amount_receivable} />
          <Row label="Total Deductions" value={-preview.total_deductions} />
          <Row label="Net Margin" value={preview.net_margin} highlight />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} <Save className="h-4 w-4 mr-1" /> Save Draft
        </Button>
        <Button onClick={() => save(true)} disabled={saving} className="bg-app-navy text-white">Save & Mark as Sent</Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: number; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""} ${highlight ? "text-green-700 font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatINR(value)}</span>
    </div>
  );
}
