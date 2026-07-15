import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

const ACTIVITY_TYPES = [
  { value: "call_made",          label: "Call Made" },
  { value: "email_sent",         label: "Email Sent" },
  { value: "whatsapp",           label: "WhatsApp" },
  { value: "meeting",            label: "Meeting" },
  { value: "site_visit",         label: "Site Visit" },
  { value: "followup_scheduled", label: "Follow-up Scheduled" },
  { value: "note",               label: "Internal Note" },
  { value: "reminder",           label: "Reminder" },
];

const CONTACT_MODES = [
  { value: "call",      label: "Phone Call" },
  { value: "email",     label: "Email" },
  { value: "whatsapp",  label: "WhatsApp" },
  { value: "visit",     label: "In-person Visit" },
];

interface Props {
  leadId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (nextFollowup?: string | null) => void;
}

export default function ActivityDialog({ leadId, open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const now = new Date();
  const localNow = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}T${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  const [actType, setActType] = useState("call_made");
  const [actDatetime, setActDatetime] = useState(localNow);
  const [contactMode, setContactMode] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextFollowup, setNextFollowup] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setActType("call_made"); setActDatetime(localNow); setContactMode("");
    setNotes(""); setOutcome(""); setNextAction(""); setNextFollowup("");
  }

  async function save() {
    if (!notes.trim()) { toast.error("Please add discussion notes"); return; }
    setSaving(true);

    const followupAt = nextFollowup ? new Date(nextFollowup).toISOString() : null;

    const { error } = await supabase.from("crm_lead_activities").insert({
      lead_id: leadId,
      activity_type: actType,
      activity_datetime: new Date(actDatetime).toISOString(),
      notes: notes.trim(),
      outcome: outcome.trim() || null,
      next_action: nextAction.trim() || null,
      next_followup_at: followupAt,
      contact_mode: contactMode || null,
      created_by_user_id: user?.id ?? null,
    });

    if (error) { setSaving(false); toast.error(error.message); return; }

    // Update lead's next followup date if provided
    if (followupAt) {
      await supabase.from("crm_leads").update({ next_followup_at: followupAt }).eq("id", leadId);
    }

    await logAudit({ action: "CREATE", table: "crm_lead_activities", recordId: leadId });
    setSaving(false);
    toast.success("Activity logged");
    reset();
    onClose();
    onSaved(followupAt);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Activity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Activity Type</Label>
              <Select value={actType} onValueChange={setActType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={actDatetime} onChange={(e) => setActDatetime(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Contact Mode</Label>
            <Select value={contactMode} onValueChange={setContactMode}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select mode…" /></SelectTrigger>
              <SelectContent>
                {CONTACT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Discussion Notes *</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was discussed? Key points from the conversation…"
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Outcome</Label>
            <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Positive, needs more info, requested proposal…" className="mt-1" />
          </div>

          <div>
            <Label>Next Action</Label>
            <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Send quotation, schedule site visit…" className="mt-1" />
          </div>

          <div>
            <Label>Next Follow-up Date</Label>
            <Input type="datetime-local" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button className="bg-app-navy text-white" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Log Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
