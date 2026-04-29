import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ComplianceTask } from "./ComplianceCalendar";

interface Props {
  task: ComplianceTask | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

export default function CompleteTaskDialog({ task, onOpenChange, onSaved }: Props) {
  const [challan, setChallan] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChallan(""); setAmount(""); setNotes("");
  }, [task]);

  async function save() {
    if (!task) return;
    setSaving(true);
    const { error } = await supabase.rpc("complete_compliance_task", {
      _id: task.id,
      _challan: challan || null,
      _amount: amount ? Number(amount) : null,
      _notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Task marked complete");
    onSaved();
  }

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Complete: {task?.task_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-app-muted">{task?.period_label} · Due {task?.due_date}</div>
          <div><Label>Challan / Reference Number</Label><Input value={challan} onChange={(e) => setChallan(e.target.value)} placeholder="Optional" /></div>
          <div><Label>Amount Paid (₹)</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Optional" /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="text-xs text-app-muted">Tip: if you paid an amount, also record it under <strong>Monthly Expenses</strong> with this challan number for ledger linkage.</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Mark Complete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
