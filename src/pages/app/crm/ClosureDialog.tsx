import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface Reason { id: string; reason_name: string; }

interface Props {
  leadId: string;
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
}

export default function ClosureDialog({ leadId, open, onClose, onClosed }: Props) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [closureType, setClosureType] = useState<"positive" | "negative">("positive");
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [summary, setSummary] = useState("");
  const [closureDate, setClosureDate] = useState(today);
  const [competitor, setCompetitor] = useState("");
  const [priceIssue, setPriceIssue] = useState(false);
  const [noResponse, setNoResponse] = useState(false);
  const [clientDropped, setClientDropped] = useState(false);
  const [scopeMismatch, setScopeMismatch] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("crm_closure_reasons")
      .select("id, reason_name")
      .eq("closure_type", closureType)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setReasons((data ?? []) as Reason[]));
    setReasonId("");
  }, [open, closureType]);

  function reset() {
    setClosureType("positive"); setReasonId(""); setSummary(""); setClosureDate(today);
    setCompetitor(""); setPriceIssue(false); setNoResponse(false); setClientDropped(false); setScopeMismatch(false);
  }

  async function save() {
    if (!reasonId) { toast.error("Please select a closure reason"); return; }
    if (closureType === "positive" && !summary.trim()) { toast.error("Please enter a win summary"); return; }
    if (closureType === "negative" && !summary.trim()) { toast.error("Please enter closure remarks"); return; }

    setSaving(true);
    const newStatus = closureType === "positive" ? "won" : "lost";

    const { error } = await supabase.from("crm_leads").update({
      status: newStatus,
      closure_type: closureType,
      closure_reason_id: reasonId,
      closure_summary: summary.trim(),
      closure_date: closureDate,
      lost_to_competitor: closureType === "negative" ? (competitor.trim() || null) : null,
      closure_price_issue: closureType === "negative" ? priceIssue : null,
      closure_no_response: closureType === "negative" ? noResponse : null,
      closure_client_dropped: closureType === "negative" ? clientDropped : null,
      closure_scope_mismatch: closureType === "negative" ? scopeMismatch : null,
    }).eq("id", leadId);

    if (error) { setSaving(false); toast.error(error.message); return; }

    await supabase.from("crm_lead_activities").insert({
      lead_id: leadId,
      activity_type: "closure",
      activity_datetime: new Date(closureDate).toISOString(),
      notes: `Lead ${newStatus.toUpperCase()}. ${summary.trim()}`,
      created_by_user_id: user?.id ?? null,
    });

    await logAudit({ action: "UPDATE", table: "crm_leads", recordId: leadId, newValues: { status: newStatus, closure_type: closureType } });
    setSaving(false);
    toast.success(`Lead marked as ${newStatus.toUpperCase()}`);
    reset();
    onClose();
    onClosed();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Close Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Closure type toggle */}
          <div>
            <Label>Closure Type</Label>
            <div className="flex gap-2 mt-2">
              {(["positive", "negative"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setClosureType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    closureType === t
                      ? t === "positive"
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-red-600 text-white border-red-600"
                      : "bg-white text-muted-foreground border-input hover:border-app-navy"
                  }`}
                >
                  {t === "positive" ? "🏆 Won" : "❌ Lost"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{closureType === "positive" ? "Win Reason" : "Loss Reason"} *</Label>
              <Select value={reasonId} onValueChange={setReasonId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.reason_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Closure Date</Label>
              <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>{closureType === "positive" ? "Win Summary *" : "Remarks *"}</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={
                closureType === "positive"
                  ? "Services confirmed, commercial terms, start date, key win factors…"
                  : "Detailed explanation of why the lead was lost…"
              }
              rows={3}
              className="mt-1"
            />
          </div>

          {closureType === "negative" && (
            <>
              <div>
                <Label>Competitor Name (if applicable)</Label>
                <Input value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="Which vendor did they choose?" className="mt-1" />
              </div>
              <div className="space-y-2">
                <Label>Contributing Factors</Label>
                {[
                  { id: "price", label: "Price was too high", state: priceIssue, set: setPriceIssue },
                  { id: "noresponse", label: "Client stopped responding", state: noResponse, set: setNoResponse },
                  { id: "dropped", label: "Client dropped the plan", state: clientDropped, set: setClientDropped },
                  { id: "scope", label: "Scope / service mismatch", state: scopeMismatch, set: setScopeMismatch },
                ].map((f) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Checkbox
                      id={f.id}
                      checked={f.state}
                      onCheckedChange={(v) => f.set(v === true)}
                    />
                    <label htmlFor={f.id} className="text-sm">{f.label}</label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            className={closureType === "positive" ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : closureType === "positive" ? "Mark as Won" : "Mark as Lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
