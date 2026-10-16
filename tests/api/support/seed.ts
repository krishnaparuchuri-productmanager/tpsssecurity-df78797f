// Synthetic, run-tagged master data for Phase 4 workflow tests.
// Amounts are deliberately tiny (₹100s) so test records barely move sandbox report totals
// that trainees may look at.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CleanupRegistry } from "../../support/cleanup";
import { tagged } from "../../support/run-id";

export interface SeededClient {
  clientId: string;
  clientName: string;
  employeeIds: string[];
  employeeNames: string[];
}

export const today = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
export const monthLabel = () => new Date().toLocaleString("en-US", { month: "short", year: "numeric" });

/** CEO creates a tagged client (GST on, TDS 2%) with N tagged employees. Undo: employees relieved, client deactivated. */
export async function seedClientWithEmployees(ceo: SupabaseClient, cleanup: CleanupRegistry, label: string, employees = 2): Promise<SeededClient> {
  const { data: me } = await ceo.auth.getUser();
  const clientName = tagged(`Test Client ${label}`);
  const { data: client, error } = await ceo
    .from("clients")
    .insert({
      client_name: clientName, client_code: "", service_type: "Security", client_type: "company_firm",
      gst_applicable: true, gst_percentage: 18, gst_type: "cgst_sgst", tds_rate: 2, tds_percentage: 2,
      pf_applicable: true, esi_applicable: true, pt_applicable: true, is_active: true, is_sandbox: true, created_by: me.user!.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`seed client: ${error.message}`);
  cleanup.track({ table: "clients", id: client.id, labelColumn: "client_name", undo: { kind: "update", values: { is_active: false }, reason: "clients cannot be deleted; deactivated" } });

  const employeeIds: string[] = [];
  const employeeNames: string[] = [];
  for (let i = 1; i <= employees; i++) {
    const name = tagged(`Test Employee ${label} ${i}`);
    const { data: emp, error: eErr } = await ceo
      .from("employees")
      .insert({ full_name: name, designation: "S.GUARD", client_id: client.id, date_of_joining: today(), status: "Active", employee_code: "", basic: 100, da: 0, created_by: me.user!.id })
      .select("id")
      .single();
    if (eErr) throw new Error(`seed employee: ${eErr.message}`);
    // Employees referenced by paysheets/advances can't be deleted; relieve them instead.
    cleanup.track({ table: "employees", id: emp.id, labelColumn: "full_name", undo: { kind: "update", values: { status: "Relieved" }, reason: "referenced by test records; relieved" } });
    employeeIds.push(emp.id);
    employeeNames.push(name);
  }
  return { clientId: client.id, clientName, employeeIds, employeeNames };
}

/** One synthetic paysheet employee row. Amounts are fixed inputs, not a statement of the payroll rules. */
export function paysheetRow(paysheetId: string, employeeId: string, employeeName: string, netSalary: number) {
  return {
    paysheet_id: paysheetId, employee_id: employeeId, employee_name: employeeName, designation: "S.GUARD",
    basic: 100, da: 0, ta: 0, four_hour_ot: 0, weekly_off: 0, bonus: 0, relieving_charges: 0, leave_wages: 0,
    conveyance_allowance: 0, washing_allowance: 0, uniform_allowance: 0, spl_allowance: 0, payable_gross: 100,
    working_days: 30, no_of_duties: 30, earned_wages: 100, epf_mw_wages: 0, epf_wages: 0,
    epf_employee_deduction: 0, epf_employer_contribution: 0, esi_wages: 0, esi_employee_deduction: 0, esi_employer_contribution: 0,
    pt_deduction: 0, net_salary: netSalary, advance_deduction: 0, uniform_advance_deduction: 0,
    canteen_price: 0, canteen_quantity: 0, canteen_subsidy: 0, canteen_total: 0, final_net_salary: netSalary,
    is_new_joiner: false, is_sandbox: true,
  };
}

/**
 * Accountant creates a paysheet the safe way (draft first, then rows, then submit).
 * Returns the paysheet id. Tracked for cancellation by a Super Admin.
 */
export async function createSubmittedPaysheet(accountant: SupabaseClient, superCleanup: CleanupRegistry, seed: SeededClient): Promise<string> {
  const { data: me } = await accountant.auth.getUser();
  const { data: number, error: nErr } = await accountant.rpc("gen_paysheet_number", { _month_date: monthStart(), _sandbox: true });
  if (nErr) throw new Error(`paysheet number: ${nErr.message}`);
  const n = seed.employeeIds.length;
  const { data: ps, error } = await accountant
    .from("paysheets")
    .insert({
      paysheet_number: number, client_id: seed.clientId, month: monthLabel(), month_date: monthStart(), total_days_in_month: 30,
      total_employees: n, total_earned_wages: 100 * n, total_net_salary: 100 * n, status: "draft", is_sandbox: true, created_by: me.user!.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(`create paysheet: ${error.message}`);
  superCleanup.track({ table: "paysheets", id: ps.id, labelColumn: "clients(client_name)", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_paysheet", args: { _id: ps.id, _reason: "Automated test cleanup", _cascade_invoice: true } } });

  const rows = seed.employeeIds.map((id, i) => paysheetRow(ps.id, id, seed.employeeNames[i], 100));
  const { error: rErr } = await accountant.from("paysheet_employees").insert(rows);
  if (rErr) throw new Error(`paysheet rows: ${rErr.message}`);

  const { error: sErr } = await accountant.from("paysheets").update({ status: "submitted", submitted_by: me.user!.id, submitted_at: new Date().toISOString() }).eq("id", ps.id);
  if (sErr) throw new Error(`submit paysheet: ${sErr.message}`);
  return ps.id;
}
