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

const schema = z.object({
  client_name: z.string().trim().min(1, "Required").max(150),
  service_type: z.enum(["Security", "Housekeeping", "Both"]),
  contract_value: z.number().nonnegative().optional().nullable(),
  contract_start_date: z.string().optional().nullable(),
  contract_end_date: z.string().optional().nullable(),
  tds_percentage: z.number().min(0).max(100),
  gst_applicable: z.boolean(),
  gst_percentage: z.number().min(0).max(100),
  gst_number: z.string().max(20).optional().nullable(),
  contact_person: z.string().max(100).optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
  contact_email: z.string().email().or(z.literal("")).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  is_active: z.boolean(),
  notes: z.string().max(1000).optional().nullable(),
});

interface MwRate {
  id?: string;
  designation: string;
  basic: number;
  da: number;
  ta: number;
  epf_mw_wages: number;
  esi_mw_wages: number;
  effective_from: string;
}

const empty: MwRate = {
  designation: "",
  basic: 0, da: 0, ta: 0, epf_mw_wages: 0, esi_mw_wages: 0,
  effective_from: new Date().toISOString().slice(0, 10),
};

export default function ClientForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    client_name: "",
    service_type: "Security" as "Security" | "Housekeeping" | "Both",
    contract_value: 0,
    contract_start_date: "",
    contract_end_date: "",
    tds_percentage: 1.0,
    gst_applicable: false,
    gst_percentage: 18.0,
    gst_number: "",
    contact_person: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    is_active: true,
    notes: "",
  });
  const [rates, setRates] = useState<MwRate[]>([{ ...empty }]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const [{ data: c }, { data: r }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id!).maybeSingle(),
        supabase.from("client_mw_rates").select("*").eq("client_id", id!),
      ]);
      if (c) {
        setForm({
          client_name: c.client_name ?? "",
          service_type: (c.service_type ?? "Security") as "Security" | "Housekeeping" | "Both",
          contract_value: Number(c.contract_value ?? 0),
          contract_start_date: c.contract_start_date ?? "",
          contract_end_date: c.contract_end_date ?? "",
          tds_percentage: Number(c.tds_percentage ?? 1),
          gst_applicable: !!c.gst_applicable,
          gst_percentage: Number(c.gst_percentage ?? 18),
          gst_number: c.gst_number ?? "",
          contact_person: c.contact_person ?? "",
          contact_phone: c.contact_phone ?? "",
          contact_email: c.contact_email ?? "",
          address: c.address ?? "",
          is_active: !!c.is_active,
          notes: c.notes ?? "",
        });
      }
      if (r && r.length > 0) {
        setRates(r.map((x) => ({
          id: x.id, designation: x.designation,
          basic: Number(x.basic), da: Number(x.da), ta: Number(x.ta),
          epf_mw_wages: Number(x.epf_mw_wages), esi_mw_wages: Number(x.esi_mw_wages),
          effective_from: x.effective_from,
        })));
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

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
        tds_percentage: form.tds_percentage,
        gst_applicable: form.gst_applicable,
        gst_percentage: form.gst_percentage,
        gst_number: form.gst_number || null,
        contact_person: form.contact_person || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        address: form.address || null,
        is_active: form.is_active,
        notes: form.notes || null,
      };

      let clientId = id ?? "";
      if (isEdit) {
        const { error } = await supabase.from("clients").update(payload).eq("id", id!);
        if (error) throw error;
        await logAudit({ action: "UPDATE", table: "clients", recordId: id!, newValues: payload });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("clients").insert({ ...payload, client_code: "", created_by: user?.id }).select("id").single();
        if (error) throw error;
        clientId = data.id;
        await logAudit({ action: "CREATE", table: "clients", recordId: clientId, newValues: payload });
      }

      // Replace rates
      await supabase.from("client_mw_rates").delete().eq("client_id", clientId);
      const validRates = rates.filter((r) => r.designation.trim());
      if (validRates.length > 0) {
        const { error } = await supabase.from("client_mw_rates").insert(
          validRates.map((r) => ({
            client_id: clientId,
            designation: r.designation.trim(),
            basic: r.basic, da: r.da, ta: r.ta,
            epf_mw_wages: r.epf_mw_wages, esi_mw_wages: r.esi_mw_wages,
            effective_from: r.effective_from,
          }))
        );
        if (error) throw error;
      }

      toast.success(isEdit ? "Client updated" : "Client created");
      if (addAnother) {
        setForm({ ...form, client_name: "", contract_value: 0, gst_number: "", contact_person: "", contact_phone: "", contact_email: "", address: "", notes: "" });
        setRates([{ ...empty }]);
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
    <div className="space-y-4 max-w-5xl">
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
          <Field label="Contract Value (₹)">
            <Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: Number(e.target.value) })} />
          </Field>
          <Field label="TDS %">
            <Input type="number" step="0.01" value={form.tds_percentage} onChange={(e) => setForm({ ...form, tds_percentage: Number(e.target.value) })} />
          </Field>
          <Field label="Contract Start">
            <Input type="date" value={form.contract_start_date ?? ""} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
          </Field>
          <Field label="Contract End">
            <Input type="date" value={form.contract_end_date ?? ""} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
          </Field>
          <Field label="GST Applicable">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={form.gst_applicable} onCheckedChange={(v) => setForm({ ...form, gst_applicable: v })} />
              <span className="text-sm text-muted-foreground">{form.gst_applicable ? "Yes" : "No"}</span>
            </div>
          </Field>
          {form.gst_applicable && (
            <>
              <Field label="GST %">
                <Input type="number" step="0.01" value={form.gst_percentage} onChange={(e) => setForm({ ...form, gst_percentage: Number(e.target.value) })} />
              </Field>
              <Field label="GST Number">
                <Input value={form.gst_number ?? ""} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Contact Person">
            <Input value={form.contact_person ?? ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          </Field>
          <Field label="Contact Phone">
            <Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </Field>
          <Field label="Contact Email">
            <Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </Field>
          <Field label="Status">
            <div className="flex items-center gap-2 h-10">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm text-muted-foreground">{form.is_active ? "Active" : "Inactive"}</span>
            </div>
          </Field>
          <Field label="Address" className="md:col-span-2">
            <Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </Field>
        </div>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-app-navy">Minimum Wage Rates</h2>
          <Button variant="outline" size="sm" onClick={() => setRates([...rates, { ...empty }])}>
            <Plus className="h-4 w-4 mr-1" /> Add Designation
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-app-muted">
                <th className="py-1">Designation</th>
                <th className="py-1">Basic</th>
                <th className="py-1">DA</th>
                <th className="py-1">TA</th>
                <th className="py-1">EPF MW</th>
                <th className="py-1">ESI MW</th>
                <th className="py-1">Effective From</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, idx) => (
                <tr key={idx}>
                  <td className="pr-2 py-1"><Input value={r.designation} placeholder="e.g. ASO" onChange={(e) => updateRate(idx, "designation", e.target.value)} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.basic} onChange={(e) => updateRate(idx, "basic", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.da} onChange={(e) => updateRate(idx, "da", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.ta} onChange={(e) => updateRate(idx, "ta", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.epf_mw_wages} onChange={(e) => updateRate(idx, "epf_mw_wages", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="number" value={r.esi_mw_wages} onChange={(e) => updateRate(idx, "esi_mw_wages", Number(e.target.value))} /></td>
                  <td className="pr-2 py-1"><Input type="date" value={r.effective_from} onChange={(e) => updateRate(idx, "effective_from", e.target.value)} /></td>
                  <td><Button variant="ghost" size="icon" onClick={() => setRates(rates.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></td>
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
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
        </Button>
      </div>
    </div>
  );

  function updateRate<K extends keyof MwRate>(idx: number, key: K, value: MwRate[K]) {
    const next = [...rates]; next[idx] = { ...next[idx], [key]: value }; setRates(next);
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
