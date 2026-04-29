import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

const TYPES = ["EPF", "ESI", "GST", "PT", "TDS", "OTHER"];

export default function CompliancePaymentForm() {
  const nav = useNavigate();
  const today = new Date();
  const [type, setType] = useState("EPF");
  const [paymentMonth, setPaymentMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`);
  const [paymentDate, setPaymentDate] = useState(today.toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [lateFee, setLateFee] = useState("");
  const [interest, setInterest] = useState("");
  const [challan, setChallan] = useState("");
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("branches").select("id, branch_name").eq("is_active", true).order("branch_name")
      .then(({ data }) => setBranches((data ?? []) as { id: string; branch_name: string }[]));
  }, []);

  const total = (Number(amount) || 0) + (Number(lateFee) || 0) + (Number(interest) || 0);

  async function submit() {
    const a = Number(amount);
    if (!a || a < 0) return toast.error("Amount required");
    setSaving(true);
    const { error } = await supabase.rpc("record_compliance_payment", {
      _payload: {
        payment_type: type, payment_month: paymentMonth, payment_date: paymentDate,
        amount: a, late_fee: Number(lateFee) || 0, interest: Number(interest) || 0,
        challan_number: challan || null, bank_name: bank || null, reference_number: reference || null,
        branch_id: branchId || null, notes: notes || null,
      } as never,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Compliance payment recorded & posted to ledger");
    nav("/app/compliance/payments");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-app-navy">Record Compliance Payment</h1>
      <Card>
        <CardHeader><CardTitle>Payment details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>For Month *</Label><Input type="month" value={paymentMonth.slice(0, 7)} onChange={(e) => setPaymentMonth(e.target.value + "-01")} /></div>
            <div><Label>Paid On *</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Amount (₹) *</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Late Fee (₹)</Label><Input type="number" min="0" step="0.01" value={lateFee} onChange={(e) => setLateFee(e.target.value)} /></div>
            <div><Label>Interest (₹)</Label><Input type="number" min="0" step="0.01" value={interest} onChange={(e) => setInterest(e.target.value)} /></div>
          </div>
          <div className="bg-app-surface p-3 rounded border border-app-border flex justify-between">
            <span className="font-medium">Total to be posted</span>
            <span className="font-bold tabular-nums text-app-navy">{formatINR(total)}</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Challan Number</Label><Input value={challan} onChange={(e) => setChallan(e.target.value)} /></div>
            <div><Label>Bank Name</Label><Input value={bank} onChange={(e) => setBank(e.target.value)} /></div>
            <div><Label>Reference / UTR</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <div>
            <Label>Branch (optional)</Label>
            <Select value={branchId || "__none"} onValueChange={(v) => setBranchId(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">All branches</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => nav("/app/compliance/payments")}>Cancel</Button>
            <Button className="bg-app-navy text-white" onClick={submit} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
