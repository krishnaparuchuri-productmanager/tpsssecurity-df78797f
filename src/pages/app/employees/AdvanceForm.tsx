import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Emp { id: string; full_name: string; employee_code: string; max_advance_limit: number; current_advance_balance: number; uniform_advance_balance: number; client_id: string | null }

export default function AdvanceForm() {
  const navigate = useNavigate();
  const { isSandbox } = useEnvironment();
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [advanceType, setAdvanceType] = useState("salary_advance");
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().slice(0,10));
  const [totalAmount, setTotalAmount] = useState(0);
  const [monthlyDeduction, setMonthlyDeduction] = useState(0);
  const [recoveryStart, setRecoveryStart] = useState(new Date().toISOString().slice(0,7) + "-01");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("employees")
      .select("id, full_name, employee_code, max_advance_limit, current_advance_balance, uniform_advance_balance, client_id")
      .eq("status","Active").eq("is_sandbox",isSandbox).eq("is_deleted",false)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as Emp[]));
  }, [isSandbox]);

  const selected = employees.find(e => e.id === employeeId);
  const overLimit = advanceType !== 'uniform_advance' && selected && selected.max_advance_limit > 0 &&
    (Number(selected.current_advance_balance) + Number(totalAmount)) > Number(selected.max_advance_limit);

  async function submit() {
    if (!employeeId || totalAmount <= 0 || monthlyDeduction <= 0 || !reason.trim()) {
      toast.error("Fill all required fields"); return;
    }
    if (reason.length > 500) { toast.error("Reason must be ≤ 500 chars"); return; }
    if (overLimit) { toast.error(`Advance limit exceeded. Current: ₹${selected!.current_advance_balance}. Limit: ₹${selected!.max_advance_limit}.`); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("request_advance", {
      _payload: {
        employee_id: employeeId, advance_type: advanceType, advance_date: advanceDate,
        total_amount: totalAmount, monthly_deduction: monthlyDeduction,
        recovery_start_month: recoveryStart, reason,
      } as any,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Advance submitted for approval");
    navigate("/app/employees/advances/list");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/employees/advances/list")}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <h1 className="text-2xl font-bold text-app-navy">New Advance Request</h1>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Advance Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Employee *</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</SelectItem>)}</SelectContent>
              </Select>
              {selected && advanceType !== 'uniform_advance' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Limit: ₹{Number(selected.max_advance_limit||0).toLocaleString()} · Outstanding: ₹{Number(selected.current_advance_balance||0).toLocaleString()}
                </p>
              )}
              {selected && advanceType === 'uniform_advance' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Uniform Advance Outstanding: ₹{Number(selected.uniform_advance_balance||0).toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <Label>Type *</Label>
              <Select value={advanceType} onValueChange={setAdvanceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary_advance">Salary Advance</SelectItem>
                  <SelectItem value="expense_advance">Expense Advance</SelectItem>
                  <SelectItem value="uniform_advance">Uniform Advance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Advance Date *</Label><Input type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)} /></div>
            <div><Label>Recovery Start Month *</Label><Input type="month" value={recoveryStart.slice(0,7)} onChange={e => setRecoveryStart(e.target.value + "-01")} /></div>
            <div><Label>Total Amount (₹) *</Label><Input type="number" min={1} value={totalAmount} onChange={e => setTotalAmount(Number(e.target.value))} /></div>
            <div><Label>Monthly Deduction (₹) *</Label><Input type="number" min={1} value={monthlyDeduction} onChange={e => setMonthlyDeduction(Number(e.target.value))} /></div>
          </div>
          <div>
            <Label>Reason * <span className="text-xs text-muted-foreground">({reason.length}/500)</span></Label>
            <Textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)} rows={3} />
          </div>
          {overLimit && (
            <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-900">
              ⚠️ Advance limit exceeded. Current balance: ₹{selected!.current_advance_balance}. Limit: ₹{selected!.max_advance_limit}.
            </div>
          )}
          {totalAmount > 0 && monthlyDeduction > 0 && (
            <div className="text-xs text-muted-foreground">
              Recovery in approx <strong>{Math.ceil(totalAmount / monthlyDeduction)}</strong> month(s)
            </div>
          )}
          <Button onClick={submit} disabled={saving || !!overLimit} className="bg-app-navy">
            <Send className="h-4 w-4 mr-2" /> Submit for Approval
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
