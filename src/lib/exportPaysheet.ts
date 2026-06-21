import * as XLSX from "xlsx";
import { addExcelBranding, BrandingInfo } from "@/lib/excelBranding";

interface Emp {
  employee_name: string; designation: string;
  uan_number: string | null; esi_number: string | null;
  no_of_duties: number;
  basic: number; da: number; ta: number;
  four_hour_ot: number; weekly_off: number;
  bonus: number; relieving_charges: number; leave_wages: number;
  conveyance_allowance: number; washing_allowance: number; spl_allowance: number;
  payable_gross: number; earned_wages: number;
  epf_employee_deduction: number; epf_employer_contribution: number;
  esi_employee_deduction: number; esi_employer_contribution: number;
  pt_deduction: number; advance_deduction: number;
  net_salary: number; final_net_salary: number;
}
interface Head {
  paysheet_number: string; month: string;
  total_employees: number; total_net_salary: number;
  clients: { client_name: string } | null;
}

export function downloadPaysheetExcel(head: Head, emps: Emp[], company?: BrandingInfo | null) {
  const rows = emps.map((e, i) => ({
    "#": i + 1,
    Name: e.employee_name, Designation: e.designation,
    UAN: e.uan_number ?? "", ESI: e.esi_number ?? "",
    Duties: e.no_of_duties,
    Basic: Number(e.basic), DA: Number(e.da), TA: Number(e.ta),
    "4Hr OT ★": Number(e.four_hour_ot), "Weekly Off": Number(e.weekly_off),
    "Bonus ★": Number(e.bonus), "Relieving ★": Number(e.relieving_charges),
    "Leave Wages ★": Number(e.leave_wages),
    Conveyance: Number(e.conveyance_allowance), Washing: Number(e.washing_allowance),
    "Spl Allow": Number(e.spl_allowance),
    "Payable Gross": Number(e.payable_gross), Earned: Number(e.earned_wages),
    "EPF Emp": Number(e.epf_employee_deduction), "EPF Empr": Number(e.epf_employer_contribution),
    "ESI Emp": Number(e.esi_employee_deduction), "ESI Empr": Number(e.esi_employer_contribution),
    PT: Number(e.pt_deduction), "Net Salary": Number(e.net_salary),
    Advance: Number(e.advance_deduction), "Final Net": Number(e.final_net_salary),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  if (company) addExcelBranding(ws, company);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Paysheet");
  XLSX.writeFile(wb, `${head.paysheet_number}_${(head.clients?.client_name ?? "").replace(/\W+/g, "_")}.xlsx`);
}

export function downloadPaysheetCsv(head: Head, emps: Emp[]) {
  const headers = ["#","Name","Designation","UAN","ESI","Duties","Basic","DA","TA","4Hr OT *","Weekly Off","Bonus *","Relieving *","Leave Wages *","Conveyance","Washing","Spl Allow","Payable Gross","Earned","EPF Emp","EPF Empr","ESI Emp","ESI Empr","PT","Net Salary","Advance","Final Net"];
  const lines = [headers.join(",")];
  emps.forEach((e, i) => {
    lines.push([i+1, e.employee_name, e.designation, e.uan_number ?? "", e.esi_number ?? "",
      e.no_of_duties,
      e.basic, e.da, e.ta, e.four_hour_ot, e.weekly_off,
      e.bonus, e.relieving_charges, e.leave_wages,
      e.conveyance_allowance, e.washing_allowance, e.spl_allowance,
      e.payable_gross, e.earned_wages,
      e.epf_employee_deduction, e.epf_employer_contribution,
      e.esi_employee_deduction, e.esi_employer_contribution,
      e.pt_deduction, e.net_salary, e.advance_deduction, e.final_net_salary,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${head.paysheet_number}.csv`; a.click();
  URL.revokeObjectURL(url);
}
