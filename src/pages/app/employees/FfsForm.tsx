import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { ArrowLeft, Save, Send } from "lucide-react";

const REASONS = ["Resignation","Termination","Contract End","Absconded","Other"];

export default function FfsForm() {
  const navigate = useNavigate();
  const { isSandbox } = useEnvironment();
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [relievingDate, setRelievingDate] = useState(new Date().toISOString().slice(0,10));
  const [lastDay, setLastDay] = useState(new Date().toISOString().slice(0,10));
  const [reason, setReason] = useState("Resignation");
  const [reasonDetails, setReasonDetails] = useState("");
  const [earned, setEarned] = useState(0);
  const [leaveDays, setLeaveDays] = useState(0);
  const [leaveAmount, setLeaveAmount] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [gratuityApply, setGratuityApply] = useState(false);
  const [gratuityBasic, setGratuityBasic] = useState(0);
  const [otherDed, setOtherDed] = useState(0);
  const [otherLabel, setOtherLabel] = useState("");
  const [canteenDed, setCanteenDed] = useState(0);
  const [clientCanteenEnabled, setClientCanteenEnabled] = useState(false);
  const [calc, setCalc] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("employees")
      .select("id, full_name, employee_code, basic, client_id")
      .eq("status","Active").eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("full_name")
      .then(({ data }) => setEmployees(data ?? []));
  }, [isSandbox]);

  useEffect(() => {
    const e = employees.find(x => x.id === employeeId);
    if (e && gratuityBasic === 0) setGratuityBasic(Number(e.basic||0));
  }, [employeeId, employees]);

  useEffect(() => {
    if (!employeeId) { setClientCanteenEnabled(false); return; }
    const emp = employees.find(x => x.id === employeeId);
    if (!emp?.client_id) { setClientCanteenEnabled(false); return; }
    supabase.from("clients").select("canteen_enabled").eq("id", emp.client_id).maybeSingle()
      .then(({ data }) => setClientCanteenEnabled(!!(data as any)?.canteen_enabled));
  }, [employeeId, employees]);

  useEffect(() => {
    if (!employeeId) { setCalc(null); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("compute_ffs", { _payload: {
        employee_id: employeeId, relieving_date: relievingDate,
        earned_wages_pending: earned, leave_encashment_amount: leaveAmount,
        bonus_amount: bonus, gratuity_applicable: gratuityApply,
        gratuity_basic: gratuityBasic, other_deductions: otherDed,
        canteen_deduction: canteenDed,
      } as any });
      setCalc(data);
    }, 250);
    return () => clearTimeout(t);
  }, [employeeId, relievingDate, earned, leaveAmount, bonus, gratuityApply, gratuityBasic, otherDed, canteenDed]);

  async function save(submit: boolean) {
    if (!employeeId || !reason) { toast.error("Fill required fields"); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("save_ffs", { _payload: {
      employee_id: employeeId, relieving_date: relievingDate, last_working_day: lastDay,
      reason_for_leaving: reason, reason_details: reasonDetails,
      earned_wages_pending: earned, leave_encashment_days: leaveDays,
      leave_encashment_amount: leaveAmount, bonus_amount: bonus,
      gratuity_applicable: gratuityApply, gratuity_basic: gratuityBasic,
      other_deductions: otherDed, other_deductions_label: otherLabel,
      canteen_deduction: canteenDed,
      status: submit ? "submitted" : "draft",
    } as any });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(submit ? "FFS submitted" : "Draft saved");
    navigate("/app/employees/ffs/list");
  }

  const gratuityEligible = calc?.gratuity_eligible ?? false;
  const yos = calc?.years_of_service ?? 0;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={()=>navigate("/app/employees/ffs/list")}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <h1 className="text-2xl font-bold text-app-navy">New FFS</h1>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Employee & Relieving</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason for Leaving *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Relieving Date *</Label><Input type="date" value={relievingDate} onChange={e=>setRelievingDate(e.target.value)} /></div>
          <div><Label>Last Working Day *</Label><Input type="date" value={lastDay} onChange={e=>setLastDay(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Reason details</Label><Textarea value={reasonDetails} onChange={e=>setReasonDetails(e.target.value)} rows={2} /></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base">FFS Calculation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Earned Wages Pending</Label><Input type="number" value={earned} onChange={e=>setEarned(Number(e.target.value))} /></div>
            <div><Label>Bonus</Label><Input type="number" value={bonus} onChange={e=>setBonus(Number(e.target.value))} /></div>
            <div><Label>Leave Encashment Days</Label><Input type="number" value={leaveDays} onChange={e=>setLeaveDays(Number(e.target.value))} /></div>
            <div><Label>Leave Encashment Amount</Label><Input type="number" value={leaveAmount} onChange={e=>setLeaveAmount(Number(e.target.value))} /></div>
            <div><Label>Other Deductions</Label><Input type="number" value={otherDed} onChange={e=>setOtherDed(Number(e.target.value))} /></div>
            <div><Label>Other Deduction Label</Label><Input value={otherLabel} onChange={e=>setOtherLabel(e.target.value)} /></div>
            {clientCanteenEnabled && (
              <div><Label>Canteen Dues (exit month)</Label><Input type="number" value={canteenDed} onChange={e=>setCanteenDed(Number(e.target.value))} /></div>
            )}
          </div>
          <Card className="bg-app-surface">
            <CardContent className="p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span>Years of Service</span><span className="font-mono">{yos}</span></div>
              {gratuityEligible ? (
                <>
                  <div className="flex items-center gap-2"><Switch checked={gratuityApply} onCheckedChange={setGratuityApply} /> <span>Apply Gratuity?</span></div>
                  <div><Label>Gratuity Basic</Label><Input type="number" value={gratuityBasic} onChange={e=>setGratuityBasic(Number(e.target.value))} /></div>
                  <div className="flex justify-between"><span>Gratuity Amount (auto)</span><span className="font-mono">{formatINR(calc?.gratuity_amount ?? 0)}</span></div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Gratuity requires minimum 5 years of service. Employee has {yos} years.</div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {calc && (
        <Card><CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1 max-w-md">
            <div className="font-semibold text-app-navy">EARNINGS</div>
            <div className="flex justify-between"><span>Earned Wages</span><span className="tabular-nums">{formatINR(earned)}</span></div>
            <div className="flex justify-between"><span>Leave Encashment</span><span className="tabular-nums">{formatINR(leaveAmount)}</span></div>
            <div className="flex justify-between"><span>Bonus</span><span className="tabular-nums">{formatINR(bonus)}</span></div>
            <div className="flex justify-between"><span>Gratuity</span><span className="tabular-nums">{formatINR(calc.gratuity_amount)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Total Earnings</span><span className="tabular-nums">{formatINR(calc.total_earnings)}</span></div>
            <div className="font-semibold text-app-navy mt-3">DEDUCTIONS</div>
            <div className="flex justify-between"><span>Advance Outstanding</span><span className="tabular-nums">{formatINR(calc.advance_outstanding)}</span></div>
            {clientCanteenEnabled && canteenDed > 0 && (
              <div className="flex justify-between"><span>Canteen Dues</span><span className="tabular-nums">{formatINR(canteenDed)}</span></div>
            )}
            <div className="flex justify-between"><span>Other</span><span className="tabular-nums">{formatINR(otherDed)}</span></div>
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Total Deductions</span><span className="tabular-nums">{formatINR(calc.total_deductions_ffs)}</span></div>
            <div className="flex justify-between border-t pt-2 font-bold text-base text-app-navy"><span>NET PAYABLE</span><span className="tabular-nums">{formatINR(calc.net_payable)}</span></div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button onClick={()=>save(false)} variant="outline" disabled={saving}><Save className="h-4 w-4 mr-2" /> Save Draft</Button>
        <Button onClick={()=>save(true)} disabled={saving} className="bg-app-navy"><Send className="h-4 w-4 mr-2" /> Submit for Approval</Button>
      </div>
    </div>
  );
}
