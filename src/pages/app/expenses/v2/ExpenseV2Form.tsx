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
import { useAuth } from "@/contexts/AuthContext";

const PAYMENT_MODES = ["Cash", "Bank", "UPI", "Card"];

export default function ExpenseV2Form() {
  const nav = useNavigate();
  const { role } = useAuth();
  const canDirectApprove = role === "ceo_admin" || role === "coo_ops";

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Cash");
  const [reference, setReference] = useState("");
  const [submitMode, setSubmitMode] = useState<"draft" | "approved">("draft");
  const [cats, setCats] = useState<{ id: string; category_name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("expense_categories").select("id, category_name")
      .eq("is_active", true).order("sort_order")
      .then(({ data }) => setCats((data ?? []) as { id: string; category_name: string }[]));
    supabase.from("branches").select("id, branch_name").eq("is_active", true)
      .order("branch_name").then(({ data }) => setBranches((data ?? []) as { id: string; branch_name: string }[]));
  }, []);

  async function submit() {
    if (!categoryId) return toast.error("Select category");
    if (!description.trim()) return toast.error("Description required");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Amount must be > 0");
    setSaving(true);
    const { error } = await supabase.rpc("record_expense_v2", {
      _payload: {
        expense_date: date, category_id: categoryId, branch_id: branchId || null,
        description, amount: amt, payment_mode: mode, reference_number: reference || null,
        status: submitMode,
      } as never,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(submitMode === "approved" ? "Expense approved & posted" : "Expense saved as draft");
    nav("/app/expenses/v2");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-app-navy">New Expense</h1>
      <Card>
        <CardHeader><CardTitle>Expense details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Date *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (₹) *</Label><Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Branch (optional)</Label>
              <Select value={branchId || "__none"} onValueChange={(v) => setBranchId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Not branch-specific</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Mode *</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reference / Bill #</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          </div>
          <div>
            <Label>Description *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
            <div className="text-xs text-app-muted">{description.length} / 500</div>
          </div>
          {canDirectApprove && (
            <div>
              <Label>Submit as</Label>
              <Select value={submitMode} onValueChange={(v) => setSubmitMode(v as "draft" | "approved")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (review later)</SelectItem>
                  <SelectItem value="approved">Approved (post to ledger now)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => nav("/app/expenses/v2")}>Cancel</Button>
            <Button className="bg-app-navy text-white" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save Expense"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
