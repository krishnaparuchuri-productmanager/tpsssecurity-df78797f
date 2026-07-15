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

const STATUSES = [
  { value: "draft",     label: "Draft" },
  { value: "submitted", label: "Submitted to Client" },
  { value: "revised",   label: "Revised" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
];

interface Props {
  leadId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function QuotationDialog({ leadId, open, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [quotationNumber, setQuotationNumber] = useState("");
  const [quotationDate, setQuotationDate] = useState(today);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("draft");
  const [summary, setSummary] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setQuotationNumber(""); setQuotationDate(today); setValue("");
    setStatus("draft"); setSummary(""); setRemarks("");
  }

  async function save() {
    if (!summary.trim()) { toast.error("Please add a quotation summary"); return; }
    setSaving(true);

    const { error } = await supabase.from("crm_lead_quotations").insert({
      lead_id: leadId,
      quotation_number: quotationNumber.trim() || null,
      quotation_date: quotationDate,
      value: value ? Number(value) : null,
      summary: summary.trim(),
      status,
      remarks: remarks.trim() || null,
      created_by_user_id: user?.id ?? null,
    });

    if (error) { setSaving(false); toast.error(error.message); return; }

    // Log activity on the lead
    await supabase.from("crm_lead_activities").insert({
      lead_id: leadId,
      activity_type: status === "submitted" ? "quotation_submitted" : "quotation_added",
      activity_datetime: new Date().toISOString(),
      notes: `Quotation ${status === "submitted" ? "submitted to client" : "prepared"}.` +
        (quotationNumber ? ` Ref: ${quotationNumber}.` : "") +
        (value ? ` Value: ₹${Number(value).toLocaleString("en-IN")}.` : "") +
        ` ${summary.trim()}`,
      created_by_user_id: user?.id ?? null,
    });

    if (status === "submitted") {
      await supabase.from("crm_leads").update({ status: "quotation_submitted" }).eq("id", leadId).eq("status", "proposal_pending");
    }

    await logAudit({ action: "CREATE", table: "crm_lead_quotations", recordId: leadId });
    setSaving(false);
    toast.success("Quotation saved");
    reset();
    onClose();
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Quotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quotation Reference No.</Label>
              <Input value={quotationNumber} onChange={(e) => setQuotationNumber(e.target.value)} placeholder="QUO-2026-001" className="mt-1" />
            </div>
            <div>
              <Label>Quotation Date</Label>
              <Input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Value (₹)</Label>
              <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 150000" className="mt-1" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Summary *</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What does this quotation cover? Key scope, terms, guard count…" rows={3} className="mt-1" />
          </div>

          <div>
            <Label>Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Negotiation points, client feedback…" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button className="bg-app-navy text-white" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Quotation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
