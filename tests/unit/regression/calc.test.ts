// Unit tests of the payroll/invoice preview maths in src/lib/calc.ts (the values the paysheet screen saves).
// Only behaviour that does NOT depend on unconfirmed rules is asserted here: switched-off
// deductions, how net pay is composed, and invoice totals adding up. Statutory rates, bases,
// thresholds and slabs stay as `todo` until the owner confirms them (checkpoint questions 1–6).
import { describe, expect, it } from "vitest";
import { calcInvoicePreview, recalcEmployee, type ClientFlags, type PaysheetEmpRow } from "@/lib/calc";

const row = (over: Partial<PaysheetEmpRow> = {}): PaysheetEmpRow => ({
  employee_name: "Test Employee", designation: "S.GUARD",
  basic: 12000, da: 3000, ta: 0, four_hour_ot: 0, weekly_off: 0, bonus: 0, relieving_charges: 0, leave_wages: 0,
  conveyance_allowance: 0, washing_allowance: 0, uniform_allowance: 0, spl_allowance: 0, payable_gross: 0,
  working_days: 30, no_of_duties: 30, earned_wages: 0, epf_mw_wages: 0, epf_wages: 0,
  epf_employee_deduction: 0, epf_employer_contribution: 0, esi_wages: 0, esi_employee_deduction: 0, esi_employer_contribution: 0,
  pt_deduction: 0, net_salary: 0, advance_deduction: 0, uniform_advance_deduction: 0,
  canteen_price: 0, canteen_quantity: 0, canteen_subsidy: 0, canteen_total: 0, final_net_salary: 0, is_new_joiner: false,
  ...over,
});
const OFF: ClientFlags = { pt_applicable: false, pf_applicable: false, pf_calc_method: "basic_da", esi_applicable: false, esi_calc_method: "basic_da" };
const ON: ClientFlags = { ...OFF, pt_applicable: true, pf_applicable: true, esi_applicable: true };

describe("R-CALC paysheet preview — switched-off deductions", () => {
  it("R-CALC-01 PF switched off for the client → no PF wages or contributions", () => {
    const r = recalcEmployee(row(), { ...ON, pf_applicable: false });
    expect([r.epf_wages, r.epf_employee_deduction, r.epf_employer_contribution]).toEqual([0, 0, 0]);
  });
  it("R-CALC-02 ESI switched off → no ESI wages or contributions", () => {
    const r = recalcEmployee(row({ basic: 8000, da: 0 }), { ...ON, esi_applicable: false });
    expect([r.esi_wages, r.esi_employee_deduction, r.esi_employer_contribution]).toEqual([0, 0, 0]);
  });
  it("R-CALC-03 PT switched off → no professional tax", () => {
    expect(recalcEmployee(row({ basic: 30000 }), { ...ON, pt_applicable: false }).pt_deduction).toBe(0);
  });
  it("R-CALC-04 everything off and no deductions → final net equals earned wages", () => {
    const r = recalcEmployee(row(), OFF);
    expect(r.final_net_salary).toBe(r.earned_wages);
    expect(r.net_salary).toBe(r.earned_wages);
  });
});

describe("R-CALC paysheet preview — composition", () => {
  it("R-CALC-05 earned wages scale with duties worked (half the duties → half the wages)", () => {
    const full = recalcEmployee(row({ no_of_duties: 30 }), OFF).earned_wages;
    const half = recalcEmployee(row({ no_of_duties: 15 }), OFF).earned_wages;
    expect(half).toBeCloseTo(full / 2, 2);
  });
  it("R-CALC-06 zero duties → zero earned wages and no deductions", () => {
    const r = recalcEmployee(row({ no_of_duties: 0 }), ON);
    expect(r.earned_wages).toBe(0);
    expect(r.pt_deduction).toBe(0);
  });
  it("R-CALC-07 net = earned − employee PF − employee ESI − PT", () => {
    const r = recalcEmployee(row({ basic: 9000, da: 1000 }), ON);
    expect(r.net_salary).toBeCloseTo(r.earned_wages - r.epf_employee_deduction - r.esi_employee_deduction - r.pt_deduction, 2);
  });
  it("R-CALC-08 a salary advance deduction reduces final net by exactly that amount", () => {
    const base = recalcEmployee(row(), ON);
    const withAdv = recalcEmployee(row({ advance_deduction: 500 }), ON);
    expect(base.final_net_salary - withAdv.final_net_salary).toBeCloseTo(500, 2);
  });
  it("R-CALC-09 results are rounded to at most 2 decimals", () => {
    const r = recalcEmployee(row({ basic: 10001, da: 333, no_of_duties: 17, working_days: 31 }), ON);
    for (const v of [r.earned_wages, r.epf_employee_deduction, r.esi_employee_deduction, r.net_salary, r.final_net_salary]) {
      expect(Math.round(v * 100) / 100).toBe(v);
    }
  });

  it.todo("R-CALC-10 PF wage base per calculation method and the ₹15,000 figure (ceiling vs floor) — question 1");
  it.todo("R-CALC-11 PF employee/employer rates — question 1");
  it.todo("R-CALC-12 ESI eligibility threshold and rates — question 2");
  it.todo("R-CALC-13 PT slabs incl. exactly ₹15,000 and ₹20,000 — question 3");
  it.todo("R-CALC-14 uniform allowance excluded from take-home; canteen and uniform-advance deductions — question 4");
  it.todo("R-CALC-15 rounding rule and default working days — question 5");
});

describe("R-CALC invoice preview — totals add up", () => {
  const base = { billingLines: [{ qty: 2, rate_per_month: 100 }, { qty: 1, rate_per_month: 150 }], tdsPct: 2, gstApplicable: true, gstRcm: false, gstPct: 18, amountReceived: 0, deductionRows: [] };

  it("R-CALC-20 billing = sum of lines; total = billing + GST; receivable = total − TDS; outstanding = receivable − received", () => {
    const p = calcInvoicePreview({ ...base, amountReceived: 50 });
    expect(p.billing_amount).toBe(350);
    expect(p.total_invoice_value).toBeCloseTo(p.billing_amount + p.gst_amount, 2);
    expect(p.amount_receivable).toBeCloseTo(p.total_invoice_value - p.tds_amount, 2);
    expect(p.outstanding_amount).toBeCloseTo(p.amount_receivable - 50, 2);
  });
  it("R-CALC-21 GST switched off → no GST", () => {
    expect(calcInvoicePreview({ ...base, gstApplicable: false }).gst_amount).toBe(0);
  });
  it("R-CALC-22 only enabled deduction rows reduce the margin", () => {
    const p = calcInvoicePreview({ ...base, deductionRows: [{ value: 40, is_enabled: true }, { value: 999, is_enabled: false }] });
    expect(p.total_deductions).toBe(40);
    expect(p.net_margin).toBeCloseTo(p.amount_receivable - 40, 2);
  });
  it.todo("R-CALC-23 TDS base and GST under reverse charge — question 6");
});
