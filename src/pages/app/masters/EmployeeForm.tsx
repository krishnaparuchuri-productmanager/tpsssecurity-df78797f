import { useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import { formatINR, toISODate } from "@/lib/format";

const DESIGNATIONS = ["ASO", "S.GUARD", "WRITER", "SUPERVISOR", "FIELD OFFICER"];

// Optional-or-empty regex helper: allows blank string OR exact regex match
const optionalRegex = (re: RegExp, message: string) =>
  z.string().trim().refine((v) => v === "" || re.test(v), { message });

const schema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(150, "Full name too long"),
  designation: z.string().min(1, "Designation is required"),
  client_id: z.string().uuid().or(z.literal("")),
  date_of_joining: z.string().min(1, "Date of joining is required"),
  status: z.enum(["Active", "Relieved", "Absconded"]),
  aadhaar_number: optionalRegex(/^[0-9]{12}$/, "Aadhaar must be exactly 12 digits"),
  uan_number: optionalRegex(/^[0-9]{12}$/, "UAN must be exactly 12 digits"),
  esi_number: optionalRegex(/^[0-9]{17}$/, "ESI must be exactly 17 digits"),
  bank_ifsc: optionalRegex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC must match format AAAA0XXXXXX (uppercase)"),
  bank_account_number: optionalRegex(/^[0-9]{9,18}$/, "Bank account must be 9–18 digits"),
  mobile: optionalRegex(/^[0-9]{10}$/, "Mobile must be exactly 10 digits"),
});

interface ClientLite { id: string; client_name: string; }
interface Rate { designation: string; basic: number; da: number; ta: number; }

export default function EmployeeForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientRates, setClientRates] = useState<Rate[]>([]);

  const [form, setForm] = useState({
    full_name: "",
    designation: "S.GUARD",
    client_id: "",
    date_of_joining: new Date().toISOString().slice(0, 10),
    date_of_leaving: "",
    status: "Active" as "Active" | "Relieved" | "Absconded",
    is_new_joiner: false,
    notes: "",
    uan_number: "",
    esi_number: "",
    aadhaar_number: "",
    epf_exempt: false,
    esi_exempt: false,
    basic: 0, da: 0, ta: 0,
    weekly_off_allowance: 0, washing_allowance: 0,
    conveyance_allowance: 0, spl_allowance: 0,
    four_hour_ot_rate: 0, bonus_amount: 0, relieving_charges: 0, leave_wages: 0,
    bank_name: "", bank_account_number: "", bank_ifsc: "",
    mobile: "",
  });

  useEffect(() => {
    supabase.from("clients").select("id, client_name").eq("is_active", true).order("client_name").then(({ data }) => setClients((data ?? []) as ClientLite[]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data } = await supabase.from("employees").select("*").eq("id", id!).maybeSingle();
      if (data) {
        setForm({
          full_name: data.full_name,
          designation: data.designation,
          client_id: data.client_id ?? "",
          date_of_joining: data.date_of_joining,
          date_of_leaving: data.date_of_leaving ?? "",
          status: data.status as "Active" | "Relieved" | "Absconded",
          is_new_joiner: !!data.is_new_joiner,
          notes: data.notes ?? "",
          uan_number: data.uan_number ?? "",
          esi_number: data.esi_number ?? "",
          aadhaar_number: data.aadhaar_number ?? "",
          epf_exempt: !!data.epf_exempt,
          esi_exempt: !!data.esi_exempt,
          basic: Number(data.basic ?? 0), da: Number(data.da ?? 0), ta: Number(data.ta ?? 0),
          weekly_off_allowance: Number(data.weekly_off_allowance ?? 0),
          washing_allowance: Number(data.washing_allowance ?? 0),
          conveyance_allowance: Number(data.conveyance_allowance ?? 0),
          spl_allowance: Number(data.spl_allowance ?? 0),
          four_hour_ot_rate: Number((data as any).four_hour_ot_rate ?? 0),
          bonus_amount: Number((data as any).bonus_amount ?? 0),
          relieving_charges: Number((data as any).relieving_charges ?? 0),
          leave_wages: Number((data as any).leave_wages ?? 0),
          bank_name: data.bank_name ?? "",
          bank_account_number: data.bank_account_number ?? "",
          bank_ifsc: data.bank_ifsc ?? "",
          mobile: data.mobile ?? "",
        });
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

  // Load MW rates when client changes
  useEffect(() => {
    if (!form.client_id) { setClientRates([]); return; }
    supabase.from("client_mw_rates").select("designation, basic, da, ta").eq("client_id", form.client_id).then(({ data }) => setClientRates((data ?? []) as Rate[]));
  }, [form.client_id]);

  // Auto-fill basic/da/ta when designation changes (only if user hasn't entered values yet — for new records)
  useEffect(() => {
    if (isEdit) return;
    const match = clientRates.find((r) => r.designation.toUpperCase() === form.designation.toUpperCase());
    if (match) setForm((f) => ({ ...f, basic: match.basic, da: match.da, ta: match.ta }));
  }, [form.designation, clientRates, isEdit]);

  const payableGross = useMemo(() =>
    Number(form.basic) + Number(form.da) + Number(form.ta) + Number(form.weekly_off_allowance) +
    Number(form.washing_allowance) + Number(form.conveyance_allowance) + Number(form.spl_allowance)
  , [form]);

  async function save(addAnother: boolean) {
    const parsed = schema.safeParse({
      full_name: form.full_name, designation: form.designation,
      client_id: form.client_id, date_of_joining: form.date_of_joining, status: form.status,
      aadhaar_number: form.aadhaar_number, uan_number: form.uan_number, esi_number: form.esi_number,
      bank_ifsc: form.bank_ifsc, bank_account_number: form.bank_account_number, mobile: form.mobile,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.join(".") ?? "field";
      toast.error(`${field}: ${issue?.message ?? "Invalid input"}`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        designation: form.designation,
        client_id: form.client_id || null,
        date_of_joining: toISODate(form.date_of_joining)!,
        date_of_leaving: toISODate(form.date_of_leaving),
        status: form.status,
        is_new_joiner: form.is_new_joiner,
        notes: form.notes || null,
        uan_number: form.uan_number || null,
        esi_number: form.esi_number || null,
        aadhaar_number: form.aadhaar_number || null,
        epf_exempt: form.epf_exempt,
        esi_exempt: form.esi_exempt,
        basic: form.basic, da: form.da, ta: form.ta,
        weekly_off_allowance: form.weekly_off_allowance,
        washing_allowance: form.washing_allowance,
        conveyance_allowance: form.conveyance_allowance,
        spl_allowance: form.spl_allowance,
        four_hour_ot_rate: form.four_hour_ot_rate,
        bonus_amount: form.bonus_amount,
        relieving_charges: form.relieving_charges,
        leave_wages: form.leave_wages,
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
        bank_ifsc: form.bank_ifsc || null,
        mobile: form.mobile || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("employees").update(payload).eq("id", id!);
        if (error) throw error;
        await logAudit({ action: "UPDATE", table: "employees", recordId: id!, newValues: payload });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("employees").insert({ ...payload, employee_code: "", created_by: user?.id }).select("id").single();
        if (error) throw error;
        await logAudit({ action: "CREATE", table: "employees", recordId: data.id, newValues: payload });
      }
      toast.success(isEdit ? "Employee updated" : "Employee created");
      if (addAnother) {
        setForm({ ...form, full_name: "", uan_number: "", esi_number: "", aadhaar_number: "", mobile: "", bank_account_number: "", notes: "" });
      } else navigate("/app/masters/employees");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold text-app-navy">{isEdit ? "Edit Employee" : "Add New Employee"}</h1>
      </div>

      <Section title="Basic Information">
        <Field label="Full Name *"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Designation *">
          <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DESIGNATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Client Assignment">
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
            <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Date of Joining *"><Input type="date" value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} /></Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "Active" | "Relieved" | "Absconded" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Relieved">Relieved</SelectItem>
              <SelectItem value="Absconded">Absconded</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="New Joiner">
          <div className="flex items-center gap-2 h-10"><Switch checked={form.is_new_joiner} onCheckedChange={(v) => setForm({ ...form, is_new_joiner: v })} /><span className="text-sm text-muted-foreground">{form.is_new_joiner ? "Yes" : "No"}</span></div>
        </Field>
        <Field label="Notes" className="md:col-span-2">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </Section>

      <Section title="Statutory Numbers">
        <Field label="UAN Number"><Input value={form.uan_number} onChange={(e) => setForm({ ...form, uan_number: e.target.value })} /></Field>
        <Field label="ESI Number"><Input value={form.esi_number} onChange={(e) => setForm({ ...form, esi_number: e.target.value })} /></Field>
        <Field label="Aadhaar"><Input value={form.aadhaar_number} onChange={(e) => setForm({ ...form, aadhaar_number: e.target.value })} /></Field>
        <Field label="EPF Exempt">
          <div className="flex items-center gap-2 h-10"><Switch checked={form.epf_exempt} onCheckedChange={(v) => setForm({ ...form, epf_exempt: v })} /><span className="text-sm text-muted-foreground">{form.epf_exempt ? "Yes" : "No"}</span></div>
        </Field>
        <Field label="ESI Exempt">
          <div className="flex items-center gap-2 h-10"><Switch checked={form.esi_exempt} onCheckedChange={(v) => setForm({ ...form, esi_exempt: v })} /><span className="text-sm text-muted-foreground">{form.esi_exempt ? "Yes" : "No"}</span></div>
        </Field>
      </Section>

      <Section title="Salary Structure (auto-fills from client MW rates)">
        <Field label="Basic"><Input type="number" value={form.basic} onChange={(e) => setForm({ ...form, basic: Number(e.target.value) })} /></Field>
        <Field label="DA"><Input type="number" value={form.da} onChange={(e) => setForm({ ...form, da: Number(e.target.value) })} /></Field>
        <Field label="TA"><Input type="number" value={form.ta} onChange={(e) => setForm({ ...form, ta: Number(e.target.value) })} /></Field>
        <Field label="Weekly Off"><Input type="number" value={form.weekly_off_allowance} onChange={(e) => setForm({ ...form, weekly_off_allowance: Number(e.target.value) })} /></Field>
        <Field label="Washing"><Input type="number" value={form.washing_allowance} onChange={(e) => setForm({ ...form, washing_allowance: Number(e.target.value) })} /></Field>
        <Field label="Conveyance"><Input type="number" value={form.conveyance_allowance} onChange={(e) => setForm({ ...form, conveyance_allowance: Number(e.target.value) })} /></Field>
        <Field label="Special Allowance"><Input type="number" value={form.spl_allowance} onChange={(e) => setForm({ ...form, spl_allowance: Number(e.target.value) })} /></Field>
        <Field label="4-Hr OT Rate"><Input type="number" value={form.four_hour_ot_rate} onChange={(e) => setForm({ ...form, four_hour_ot_rate: Number(e.target.value) })} /></Field>
        <Field label="Bonus Amount"><Input type="number" value={form.bonus_amount} onChange={(e) => setForm({ ...form, bonus_amount: Number(e.target.value) })} /></Field>
        <Field label="Relieving Charges"><Input type="number" value={form.relieving_charges} onChange={(e) => setForm({ ...form, relieving_charges: Number(e.target.value) })} /></Field>
        <Field label="Leave Wages"><Input type="number" value={form.leave_wages} onChange={(e) => setForm({ ...form, leave_wages: Number(e.target.value) })} /></Field>
        <Field label="Payable Gross">
          <div className="h-10 flex items-center px-3 rounded-md border bg-app-surface font-mono font-semibold text-app-navy">{formatINR(payableGross)}</div>
        </Field>
      </Section>

      <Section title="Bank Details">
        <Field label="Bank Name"><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
        <Field label="Account Number"><Input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></Field>
        <Field label="IFSC"><Input value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} /></Field>
      </Section>

      <Section title="Contact">
        <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
      </Section>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => navigate("/app/masters/employees")}>Cancel</Button>
        {!isEdit && <Button variant="secondary" onClick={() => save(true)} disabled={saving}>Save & Add Another</Button>}
        <Button className="bg-app-navy hover:bg-app-navy/90 text-white" onClick={() => save(false)} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-app-border rounded-lg p-6 space-y-4">
      <h2 className="font-semibold text-app-navy">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (<div className={"space-y-1 " + (className ?? "")}><Label className="text-xs">{label}</Label>{children}</div>);
}
