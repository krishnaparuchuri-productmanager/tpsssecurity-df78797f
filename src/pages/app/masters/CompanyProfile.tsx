import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { Loader2 } from "lucide-react";

export default function CompanyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    entity_type: "Proprietorship",
    pan_number: "",
    gst_number: "",
    gst_effective_from: "",
    cin_number: "",
    registered_address: "",
    state: "Andhra Pradesh",
    phone: "",
    email: "",
    website: "",
  });

  useEffect(() => {
    supabase.from("company_profile").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setId(data.id);
        setForm({
          company_name: data.company_name ?? "",
          entity_type: data.entity_type ?? "Proprietorship",
          pan_number: data.pan_number ?? "",
          gst_number: data.gst_number ?? "",
          gst_effective_from: data.gst_effective_from ?? "",
          cin_number: data.cin_number ?? "",
          registered_address: data.registered_address ?? "",
          state: data.state ?? "Andhra Pradesh",
          phone: data.phone ?? "",
          email: data.email ?? "",
          website: data.website ?? "",
        });
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    if (!id) return;
    setSaving(true);
    const payload = {
      ...form,
      gst_effective_from: form.gst_effective_from || null,
      pan_number: form.pan_number || null,
      gst_number: form.gst_number || null,
      cin_number: form.cin_number || null,
    };
    const { error } = await supabase.from("company_profile").update(payload).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "UPDATE", table: "company_profile", recordId: id, newValues: payload });
    toast.success("Company profile updated");
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Company Profile</h1>
        <p className="text-sm text-app-muted">Update legal and contact information. Used in invoices and reports.</p>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Company Name"><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field>
        <Field label="Entity Type">
          <Select value={form.entity_type} onValueChange={(v) => setForm({ ...form, entity_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Proprietorship">Proprietorship</SelectItem>
              <SelectItem value="Private Limited">Private Limited</SelectItem>
              <SelectItem value="LLP">LLP</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="PAN Number"><Input value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value })} /></Field>
        <Field label="GST Number"><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></Field>
        <Field label="GST Effective From"><Input type="date" value={form.gst_effective_from ?? ""} onChange={(e) => setForm({ ...form, gst_effective_from: e.target.value })} /></Field>
        <Field label="CIN (Pvt Ltd / LLP only)"><Input value={form.cin_number} onChange={(e) => setForm({ ...form, cin_number: e.target.value })} /></Field>
        <Field label="State"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Website"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
        <Field label="Registered Address" className="md:col-span-2">
          <Textarea rows={3} value={form.registered_address} onChange={(e) => setForm({ ...form, registered_address: e.target.value })} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-app-navy hover:bg-app-navy/90 text-white">
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save Changes
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (<div className={"space-y-1 " + (className ?? "")}><Label className="text-xs">{label}</Label>{children}</div>);
}
