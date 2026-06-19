import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { recalcEmployee, computeAnomalies, PaysheetEmpRow, r2 } from "@/lib/calc";
import { ArrowLeft, Plus, Save, Send, Loader2, AlertTriangle } from "lucide-react";
import { useSaveLabel } from "@/lib/envLabels";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function emptyRow(designation = "ASO"): PaysheetEmpRow {
  return {
    employee_name: "", designation,
    basic: 0, da: 0, ta: 0, four_hour_ot: 0, weekly_off: 0, bonus: 0,
    relieving_charges: 0, leave_wages: 0, conveyance_allowance: 0,
    washing_allowance: 0, spl_allowance: 0, payable_gross: 0,
    working_days: 30, no_of_duties: 0, earned_wages: 0,
    epf_mw_wages: 0, epf_wages: 0, epf_employee_deduction: 0, epf_employer_contribution: 0,
    esi_wages: 0, esi_employee_deduction: 0, esi_employer_contribution: 0,
    pt_deduction: 0, net_salary: 0, advance_deduction: 0, final_net_salary: 0,
    is_new_joiner: false, ad_hoc: true,
  };
}

export default function PaysheetCreate() {
  const navigate = useNavigate();
  const { isSandbox } = useEnvironment();
  const { user } = useAuth();
  const saveLabel = useSaveLabel("Save Draft");
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clients, setClients] = useState<Array<{ id: string; client_name: string; pt_applicable: boolean }>>([]);
  const [clientId, setClientId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [workingDays, setWorkingDays] = useState(30);
  const [rows, setRows] = useState<PaysheetEmpRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [paysheetId, setPaysheetId] = useState<string | null>(null);

  const monthDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  const monthLabel = `${MONTHS[monthIdx]}-${year}`;

  useEffect(() => {
    supabase.from("clients")
      .select("id, client_name, pt_applicable")
      .eq("is_active", true).eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("client_name")
      .then(({ data }) => setClients((data ?? []) as typeof clients));
  }, [isSandbox]);

  useEffect(() => {
    // working days = days in month
    setWorkingDays(new Date(year, monthIdx + 1, 0).getDate());
  }, [year, monthIdx]);

  // Edit mode: load existing draft/rejected paysheet
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data: ps } = await supabase.from("paysheets").select("*").eq("id", editId).maybeSingle();
      if (!ps) { toast.error("Paysheet not found"); return; }
      if (!["draft", "rejected"].includes(ps.status)) {
        toast.error(`Cannot edit ${ps.status} paysheets`);
        navigate(`/app/payroll/${editId}/view`);
        return;
      }
      setPaysheetId(ps.id);
      setClientId(ps.client_id);
      const d = new Date(ps.month_date);
      setYear(d.getFullYear());
      setMonthIdx(d.getMonth());
      setWorkingDays(ps.total_days_in_month);
      const { data: emps } = await supabase.from("paysheet_employees").select("*").eq("paysheet_id", editId);
      const loaded: PaysheetEmpRow[] = (emps ?? []).map((e) => ({
        employee_id: e.employee_id ?? undefined,
        uan_number: e.uan_number ?? undefined,
        esi_number: e.esi_number ?? undefined,
        employee_name: e.employee_name,
        designation: e.designation,
        basic: Number(e.basic), da: Number(e.da), ta: Number(e.ta),
        four_hour_ot: Number(e.four_hour_ot), weekly_off: Number(e.weekly_off),
        bonus: Number(e.bonus), relieving_charges: Number(e.relieving_charges),
        leave_wages: Number(e.leave_wages),
        conveyance_allowance: Number(e.conveyance_allowance),
        washing_allowance: Number(e.washing_allowance),
        spl_allowance: Number(e.spl_allowance),
        payable_gross: Number(e.payable_gross),
        working_days: e.working_days,
        no_of_duties: Number(e.no_of_duties),
        earned_wages: Number(e.earned_wages),
        epf_mw_wages: Number(e.epf_mw_wages),
        epf_wages: Number(e.epf_wages),
        epf_employee_deduction: Number(e.epf_employee_deduction),
        epf_employer_contribution: Number(e.epf_employer_contribution),
        esi_wages: Number(e.esi_wages),
        esi_employee_deduction: Number(e.esi_employee_deduction),
        esi_employer_contribution: Number(e.esi_employer_contribution),
        pt_deduction: Number(e.pt_deduction),
        net_salary: Number(e.net_salary),
        advance_deduction: Number(e.advance_deduction),
        final_net_salary: Number(e.final_net_salary),
        is_new_joiner: !!e.is_new_joiner,
        ad_hoc: !e.employee_id,
      }));
      setRows(loaded);
      setStep(2);
      if (ps.status === "rejected" && ps.rejection_reason) {
        toast.warning(`Previous rejection: ${ps.rejection_reason}`);
      }
    })();
  }, [editId, navigate]);

  async function loadEmployeesForClient() {
    if (!clientId) {
      toast.error("Select a client first");
      return;
    }
    // Check for existing paysheet for client+month
    const { data: existing } = await supabase.from("paysheets")
      .select("id, status")
      .eq("client_id", clientId).eq("month_date", monthDate)
      .eq("is_sandbox", isSandbox).eq("is_deleted", false).maybeSingle();
    if (existing) {
      toast.warning(`A ${existing.status} paysheet already exists for this client + month.`);
    }

    const [{ data: emps }, { data: rates }] = await Promise.all([
      supabase.from("employees").select("*")
        .eq("client_id", clientId).eq("status", "Active")
        .eq("is_sandbox", isSandbox).eq("is_deleted", false).order("full_name"),
      supabase.from("client_wage_config").select("*")
        .eq("client_id", clientId).eq("is_current", true)
        .eq("is_sandbox", isSandbox).eq("is_deleted", false),
    ]);

    const newRows: PaysheetEmpRow[] = (emps ?? []).map((e) => {
      const cfg = (rates ?? []).find((r) => r.designation === e.designation);
      const base: PaysheetEmpRow = {
        employee_id: e.id,
        uan_number: e.uan_number,
        esi_number: e.esi_number,
        employee_name: e.full_name,
        designation: e.designation,
        basic: Number(cfg?.basic ?? e.basic ?? 0),
        da: Number(cfg?.da ?? e.da ?? 0),
        ta: Number(cfg?.ta ?? e.ta ?? 0),
        four_hour_ot: Number((e as any).four_hour_ot_rate || cfg?.four_hour_ot_rate || 0),
        weekly_off: Number(cfg?.weekly_off_allowance ?? e.weekly_off_allowance ?? 0),
        bonus: Number((e as any).bonus_amount || cfg?.bonus_amount || 0),
        relieving_charges: Number((e as any).relieving_charges || cfg?.relieving_charges || 0),
        leave_wages: Number((e as any).leave_wages || cfg?.leave_wages || 0),
        conveyance_allowance: Number(cfg?.conveyance_allowance ?? e.conveyance_allowance ?? 0),
        washing_allowance: Number(cfg?.washing_allowance ?? e.washing_allowance ?? 0),
        spl_allowance: Number(cfg?.spl_allowance ?? e.spl_allowance ?? 0),
        payable_gross: 0,
        working_days: workingDays,
        no_of_duties: 0,
        earned_wages: 0,
        epf_mw_wages: Number(cfg?.epf_mw_wages ?? 0),
        epf_wages: 0, epf_employee_deduction: 0, epf_employer_contribution: 0,
        esi_wages: 0, esi_employee_deduction: 0, esi_employer_contribution: 0,
        pt_deduction: 0, net_salary: 0, advance_deduction: 0, final_net_salary: 0,
        is_new_joiner: !!e.is_new_joiner,
        ad_hoc: false,
      };
      const client = clients.find((c) => c.id === clientId);
      return recalcEmployee(base, { applicable: client?.pt_applicable ?? false });
    });
    setRows(newRows);
    setStep(2);
  }

  function updateRow(idx: number, patch: Partial<PaysheetEmpRow>) {
    const client = clients.find((c) => c.id === clientId);
    setRows((cur) => {
      const next = [...cur];
      const merged = { ...next[idx], ...patch, working_days: workingDays };
      next[idx] = recalcEmployee(merged, { applicable: client?.pt_applicable ?? false });
      return next;
    });
  }

  function totals() {
    return rows.reduce((acc, r) => ({
      employees: acc.employees + 1,
      earned: acc.earned + r.earned_wages,
      epfEmp: acc.epfEmp + r.epf_employee_deduction,
      epfEmpr: acc.epfEmpr + r.epf_employer_contribution,
      esiEmp: acc.esiEmp + r.esi_employee_deduction,
      esiEmpr: acc.esiEmpr + r.esi_employer_contribution,
      pt: acc.pt + r.pt_deduction,
      net: acc.net + r.net_salary,
      adv: acc.adv + r.advance_deduction,
      finalNet: acc.finalNet + r.final_net_salary,
    }), { employees: 0, earned: 0, epfEmp: 0, epfEmpr: 0, esiEmp: 0, esiEmpr: 0, pt: 0, net: 0, adv: 0, finalNet: 0 });
  }

  function totalAnomalies() {
    return rows.reduce((s, r) => s + computeAnomalies(r).length, 0);
  }

  async function saveDraft(submit = false) {
    if (!clientId) return toast.error("Client required");
    setSaving(true);
    try {
      const t = totals();
      const { data: numData, error: numErr } = await supabase.rpc("gen_paysheet_number", {
        _month_date: monthDate, _sandbox: isSandbox,
      });
      if (numErr) throw numErr;

      const headerPayload = {
        paysheet_number: paysheetId ? undefined : numData as string,
        client_id: clientId,
        month: monthLabel,
        month_date: monthDate,
        total_days_in_month: workingDays,
        total_employees: t.employees,
        total_earned_wages: r2(t.earned),
        total_epf_employee: r2(t.epfEmp),
        total_epf_employer: r2(t.epfEmpr),
        total_esi_employee: r2(t.esiEmp),
        total_esi_employer: r2(t.esiEmpr),
        total_pt_deduction: r2(t.pt),
        total_advance_deductions: r2(t.adv),
        total_net_salary: r2(t.finalNet),
        anomaly_count: totalAnomalies(),
        status: submit ? "submitted" as const : "draft" as const,
        submitted_by: submit ? user?.id : null,
        submitted_at: submit ? new Date().toISOString() : null,
        is_sandbox: isSandbox,
        created_by: user?.id,
      };

      let pid = paysheetId;
      if (pid) {
        const { error } = await supabase.from("paysheets").update(headerPayload).eq("id", pid);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("paysheets")
          .insert(headerPayload as never).select("id").single();
        if (error) throw error;
        pid = data.id;
        setPaysheetId(pid);
      }

      // Replace employees
      await supabase.from("paysheet_employees").delete().eq("paysheet_id", pid!);
      if (rows.length > 0) {
        const empPayload = rows.map((r) => ({
          paysheet_id: pid!,
          employee_id: r.employee_id ?? null,
          uan_number: r.uan_number ?? null,
          esi_number: r.esi_number ?? null,
          employee_name: r.employee_name,
          designation: r.designation,
          basic: r.basic, da: r.da, ta: r.ta,
          four_hour_ot: r.four_hour_ot, weekly_off: r.weekly_off, bonus: r.bonus,
          relieving_charges: r.relieving_charges, leave_wages: r.leave_wages,
          conveyance_allowance: r.conveyance_allowance, washing_allowance: r.washing_allowance,
          spl_allowance: r.spl_allowance, payable_gross: r.payable_gross,
          working_days: r.working_days, no_of_duties: r.no_of_duties,
          earned_wages: r.earned_wages, epf_mw_wages: r.epf_mw_wages, epf_wages: r.epf_wages,
          epf_employee_deduction: r.epf_employee_deduction,
          epf_employer_contribution: r.epf_employer_contribution,
          esi_wages: r.esi_wages, esi_employee_deduction: r.esi_employee_deduction,
          esi_employer_contribution: r.esi_employer_contribution,
          pt_deduction: r.pt_deduction, net_salary: r.net_salary,
          advance_deduction: r.advance_deduction, final_net_salary: r.final_net_salary,
          is_new_joiner: r.is_new_joiner,
          anomaly_flags: computeAnomalies(r) as never,
          is_sandbox: isSandbox,
        }));
        const { error } = await supabase.from("paysheet_employees").insert(empPayload as never);
        if (error) throw error;
      }
      await logAudit({ action: submit ? "APPROVE" : "UPDATE", table: "paysheets", recordId: pid, newValues: { status: headerPayload.status } });
      toast.success(submit ? "Submitted for approval" : "Draft saved");
      if (submit) navigate("/app/payroll/list");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const t = totals();
  const anomalies = totalAnomalies();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold text-app-navy">Create Paysheet</h1>
        <Badge variant="outline" className="ml-2">Step {step}/3</Badge>
      </div>

      {step === 1 && (
        <div className="bg-white border border-app-border rounded-lg p-6 max-w-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Month</Label>
                <Select value={String(monthIdx)} onValueChange={(v) => setMonthIdx(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Working Days</Label>
              <Input type="number" value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={loadEmployeesForClient} className="bg-app-navy text-white">Load Employees →</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {anomalies > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ⚠️ {anomalies} anomalies — review before submit
            </div>
          )}
          <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-app-surface sticky top-0">
                <tr className="text-left">
                  <th className="p-1">#</th><th className="p-1">Name</th><th className="p-1">Desig</th>
                  <th className="p-1">UAN</th><th className="p-1">ESI</th>
                  <th className="p-1">Basic</th><th className="p-1">DA</th><th className="p-1">TA</th>
                  <th className="p-1">Pay.Gross</th>
                  <th className="p-1">W.Days</th><th className="p-1">Duties</th>
                  <th className="p-1">Earned</th>
                  <th className="p-1">EPF Emp</th><th className="p-1">EPF Empr</th>
                  <th className="p-1">ESI Emp</th><th className="p-1">ESI Empr</th>
                  <th className="p-1">PT</th><th className="p-1">Net</th>
                  <th className="p-1">Adv</th><th className="p-1">Final Net</th>
                  <th className="p-1">⚑</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const flags = computeAnomalies(r);
                  return (
                    <tr key={idx} className="border-t border-app-border hover:bg-app-surface/50">
                      <td className="p-1">{idx + 1}</td>
                      <td className="p-1">
                        <Input className="h-7 text-xs" value={r.employee_name} onChange={(e) => updateRow(idx, { employee_name: e.target.value })} />
                        {r.ad_hoc && <Badge variant="outline" className="ml-1 text-[9px]">Not in master</Badge>}
                      </td>
                      <td className="p-1"><Input className="h-7 text-xs w-20" value={r.designation} onChange={(e) => updateRow(idx, { designation: e.target.value })} /></td>
                      <td className="p-1"><Input className="h-7 text-xs w-24" value={r.uan_number ?? ""} onChange={(e) => updateRow(idx, { uan_number: e.target.value })} /></td>
                      <td className="p-1"><Input className="h-7 text-xs w-24" value={r.esi_number ?? ""} onChange={(e) => updateRow(idx, { esi_number: e.target.value })} /></td>
                      <td className="p-1"><Input className="h-7 text-xs w-16" type="number" value={r.basic} onChange={(e) => updateRow(idx, { basic: Number(e.target.value) })} /></td>
                      <td className="p-1"><Input className="h-7 text-xs w-16" type="number" value={r.da} onChange={(e) => updateRow(idx, { da: Number(e.target.value) })} /></td>
                      <td className="p-1"><Input className="h-7 text-xs w-16" type="number" value={r.ta} onChange={(e) => updateRow(idx, { ta: Number(e.target.value) })} /></td>
                      <td className="p-1 tabular-nums">{r.payable_gross}</td>
                      <td className="p-1"><Input className="h-7 text-xs w-14" type="number" value={r.working_days} onChange={(e) => updateRow(idx, { working_days: Number(e.target.value) })} /></td>
                      <td className="p-1"><Input className="h-7 text-xs w-14" type="number" step="0.5" value={r.no_of_duties} onChange={(e) => updateRow(idx, { no_of_duties: Number(e.target.value) })} /></td>
                      <td className="p-1 tabular-nums font-semibold">{r.earned_wages}</td>
                      <td className="p-1 tabular-nums">{r.epf_employee_deduction}</td>
                      <td className="p-1 tabular-nums">{r.epf_employer_contribution}</td>
                      <td className="p-1 tabular-nums">{r.esi_employee_deduction}</td>
                      <td className="p-1 tabular-nums">{r.esi_employer_contribution}</td>
                      <td className="p-1 tabular-nums">{r.pt_deduction}</td>
                      <td className="p-1 tabular-nums">{r.net_salary}</td>
                      <td className="p-1"><Input className="h-7 text-xs w-16" type="number" value={r.advance_deduction} onChange={(e) => updateRow(idx, { advance_deduction: Number(e.target.value) })} /></td>
                      <td className="p-1 tabular-nums font-bold">{r.final_net_salary}</td>
                      <td className="p-1">
                        {flags.map((f) => (
                          <span key={f.code} title={f.message} className="mr-0.5">
                            {f.level === "red" ? "🔴" : f.level === "yellow" ? "🟡" : "🔵"}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-app-surface font-bold border-t-2 border-app-navy">
                  <td className="p-1" colSpan={11}>TOTALS ({t.employees} employees)</td>
                  <td className="p-1 tabular-nums">{r2(t.earned)}</td>
                  <td className="p-1 tabular-nums">{r2(t.epfEmp)}</td>
                  <td className="p-1 tabular-nums">{r2(t.epfEmpr)}</td>
                  <td className="p-1 tabular-nums">{r2(t.esiEmp)}</td>
                  <td className="p-1 tabular-nums">{r2(t.esiEmpr)}</td>
                  <td className="p-1 tabular-nums">{r2(t.pt)}</td>
                  <td className="p-1 tabular-nums">{r2(t.net)}</td>
                  <td className="p-1 tabular-nums">{r2(t.adv)}</td>
                  <td className="p-1 tabular-nums">{r2(t.finalNet)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { ...emptyRow(), working_days: workingDays }])}>
              <Plus className="h-3 w-3 mr-1" /> Add Row
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStep(3)}>Next: Summary →</Button>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← Back</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Employees" value={String(t.employees)} />
            <Stat label="Earned Wages" value={`₹${r2(t.earned).toLocaleString()}`} />
            <Stat label="EPF Employee" value={`₹${r2(t.epfEmp).toLocaleString()}`} />
            <Stat label="EPF Employer" value={`₹${r2(t.epfEmpr).toLocaleString()}`} />
            <Stat label="ESI Employee" value={`₹${r2(t.esiEmp).toLocaleString()}`} />
            <Stat label="ESI Employer" value={`₹${r2(t.esiEmpr).toLocaleString()}`} />
            <Stat label="PT" value={`₹${r2(t.pt).toLocaleString()}`} />
            <Stat label="Final Net Salary" value={`₹${r2(t.finalNet).toLocaleString()}`} highlight />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
            <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saveLabel}
            </Button>
            <Button onClick={() => saveDraft(true)} disabled={saving} className="bg-app-navy text-white">
              <Send className="h-4 w-4 mr-1" /> Submit for Approval
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-md border ${highlight ? "border-app-saffron bg-app-saffron/10" : "border-app-border bg-white"}`}>
      <div className="text-xs text-app-muted">{label}</div>
      <div className={`text-lg font-bold ${highlight ? "text-app-saffron" : "text-app-navy"}`}>{value}</div>
    </div>
  );
}
