// Shared utilities for Phase 2 financial calculations + anomaly detection.
// All authoritative calculations are server-side; these are PREVIEW ONLY.

export interface PaysheetEmpRow {
  id?: string;
  employee_id?: string | null;
  uan_number?: string | null;
  esi_number?: string | null;
  employee_name: string;
  designation: string;
  basic: number;
  da: number;
  ta: number;
  four_hour_ot: number;
  weekly_off: number;
  bonus: number;
  relieving_charges: number;
  leave_wages: number;
  conveyance_allowance: number;
  washing_allowance: number;
  uniform_allowance: number;
  spl_allowance: number;
  payable_gross: number;
  working_days: number;
  no_of_duties: number;
  earned_wages: number;
  epf_mw_wages: number;
  epf_wages: number;
  epf_employee_deduction: number;
  epf_employer_contribution: number;
  esi_wages: number;
  esi_employee_deduction: number;
  esi_employer_contribution: number;
  pt_deduction: number;
  net_salary: number;
  advance_deduction: number;
  uniform_advance_deduction: number;
  final_net_salary: number;
  is_new_joiner: boolean;
  ad_hoc?: boolean;
}

export type PfCalcMethod = 'basic_only' | 'basic_da' | 'basic_da_half' | 'basic_da_ot';
export type EsiCalcMethod = 'basic_only' | 'basic_da' | 'basic_da_half' | 'basic_da_ot';

export interface ClientFlags {
  pt_applicable: boolean;
  pf_applicable: boolean;
  pf_calc_method: PfCalcMethod;
  esi_applicable: boolean;
  esi_calc_method: EsiCalcMethod;
}

export function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export function recalcEmployee(row: PaysheetEmpRow, flags: ClientFlags): PaysheetEmpRow {
  const payable = (row.basic || 0) + (row.da || 0) + (row.ta || 0)
    + (row.four_hour_ot || 0) + (row.weekly_off || 0) + (row.bonus || 0)
    + (row.relieving_charges || 0) + (row.leave_wages || 0)
    + (row.conveyance_allowance || 0) + (row.washing_allowance || 0)
    + (row.uniform_allowance || 0) + (row.spl_allowance || 0);

  const wd = row.working_days > 0 ? row.working_days : 30;
  // Uniform allowance is retained by TPSS (provided as uniform in kind) — excluded from employee take-home
  const payableForEmployee = payable - (row.uniform_allowance || 0);
  const earned = r2((payableForEmployee / wd) * (row.no_of_duties || 0));

  const earnedBasicDa = r2(((row.basic + row.da) / wd) * (row.no_of_duties || 0));

  let epfWages = 0, epfEmp = 0, epfEmpr = 0;
  if (flags.pf_applicable) {
    const duties = row.no_of_duties || 0;
    let epfBase: number;
    switch (flags.pf_calc_method) {
      case 'basic_only':
        epfBase = r2((row.basic / wd) * duties);
        break;
      case 'basic_da_half':
        epfBase = r2(((row.basic + row.da) / 2 / wd) * duties);
        break;
      case 'basic_da_ot':
        epfBase = r2(((row.basic + row.da + row.four_hour_ot) / wd) * duties);
        break;
      case 'basic_da':
      default:
        epfBase = earnedBasicDa;
    }
    epfWages = Math.max(epfBase, row.epf_mw_wages || 0);
    epfEmp = r2(epfWages * 0.12);
    epfEmpr = r2(epfWages * 0.13);
  }

  let esiWages = 0, esiEmp = 0, esiEmpr = 0;
  if (flags.esi_applicable && earned <= 21000) {
    const duties = row.no_of_duties || 0;
    let esiBase: number;
    switch (flags.esi_calc_method) {
      case 'basic_only':
        esiBase = r2((row.basic / wd) * duties);
        break;
      case 'basic_da_half':
        esiBase = r2(((row.basic + row.da) / 2 / wd) * duties);
        break;
      case 'basic_da_ot':
        esiBase = r2(((row.basic + row.da + row.four_hour_ot) / wd) * duties);
        break;
      case 'basic_da':
      default:
        esiBase = earnedBasicDa;
    }
    esiWages = esiBase;
    esiEmp = r2(esiWages * 0.0075);
    esiEmpr = r2(esiWages * 0.0325);
  }

  let pt_deduction = 0;
  if (flags.pt_applicable) {
    if (earned >= 20000) pt_deduction = 200;
    else if (earned >= 15000) pt_deduction = 150;
  }

  const net = r2(earned - epfEmp - esiEmp - pt_deduction);
  const final_net = r2(net - (row.advance_deduction || 0) - (row.uniform_advance_deduction || 0));

  return {
    ...row,
    payable_gross: r2(payable),
    earned_wages: earned,
    epf_wages: r2(epfWages),
    epf_employee_deduction: epfEmp,
    epf_employer_contribution: epfEmpr,
    esi_wages: r2(esiWages),
    esi_employee_deduction: esiEmp,
    esi_employer_contribution: esiEmpr,
    pt_deduction,
    net_salary: net,
    final_net_salary: final_net,
  };
}

export type AnomalyLevel = "red" | "yellow" | "blue";
export interface Anomaly {
  level: AnomalyLevel;
  code: string;
  message: string;
}

export function computeAnomalies(row: PaysheetEmpRow): Anomaly[] {
  const out: Anomaly[] = [];
  if (!row.uan_number) out.push({ level: "red", code: "missing_uan", message: "Missing UAN" });
  if (!row.esi_number && row.esi_wages > 0)
    out.push({ level: "red", code: "missing_esi", message: "Missing ESI with ESI wages" });
  if (row.no_of_duties > row.working_days)
    out.push({ level: "yellow", code: "duties_exceed", message: "Duties > working days" });
  if (row.esi_wages > 21000)
    out.push({ level: "yellow", code: "esi_exempt", message: "ESI wages > ₹21,000" });
  if (row.earned_wages === 0)
    out.push({ level: "yellow", code: "zero_wages", message: "Earned wages = 0" });
  if (row.is_new_joiner) out.push({ level: "blue", code: "new_joiner", message: "New joiner" });
  return out;
}

export function calcInvoicePreview(opts: {
  billingLines: Array<{ qty: number; rate_per_month: number; amount?: number }>;
  tdsPct: number;
  gstApplicable: boolean;
  gstRcm: boolean;
  gstPct: number;
  amountReceived: number;
  deductionRows: Array<{ value: number; is_enabled: boolean }>;
}) {
  const billing = opts.billingLines.reduce(
    (s, l) => s + (l.amount ?? (l.qty || 0) * (l.rate_per_month || 0)),
    0
  );
  const tds = r2(billing * opts.tdsPct / 100);
  const gst = opts.gstApplicable && !opts.gstRcm ? r2(billing * opts.gstPct / 100) : 0;
  const total = r2(billing + gst);
  const receivable = r2(total - tds);
  const deductions = opts.deductionRows.reduce(
    (s, d) => s + (d.is_enabled ? (d.value || 0) : 0),
    0
  );
  const margin = r2(receivable - deductions);
  const outstanding = r2(margin - (opts.amountReceived || 0));
  return {
    billing_amount: r2(billing),
    tds_amount: tds,
    gst_amount: gst,
    total_invoice_value: total,
    amount_receivable: receivable,
    total_deductions: r2(deductions),
    net_margin: margin,
    outstanding_amount: outstanding,
  };
}
