import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { toISODate } from "@/lib/format";
import { useEnvironment } from "@/contexts/EnvironmentContext";

const schema = z.object({
  client_name: z.string().trim().min(1, "Required").max(150),
  service_type: z.enum(["Security", "Housekeeping", "Both"]),
});

interface WageRow {
  id?: string;
  designation: string;
  basic: number; da: number; ta: number;
  spl_allowance: number; conveyance_allowance: number; washing_allowance: number;
  weekly_off_allowance: number; four_hour_ot_rate: number;
  bonus_amount: number; relieving_charges: number; leave_wages: number;
  payable_gross: number; epf_mw_wages: number; esi_mw_wages: number;
  effective_from: string;
}

const emptyWage: WageRow = {
  designation: "", basic: 0, da: 0, ta: 0,
  spl_allowance: 0, conveyance_allowance: 0, washing_allowance: 0,
  weekly_off_allowance: 0, four_hour_ot_rate: 0,
  bonus_amount: 0, relieving_charges: 0, leave_wages: 0,
  payable_gross: 0, epf_mw_wages: 0, esi_mw_wages: 0,
  effective_from: new Date().toISOString().slice(0, 10),
};

interface BillingLine {
  id?: string;
  description: string; sac_code: string;
  rate_per_month: number; unit_label: string;
  sort_order: number; is_active: boolean;
}

const emptyLine: BillingLine = {
  description: "", sac_code: "998525",
  rate_per_month: 0, unit_label: "Guard",
  sort_order: 1, is_active: true,
};

interface DeductionRow {
  label: string;
  is_enabled: boolean;
  default_value: number;
  source: "manual" | "paysheet_net_salary" | "paysheet_pf_employer" | "paysheet_esi_employer";
}

const DEFAULT_DEDUCTION_ROWS: DeductionRow[] = [
  { label: "Net Salary Paid", is_enabled: true, default_value: 0, source: "paysheet_net_salary" },
  { label: "PF Employer Contribution", is_enabled: true, default_value: 0, source: "paysheet_pf_employer" },
  { label: "ESI Employer Contribution", is_enabled: true, default_value: 0, source: "paysheet_esi_employer" },
];

export default function ClientForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { isSandbox } = useEnvironment();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    client_name: "",
    service_type: "Security" as "Security" | "Housekeeping" | "Both",
    contract_value: 0,
    contract_start_date: "",
    contract_end_date: "",
    client_type: "company_firm" as "individual_huf" | "company_firm",
    tds_rate: 1.0,
    gst_applicable: false,
    gst_percentage: 18.0,
    gst_number: "",
    gst_rcm: false,
    invoice_prefix: "",
    pt_applicable: false,
    e_invoice_applicable: false,
    contact_person: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    is_active: true,
    notes: "",
  });
  const [wages, setWages] = useState<WageRow[]>([{ ...emptyWage }]);
  const [lines, setLines] = useState<BillingLine[]>([{ ...emptyLine }]);
  const [deductionTemplate, setDeductionTemplate] = useState<DeductionRow[]>(DEFAULT_DEDUCTION_ROWS);
  const [deductionTemplateId, setDeductionTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const [{ data: c }, { data: wg }, { data: bl }, { data: dt }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id!).maybeSingle(),
        supabase.from("client_wage_config").select("*").eq("client_id", id!).eq("is_current", true),
        supabase.from("client_billing_lines").select("*").eq("client_id", id!).eq("is_deleted", false).order("sort_order"),
        supabase.from("invoice_deduction_templates").select("*").eq("client_id", id!).maybeSingle(),
      ]);
      if (c) {
        setForm({
          client_name: c.client_name ?? "",
          service_type: (c.service_type ?? "Security") as "Security" | "Housekeeping" | "Both",
          contract_value: Number(c.contract_value ?? 0),
          contract_start_date: c.contract_start_date ?? "",
          contract_end_date: c.contract_end_date ?? "",
          client_type: (c.client_type ?? "company_firm") as "individual_huf" | "company_firm",
          tds_rate: Number(c.tds_rate ?? c.tds_percentage ?? 1),
          gst_applicable: !!c.gst_applicable,
          gst_percentage: Number(c.gst_percentage ?? 18),
          gst_number: c.gst_number ?? "",
          gst_rcm: !!c.gst_rcm,
          invoice_prefix: c.invoice_prefix ?? "",
          pt_applicable: !!c.pt_applicable,
          e_invoice_applicable: !!c.e_invoice_applicable,
          contact_person: c.contact_person ?? "",
          contact_phone: c.contact_phone ?? "",
          contact_email: c.contact_email ?? "",
          address: c.address ?? "",
          is_active: !!c.is_active,
          notes: c.notes ?? "",
        });
      }
      if (wg && wg.length > 0) {
        setWages(wg.map((x) => ({
          id: x.id, designation: x.designation,
          basic: Number(x.basic), da: Number(x.da), ta: Number(x.ta),
          spl_allowance: Number(x.spl_allowance), conveyance_allowance: Number(x.conveyance_allowance),
          washing_allowance: Number(x.washing_allowance), weekly_off_allowance: Number(x.weekly_off_allowance),
          four_hour_ot_rate: Number(x.four_hour_ot_rate), bonus_amount: Number(x.bonus_amount),
          relieving_charges: Number(x.relieving_charges), leave_wages: Number(x.leave_wages),
          payable_gross: Number(x.payable_gross), epf_mw_wages: Number(x.epf_mw_wages), esi_mw_wages: Number(x.esi_mw_wages),
          effective_from: x.effective_from,
        })));
      }
      if (bl && bl.length > 0) {
        setLines(bl.map((x) => ({
          id: x.id, description: x.description, sac_code: x.sac_code ?? "",
          rate_per_month: Number(x.rate_per_month), unit_label: x.unit_label,
          sort_order: x.sort_order, is_active: x.is_active,
        })));
      }
      if (dt) {
        setDeductionTemplateId(dt.id);
        setDeductionTemplate((dt.template_rows as unknown as DeductionRow[]) ?? DEFAULT_DEDUCTION_ROWS);
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

  function setClientType(v: "individual_huf" | "company_firm") {
    setForm({ ...form, client_type: v, tds_rate: v === "individual_huf" ? 2.0 : 1.0 });
  }

  async function save(addAnother: boolean) {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_name: form.client_name.trim(),
        service_type: form.service_type,
        contract_value: form.contract_value,
        contract_start_date: toISODate(form.contract_start_date),
        contract_end_date: toISODate(form.contract_end_date),
        client_type: form.client_type,
        tds_rate: form.tds_rate,
        tds_percentage: form.tds_rate,
        gst_applicable: form.gst_applicable,
        gst_percentage: form.gst_percentage,
        gst_number: form.gst_number || null,
        gst_rcm: form.gst_applicable ? form.gst_rcm : false,
        invoice_prefix: form.invoice_prefix || null,
        pt_applicable: form.pt_applicable,
        e_invoice_applicable: form.e_invoice_applicable,
        contact_person: form.contact_person || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        address: form.address || null,
        is_active: form.is_active,
        notes: form.notes || null,
        is_sandbox: isSandbox,
      };

      let clientId = id ?? "";
      const { data: { user } } = await supabase.auth.getUser();

      if (isEdit) {
        const { error } = await supabase.from("clients").update(payload).eq("id", id!);
        if (error) throw error;
        await logAudit({ action: "UPDATE", table: "clients", recordId: id!, newValues: payload });
      } else {
        const { data, error } = await supabase.from("clients").insert({ ...payload, client_code: "", created_by: user?.id }).select("id").single();
        if (error) throw error;
        clientId = data.id;
        await logAudit({ action: "CREATE", table: "clients", recordId: clientId, newValues: payload });
      }

      // Wage config — insert new versions; trigger version_wage_config closes prior
      const validWages = wages.filter((w) => w.designation.trim());
      if (validWages.length > 0) {
        const { error } = await supabase.from("client_wage_config").insert(
          validWages.map((w) => ({
            client_id: clientId,
            designation: w.designation.trim(),
            basic: w.basic, da: w.da, ta: w.ta,
            spl_allowance: w.spl_allowance, conveyance_allowance: w.conveyance_allowance,
            washing_allowance: w.washing_allowance, weekly_off_allowance: w.weekly_off_allowance,
            four_hour_ot_rate: w.four_hour_ot_rate, bonus_amount: w.bonus_amount,
            relieving_charges: w.relieving_charges, leave_wages: w.leave_wages,
            payable_gross: w.payable_gross, epf_mw_wages: w.epf_mw_wages, esi_mw_wages: w.esi_mw_wages,
            effective_from: w.effective_from, is_current: true,
            created_by: user?.id, is_sandbox: isSandbox,
          }))
        );
        if (error) throw error;
      }

      // Billing lines — soft delete then re-insert
      if (isEdit) {
        await supabase.from("client_billing_lines").update({ is_deleted: true }).eq("client_id", clientId);
      }
      const validLines = lines.filter((l) => l.description.trim());
      if (validLines.length > 0) {
        const { error } = await supabase.from("client_billing_lines").insert(
          validLines.map((l, idx) => ({
            client_id: clientId,
            description: l.description.trim(),
            sac_code: l.sac_code || null,
            rate_per_month: l.rate_per_month,
            unit_label: l.unit_label || "Guard",
            sort_order: l.sort_order || idx + 1,
            is_active: l.is_active,
            is_sandbox: isSandbox,
          }))
        );
        if (error) throw error;
      }

      // Deduction template
      const tplJson = JSON.parse(JSON.stringify(deductionTemplate));
      if (deductionTemplateId) {
        await supabase.from("invoice_deduction_templates").update({
          template_rows: tplJson,
          updated_by: user?.id,
        }).eq("id", deductionTemplateId);
      } else {
        await supabase.from("invoice_deduction_templates").insert({
          client_id: clientId,
          template_rows: tplJson,
          updated_by: user?.id,
        });
      }

      toast.success(isEdit ? "Client updated" : "Client created");
      if (addAnother) {
        setForm({ ...form, client_name: "", contract_value: 0, gst_number: "", contact_person: "", contact_phone: "", contact_email: "", address: "", notes: "" });
        setWages([{ ...emptyWage }]);
        setLines([{ ...emptyLine }]);
        setDeductionTemplate(DEFAULT_DEDUCTION_ROWS);
      } else {
        navigate("/app/masters/clients");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold text-app-navy">{isEdit ? "Edit Client" : "Add New Client"}</h1>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-app-navy">Client Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Client Name *">
            <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </Field>
          <Field label="Client Type">
            <Select value={form.client_type} onValueChange={(v) => setClientType(v as "individual_huf" | "company_firm")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company_firm">Company / Firm (TDS 1%)</SelectItem>
                <SelectItem value="individual_huf">Individual / HUF (TDS 2%)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Service Type">
            <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v as "Security" | "Housekeeping" | "Both" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Security">Security</SelectItem>
                <SelectItem value="Housekeeping">Housekeeping</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="TDS Rate %"><Input type="number" step="0.01" value={form.tds_rate} onChange={(e) => setForm({ ...form, tds_rate: Number(e.target.value) })} /></Field>
          <Field label="Contract Value (₹)"><Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: Number(e.target.value) })} /></Field>
          <Field label="Invoice Prefix (optional)"><Input value={form.invoice_prefix} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} placeholder="defaults to NLR" /></Field>
          <Field label="Contract Start"><Input type="date" value={form.contract_start_date ?? ""} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} /></Field>
          <Field label="Contract End"><Input type="date" value={form.contract_end_date ?? ""} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} /></Field>

          <Field label="GST Applicable">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={form.gst_applicable} onCheckedChange={(v) => setForm({ ...form, gst_applicable: v })} />
              <span className="text-sm text-muted-foreground">{form.gst_applicable ? "Yes" : "No"}</span>
            </div>
          </Field>
          {form.gst_applicable && (
            <>
              <Field label="GST %"><Input type="number" step="0.01" value={form.gst_percentage} onChange={(e) => setForm({ ...form, gst_percentage: Number(e.target.value) })} /></Field>
              <Field label="GST Number"><Input value={form.gst_number ?? ""} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></Field>
              <Field label="GST under Reverse Charge (RCM)">
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={form.gst_rcm} onCheckedChange={(v) => setForm({ ...form, gst_rcm: v })} />
                  <span className="text-sm text-muted-foreground">{form.gst_rcm ? "Yes — recipient pays GST" : "No"}</span>
                </div>
              </Field>
            </>
          )}
          <Field label="Professional Tax Applicable">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={form.pt_applicable} onCheckedChange={(v) => setForm({ ...form, pt_applicable: v })} />
              <span className="text-sm text-muted-foreground">{form.pt_applicable ? "Yes" : "No"}</span>
            </div>
          </Field>
          <Field label="E-Invoice Applicable">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={form.e_invoice_applicable} onCheckedChange={(v) => setForm({ ...form, e_invoice_applicable: v })} />
              <span className="text-sm text-muted-foreground">{form.e_invoice_applicable ? "Yes" : "No"}</span>
            </div>
          </Field>

          <Field label="Contact Person"><Input value={form.contact_person ?? ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
          <Field label="Contact Phone"><Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
          <Field label="Contact Email"><Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
          <Field label="Status">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm text-muted-foreground">{form.is_active ? "Active" : "Inactive"}</span>
            </div>
          </Field>
          <Field label="Address" className="md:col-span-2"><Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></Field>
          <Field label="Notes" className="md:col-span-2"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></Field>
        </div>
      </div>

      {/* Wage Config */}
      <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-app-navy">Wage Configuration</h2>
            <p className="text-xs text-app-muted">New rows create new versions; previous versions are auto-closed.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setWages([...wages, { ...emptyWage }])}>
            <Plus className="h-4 w-4 mr-1" /> Add Designation
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-1 pr-2">Designation</th>
                <th className="py-1 pr-2">Basic</th>
                <th className="py-1 pr-2">DA</th>
                <th className="py-1 pr-2">TA</th>
                <th className="py-1 pr-2">Spl</th>
                <th className="py-1 pr-2">Conveyance</th>
                <th className="py-1 pr-2">Washing</th>
                <th className="py-1 pr-2">WO</th>
                <th className="py-1 pr-2">4hr OT</th>
                <th className="py-1 pr-2">Bonus</th>
                <th className="py-1 pr-2">Relieving</th>
                <th className="py-1 pr-2">Leave Wages</th>
                <th className="py-1 pr-2">EPF MW</th>
                <th className="py-1 pr-2">ESI MW</th>
                <th className="py-1 pr-2">Effective From</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wages.map((r, idx) => (
                <tr key={idx}>
                  <td className="pr-2 py-1"><Input value={r.designation} placeholder="e.g. ASO" onChange={(e) => updateWage(idx, "designation", e.target.value)} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.basic} onChange={(e) => updateWage(idx, "basic", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.da} onChange={(e) => updateWage(idx, "da", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.ta} onChange={(e) => updateWage(idx, "ta", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.spl_allowance} onChange={(e) => updateWage(idx, "spl_allowance", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.conveyance_allowance} onChange={(e) => updateWage(idx, "conveyance_allowance", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.washing_allowance} onChange={(e) => updateWage(idx, "washing_allowance", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.weekly_off_allowance} onChange={(e) => updateWage(idx, "weekly_off_allowance", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.four_hour_ot_rate} onChange={(e) => updateWage(idx, "four_hour_ot_rate", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.bonus_amount} onChange={(e) => updateWage(idx, "bonus_amount", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.relieving_charges} onChange={(e) => updateWage(idx, "relieving_charges", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.leave_wages} onChange={(e) => updateWage(idx, "leave_wages", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.epf_mw_wages} onChange={(e) => updateWage(idx, "epf_mw_wages", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.esi_mw_wages} onChange={(e) => updateWage(idx, "esi_mw_wages", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="date" value={r.effective_from} onChange={(e) => updateWage(idx, "effective_from", e.target.value)} /></td>
                  <td><Button variant="ghost" size="icon" onClick={() => setWages(wages.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Billing Lines */}
      <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-app-navy">Invoice Billing Lines</h2>
          <Button variant="outline" size="sm" onClick={() => setLines([...lines, { ...emptyLine, sort_order: lines.length + 1 }])}>
            <Plus className="h-4 w-4 mr-1" /> Add Line
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-1 pr-2">Description</th>
                <th className="py-1 pr-2">SAC Code</th>
                <th className="py-1 pr-2">Unit Label</th>
                <th className="py-1 pr-2">Rate / Month</th>
                <th className="py-1 pr-2">Order</th>
                <th className="py-1 pr-2">Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td className="pr-2 py-1"><Input value={l.description} placeholder="e.g. Security Services" onChange={(e) => updateLine(idx, "description", e.target.value)} /></td>
                  <td className="pr-2 py-1"><Input value={l.sac_code} placeholder="998525" onChange={(e) => updateLine(idx, "sac_code", e.target.value)} /></td>
                  <td className="pr-2 py-1"><Input value={l.unit_label} onChange={(e) => updateLine(idx, "unit_label", e.target.value)} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={l.rate_per_month} onChange={(e) => updateLine(idx, "rate_per_month", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1 w-20"><Input type="number" value={l.sort_order} onChange={(e) => updateLine(idx, "sort_order", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Switch checked={l.is_active} onCheckedChange={(v) => updateLine(idx, "is_active", v)} /></td>
                  <td><Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deduction Template */}
      <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-app-navy">Invoice Deduction Template</h2>
            <p className="text-xs text-app-muted">Used internally to compute net margin on each invoice for this client.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDeductionTemplate([...deductionTemplate, { label: "", is_enabled: true, default_value: 0, source: "manual" }])}>
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-1 pr-2">Enabled</th>
                <th className="py-1 pr-2">Label</th>
                <th className="py-1 pr-2">Source</th>
                <th className="py-1 pr-2">Default Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deductionTemplate.map((d, idx) => (
                <tr key={idx}>
                  <td className="pr-2 py-1"><Switch checked={d.is_enabled} onCheckedChange={(v) => updateDeduction(idx, "is_enabled", v)} /></td>
                  <td className="pr-2 py-1"><Input value={d.label} onChange={(e) => updateDeduction(idx, "label", e.target.value)} /></td>
                  <td className="pr-2 py-1">
                    <Select value={d.source} onValueChange={(v) => updateDeduction(idx, "source", v as DeductionRow["source"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="paysheet_net_salary">Paysheet — Net Salary</SelectItem>
                        <SelectItem value="paysheet_pf_employer">Paysheet — PF Employer</SelectItem>
                        <SelectItem value="paysheet_esi_employer">Paysheet — ESI Employer</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="pr-2 py-1"><Input type="number" value={d.default_value} onChange={(e) => updateDeduction(idx, "default_value", Number(e.target.value))} /></td>
                  <td><Button variant="ghost" size="icon" onClick={() => setDeductionTemplate(deductionTemplate.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => navigate("/app/masters/clients")}>Cancel</Button>
        {!isEdit && <Button variant="secondary" onClick={() => save(true)} disabled={saving}>Save & Add Another</Button>}
        <Button className="bg-app-navy hover:bg-app-navy/90 text-white" onClick={() => save(false)} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} {isSandbox ? "Save to Sandbox" : "Save"}
        </Button>
      </div>
    </div>
  );

  function updateWage<K extends keyof WageRow>(idx: number, key: K, value: WageRow[K]) {
    const next = [...wages]; next[idx] = { ...next[idx], [key]: value }; setWages(next);
  }
  function updateLine<K extends keyof BillingLine>(idx: number, key: K, value: BillingLine[K]) {
    const next = [...lines]; next[idx] = { ...next[idx], [key]: value }; setLines(next);
  }
  function updateDeduction<K extends keyof DeductionRow>(idx: number, key: K, value: DeductionRow[K]) {
    const next = [...deductionTemplate]; next[idx] = { ...next[idx], [key]: value }; setDeductionTemplate(next);
  }
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"space-y-1 " + (className ?? "")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
