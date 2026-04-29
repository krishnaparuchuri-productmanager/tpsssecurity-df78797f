import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EXPENSE_CATS: { value: string; label: string }[] = [
  { value: "epf_payment", label: "EPF Payment" },
  { value: "esi_payment", label: "ESI Payment" },
  { value: "gst_payment", label: "GST Payment" },
  { value: "pt_payment", label: "PT Payment" },
  { value: "staff_salary", label: "Staff Salary (Office)" },
  { value: "salary_advance", label: "Salary Advance Payout" },
  { value: "admin_expense", label: "Admin Expense" },
  { value: "vehicle_expense", label: "Vehicle Expense" },
  { value: "other_expense", label: "Other Expense" },
];

export default function ExpenseForm({ onSaved }: { onSaved?: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState(today);
  const [category, setCategory] = useState("admin_expense");
  const [particulars, setParticulars] = useState("");
  const [amount, setAmount] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [clients, setClients] = useState<{ id: string; client_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, client_name")
      .eq("is_deleted", false)
      .order("client_name")
      .then(({ data }) => setClients((data ?? []) as { id: string; client_name: string }[]));
  }, []);

  async function submit() {
    if (!particulars.trim()) return toast.error("Particulars required");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Amount must be > 0");
    setSaving(true);
    const { error } = await supabase.rpc("record_expense", {
      _payload: {
        entry_date: entryDate,
        category,
        particulars,
        amount: amt,
        client_id: clientId || null,
        reference_number: reference || null,
        notes,
      } as never,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Expense recorded");
    setParticulars("");
    setAmount("");
    setReference("");
    setNotes("");
    onSaved?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Expense</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Date *</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (₹) *</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Particulars *</Label>
          <Input value={particulars} onChange={(e) => setParticulars(e.target.value)} placeholder="e.g. Diesel for vehicle AP01-XX-1234" />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Client (optional)</Label>
            <Select value={clientId || "__none"} onValueChange={(v) => setClientId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Not client-specific" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Not client-specific</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference / Challan #</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bill / challan / cheque no." />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Record Expense"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
