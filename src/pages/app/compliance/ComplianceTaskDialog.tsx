import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ComplianceTask } from "./ComplianceCalendar";

interface Props {
  open: boolean;
  task: ComplianceTask | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

export default function ComplianceTaskDialog({ open, task, onOpenChange, onSaved }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [frequency, setFrequency] = useState("one_time");
  const [dueDate, setDueDate] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [reminder, setReminder] = useState(7);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setCode(task.task_code); setName(task.task_name); setCategory(task.category);
      setFrequency(task.frequency); setDueDate(task.due_date); setPeriodLabel(task.period_label);
      setReminder(task.reminder_days_before); setNotes(task.notes ?? "");
    } else {
      setCode(""); setName(""); setCategory("Other"); setFrequency("one_time");
      setDueDate(new Date().toISOString().slice(0, 10));
      setPeriodLabel(new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }));
      setReminder(7); setNotes("");
    }
  }, [task, open]);

  async function save() {
    if (!code || !name || !dueDate) return toast.error("Code, name, due date required");
    setSaving(true);
    const payload = {
      task_code: code, task_name: name, category, frequency,
      due_date: dueDate, period_label: periodLabel,
      reminder_days_before: reminder, notes,
    };
    const { error } = task
      ? await supabase.rpc("update_compliance_task", { _id: task.id, _payload: payload as never })
      : await supabase.rpc("create_compliance_task", { _payload: payload as never });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(task ? "Task updated" : "Task created");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{task ? "Edit Compliance Task" : "New Compliance Task"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. EPF_ECR" /></div>
            <div><Label>Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["EPF","ESI","GST","PT","TDS","Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["monthly","quarterly","annual","one_time"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Due Date *</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><Label>Reminder (days)</Label><Input type="number" min={0} value={reminder} onChange={(e) => setReminder(Number(e.target.value))} /></div>
          </div>
          <div><Label>Period Label</Label><Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="e.g. May 2026" /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
