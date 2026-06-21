import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCompanyProfileCache } from "@/hooks/useCompanyProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

interface ProfileForm {
  company_name: string; entity_type: string; pan_number: string; gst_number: string;
  gst_effective_from: string; cin_number: string; registered_address: string; state: string;
  phone: string; email: string; website: string;
  pf_code: string; esi_code: string; bank_account_number: string; bank_ifsc: string; bank_name: string;
  iso_certification: string; invoice_location_code: string; jurisdiction: string;
  logo_url: string;
}

const EMPTY: ProfileForm = {
  company_name: "", entity_type: "Proprietorship", pan_number: "", gst_number: "",
  gst_effective_from: "", cin_number: "", registered_address: "", state: "Andhra Pradesh",
  phone: "", email: "", website: "",
  pf_code: "", esi_code: "", bank_account_number: "", bank_ifsc: "", bank_name: "",
  iso_certification: "ISO:9001:2015", invoice_location_code: "NLR",
  jurisdiction: "Subject to Nellore Jurisdiction",
  logo_url: "",
};

export default function CompanyProfile() {
  const { role } = useAuth();
  const { isSandbox } = useEnvironment();
  const isCEO = role === "ceo_admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY);

  // Wipe sandbox dialog state
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeStep, setWipeStep] = useState<1 | 2>(1);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wiping, setWiping] = useState(false);

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
          pf_code: data.pf_code ?? "",
          esi_code: data.esi_code ?? "",
          bank_account_number: data.bank_account_number ?? "",
          bank_ifsc: data.bank_ifsc ?? "",
          bank_name: data.bank_name ?? "",
          iso_certification: data.iso_certification ?? "ISO:9001:2015",
          invoice_location_code: data.invoice_location_code ?? "NLR",
          jurisdiction: data.jurisdiction ?? "Subject to Nellore Jurisdiction",
          logo_url: data.logo_url ?? "",
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
      pf_code: form.pf_code || null,
      esi_code: form.esi_code || null,
      bank_account_number: form.bank_account_number || null,
      bank_ifsc: form.bank_ifsc || null,
      bank_name: form.bank_name || null,
      logo_url: form.logo_url || null,
    };
    const { error } = await supabase.from("company_profile").update(payload).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "UPDATE", table: "company_profile", recordId: id, newValues: payload });
    invalidateCompanyProfileCache();
    toast.success("Company profile updated");
  }

  async function doWipe() {
    setWiping(true);
    const { error } = await supabase.rpc("wipe_sandbox");
    setWiping(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sandbox data wiped");
    setWipeOpen(false); setWipeStep(1); setWipeConfirm("");
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Company Profile</h1>
        <p className="text-sm text-app-muted">Update legal, statutory, banking, and contact information.</p>
      </div>

      {/* Basic */}
      <Section title="Basic Details">
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
        <Field label="Logo URL (used in reports &amp; prints)" className="md:col-span-2">
          <div className="flex items-center gap-3">
            <Input placeholder="https://..." value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} className="flex-1" />
            {form.logo_url && <img src={form.logo_url} alt="logo preview" className="h-10 w-auto object-contain border rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
          </div>
        </Field>
        <Field label="Registered Address" className="md:col-span-2">
          <Textarea rows={3} value={form.registered_address} onChange={(e) => setForm({ ...form, registered_address: e.target.value })} />
        </Field>
      </Section>

      {/* Statutory & Bank */}
      <Section title="Statutory & Bank">
        <Field label="PF Code"><Input value={form.pf_code} onChange={(e) => setForm({ ...form, pf_code: e.target.value })} /></Field>
        <Field label="ESI Code"><Input value={form.esi_code} onChange={(e) => setForm({ ...form, esi_code: e.target.value })} /></Field>
        <Field label="Bank Name"><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
        <Field label="Bank Account Number"><Input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></Field>
        <Field label="Bank IFSC"><Input value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} /></Field>
        <Field label="ISO Certification"><Input value={form.iso_certification} onChange={(e) => setForm({ ...form, iso_certification: e.target.value })} /></Field>
        <Field label="Invoice Location Code"><Input value={form.invoice_location_code} onChange={(e) => setForm({ ...form, invoice_location_code: e.target.value })} /></Field>
        <Field label="Jurisdiction" className="md:col-span-2"><Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} /></Field>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-app-navy hover:bg-app-navy/90 text-white">
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save Changes
        </Button>
      </div>

      {/* Environment Card - CEO only — read-only, driven by deployment URL */}
      {isCEO && (
        <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-app-navy">Environment</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-app-muted">Current mode</div>
              <div className={`mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${isSandbox ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                {isSandbox ? "🟡 SANDBOX" : "🟢 PRODUCTION"}
              </div>
            </div>
            <p className="text-xs text-app-muted max-w-xs text-right">
              Environment is determined by the deployment URL and cannot be changed here.
              Use the sandbox URL to access test data.
            </p>
          </div>

          {isSandbox && (
            <div className="border-t border-app-border pt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" /> Wipe Sandbox Data
                  </div>
                  <p className="text-sm text-app-muted mt-1">
                    Permanently delete all sandbox paysheets, invoices, payments, ledger entries, billing lines, and wage configs.
                  </p>
                </div>
                <Button variant="destructive" onClick={() => { setWipeStep(1); setWipeConfirm(""); setWipeOpen(true); }}>
                  Wipe Sandbox
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wipe sandbox dialog */}
      <AlertDialog open={wipeOpen} onOpenChange={(o) => { setWipeOpen(o); if (!o) { setWipeStep(1); setWipeConfirm(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{wipeStep === 1 ? "Wipe sandbox data?" : "Type DELETE to confirm"}</AlertDialogTitle>
            <AlertDialogDescription>
              {wipeStep === 1
                ? "This will permanently remove every sandbox paysheet, invoice, payment, ledger entry, billing line, and wage config. Production data will not be touched."
                : "This action cannot be undone. Type DELETE in the box below to permanently wipe sandbox data."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {wipeStep === 2 && (
            <Input value={wipeConfirm} onChange={(e) => setWipeConfirm(e.target.value)} placeholder="Type DELETE" />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {wipeStep === 1 ? (
              <Button variant="destructive" onClick={() => setWipeStep(2)}>Continue</Button>
            ) : (
              <Button variant="destructive" onClick={doWipe} disabled={wipeConfirm !== "DELETE" || wiping}>
                {wiping && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Wipe Sandbox
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-app-navy">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (<div className={"space-y-1 " + (className ?? "")}><Label className="text-xs">{label}</Label>{children}</div>);
}
