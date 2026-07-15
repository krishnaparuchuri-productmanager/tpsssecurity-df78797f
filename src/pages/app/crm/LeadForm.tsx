import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { activity } from "@/lib/activity";

const SOURCES = [
  { value: "manual",          label: "Manual Entry" },
  { value: "referral",        label: "Referral" },
  { value: "call",            label: "Incoming Call" },
  { value: "walk_in",         label: "Walk-in" },
  { value: "existing_client", label: "Existing Client" },
  { value: "other",           label: "Other" },
];

const PRIORITIES = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUSES = [
  { value: "new",                 label: "New" },
  { value: "contacted",           label: "Contacted" },
  { value: "qualified",           label: "Qualified" },
  { value: "site_visit_planned",  label: "Site Visit Planned" },
  { value: "proposal_pending",    label: "Proposal / Quotation Pending" },
  { value: "quotation_submitted", label: "Quotation Submitted" },
  { value: "negotiation",         label: "Negotiation" },
  { value: "on_hold",             label: "On Hold" },
];

const REQ_CATEGORIES = [
  { value: "security",     label: "Security (Guards & ASOs)" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "other",        label: "Other" },
];

const CONTACT_MODES = [
  { value: "call",     label: "Phone Call" },
  { value: "email",    label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "visit",    label: "Visit" },
];

interface UserProfile { id: string; full_name: string; }

export default function LeadForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { isSandbox } = useEnvironment();
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [source, setSource] = useState("manual");
  const [status, setStatus] = useState("new");
  const [priority, setPriority] = useState("medium");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [contactMode, setContactMode] = useState("");
  const [reqCategory, setReqCategory] = useState("");
  const [noOfGuards, setNoOfGuards] = useState("");
  const [reqNotes, setReqNotes] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [nextFollowup, setNextFollowup] = useState("");
  const [expectedClosure, setExpectedClosure] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("user_profiles").select("id, full_name").eq("is_active", true)
      .then(({ data }) => setUsers((data ?? []) as UserProfile[]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    supabase.from("crm_leads").select("*").eq("id", id).single()
      .then(({ data }) => {
        if (!data) return;
        setSource(data.source); setStatus(data.status); setPriority(data.priority);
        setCompanyName(data.company_name ?? ""); setContactName(data.contact_person_name ?? "");
        setDesignation(data.contact_designation ?? ""); setPhone(data.phone ?? "");
        setAltPhone(data.alternate_phone ?? ""); setEmail(data.email ?? "");
        setLocation(data.location ?? ""); setAddress(data.address ?? "");
        setContactMode(data.preferred_contact_mode ?? "");
        setReqCategory(data.requirement_category ?? "");
        setNoOfGuards(data.no_of_guards ? String(data.no_of_guards) : "");
        setReqNotes(data.requirement_notes ?? "");
        setExpectedValue(data.expected_business_value ? String(data.expected_business_value) : "");
        setAssignedTo(data.assigned_to_user_id ?? "");
        setNextFollowup(data.next_followup_at ? data.next_followup_at.slice(0, 16) : "");
        setExpectedClosure(data.expected_closure_date ?? "");
      });
  }, [id, isEdit]);

  async function save() {
    if (!companyName.trim()) { toast.error("Company name is required"); return; }
    if (!contactName.trim()) { toast.error("Contact person name is required"); return; }
    if (!phone.trim()) { toast.error("Phone number is required"); return; }

    setSaving(true);
    const payload = {
      source, status, priority,
      company_name: companyName.trim(),
      contact_person_name: contactName.trim(),
      contact_designation: designation.trim() || null,
      phone: phone.trim(),
      alternate_phone: altPhone.trim() || null,
      email: email.trim() || null,
      location: location.trim() || null,
      address: address.trim() || null,
      preferred_contact_mode: contactMode || null,
      requirement_category: reqCategory || null,
      no_of_guards: noOfGuards ? Number(noOfGuards) : null,
      requirement_notes: reqNotes.trim() || null,
      expected_business_value: expectedValue ? Number(expectedValue) : null,
      assigned_to_user_id: assignedTo || null,
      next_followup_at: nextFollowup ? new Date(nextFollowup).toISOString() : null,
      expected_closure_date: expectedClosure || null,
      is_sandbox: isSandbox,
    };

    if (isEdit) {
      const { error } = await supabase.from("crm_leads").update(payload).eq("id", id);
      if (error) { setSaving(false); toast.error(error.message); return; }
      await logAudit({ action: "UPDATE", table: "crm_leads", recordId: id, newValues: payload });
      await activity.update("crm_leads", id!);
      toast.success("Lead updated");
      navigate(`/app/crm/leads/${id}`);
    } else {
      const { data: numData } = await supabase.rpc("gen_lead_number");
      const leadNumber = numData as string;
      const { data: inserted, error } = await supabase.from("crm_leads")
        .insert({ ...payload, lead_number: leadNumber, created_by_user_id: user?.id ?? null })
        .select("id").single();
      if (error || !inserted) { setSaving(false); toast.error(error?.message ?? "Failed to create lead"); return; }

      // Initial timeline entry
      await supabase.from("crm_lead_activities").insert({
        lead_id: inserted.id,
        activity_type: "lead_created",
        activity_datetime: new Date().toISOString(),
        notes: `Lead created manually by ${
          users.find((u) => u.id === user?.id)?.full_name ?? "team member"
        }. Source: ${source}.` + (initialNotes.trim() ? ` Notes: ${initialNotes.trim()}` : ""),
        created_by_user_id: user?.id ?? null,
      });

      // Notify ceo_admin users (skip if creator is already ceo_admin — they'll see it in leads)
      if (role !== "ceo_admin") {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "ceo_admin");
        for (const a of admins ?? []) {
          await supabase.from("notifications").insert({
            user_id: a.user_id,
            title: `New Lead: ${companyName.trim()}`,
            message: `${leadNumber} · ${contactName.trim()} · ${phone.trim()} · ${source}`,
            type: "crm_new_lead",
            is_read: false,
          });
        }
      }
      // Notify assigned user if different from creator
      if (assignedTo && assignedTo !== user?.id) {
        await supabase.from("notifications").insert({
          user_id: assignedTo,
          title: `Lead assigned to you: ${companyName.trim()}`,
          message: `${leadNumber} · ${contactName.trim()} · ${phone.trim()}`,
          type: "crm_assignment",
          is_read: false,
        });
      }

      await logAudit({ action: "CREATE", table: "crm_leads", recordId: inserted.id, newValues: { lead_number: leadNumber, source } });
      await activity.create("crm_leads", inserted.id);
      toast.success(`Lead ${leadNumber} created`);
      navigate(`/app/crm/leads/${inserted.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">{isEdit ? "Edit Lead" : "New Lead"}</h1>
        <Button variant="outline" onClick={() => navigate(isEdit ? `/app/crm/leads/${id}` : "/app/crm/leads")}>
          Cancel
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Contact Person Name *</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Full name" className="mt-1" />
          </div>
          <div>
            <Label>Designation</Label>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Manager, Director…" className="mt-1" />
          </div>
          <div>
            <Label>Company Name *</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Organisation" className="mt-1" />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s\-()\[\]]/g, "").slice(0, 10))} placeholder="+91 98765 43210" className="mt-1" />
          </div>
          <div>
            <Label>Alternate Phone</Label>
            <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value.replace(/[^0-9+\s\-()\[\]]/g, "").slice(0, 10))} placeholder="Optional" className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@company.com" className="mt-1" />
          </div>
          <div>
            <Label>City / Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nellore, Hyderabad…" className="mt-1" />
          </div>
          <div>
            <Label>Preferred Contact Mode</Label>
            <Select value={contactMode} onValueChange={setContactMode}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {CONTACT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Full Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Complete postal address" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Requirement Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Requirement Category</Label>
            <Select value={reqCategory} onValueChange={setReqCategory}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {REQ_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Number of Guards</Label>
            <Input type="number" min="1" value={noOfGuards} onChange={(e) => setNoOfGuards(e.target.value)} placeholder="e.g. 10" className="mt-1" />
          </div>
          <div>
            <Label>Expected Business Value (₹)</Label>
            <Input type="number" min="0" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder="Estimated monthly value" className="mt-1" />
          </div>
          <div>
            <Label>Expected Closure Date</Label>
            <Input type="date" value={expectedClosure} onChange={(e) => setExpectedClosure(e.target.value)} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>Requirement Notes</Label>
            <Textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Site details, specific needs, shift pattern…" rows={3} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pipeline & Assignment</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Lead Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Assign To</Label>
            <Select
              value={assignedTo || "__none__"}
              onValueChange={(v) => setAssignedTo(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Next Follow-up</Label>
            <Input type="datetime-local" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} className="mt-1" />
          </div>
          {!isEdit && (
            <div className="sm:col-span-2">
              <Label>Initial Discussion Notes</Label>
              <Textarea value={initialNotes} onChange={(e) => setInitialNotes(e.target.value)} placeholder="What was discussed when this lead was first captured?" rows={2} className="mt-1" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(isEdit ? `/app/crm/leads/${id}` : "/app/crm/leads")}>
          Cancel
        </Button>
        <Button className="bg-app-navy text-white" onClick={save} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Lead"}
        </Button>
      </div>
    </div>
  );
}
