import * as XLSX from "xlsx";

interface Emp {
  employee_name: string; designation: string;
  uan_number: string | null; esi_number: string | null;
  no_of_duties: number; earned_wages: number;
  epf_employee_deduction: number; esi_employee_deduction: number;
  pt_deduction: number; advance_deduction: number; final_net_salary: number;
}
interface Head {
  paysheet_number: string; month: string;
  total_employees: number; total_net_salary: number;
  clients: { client_name: string } | null;
}

export function downloadPaysheetExcel(head: Head, emps: Emp[]) {
  const rows = emps.map((e, i) => ({
    "#": i + 1,
    Name: e.employee_name, Designation: e.designation,
    UAN: e.uan_number ?? "", ESI: e.esi_number ?? "",
    Duties: e.no_of_duties, Earned: Number(e.earned_wages),
    "EPF Emp": Number(e.epf_employee_deduction),
    "ESI Emp": Number(e.esi_employee_deduction),
    PT: Number(e.pt_deduction), Advance: Number(e.advance_deduction),
    "Final Net": Number(e.final_net_salary),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Paysheet");
  XLSX.writeFile(wb, `${head.paysheet_number}_${(head.clients?.client_name ?? "").replace(/\W+/g, "_")}.xlsx`);
}

export function downloadPaysheetCsv(head: Head, emps: Emp[]) {
  const headers = ["#","Name","Designation","UAN","ESI","Duties","Earned","EPF Emp","ESI Emp","PT","Advance","Final Net"];
  const lines = [headers.join(",")];
  emps.forEach((e, i) => {
    lines.push([i+1, e.employee_name, e.designation, e.uan_number ?? "", e.esi_number ?? "",
      e.no_of_duties, e.earned_wages, e.epf_employee_deduction, e.esi_employee_deduction,
      e.pt_deduction, e.advance_deduction, e.final_net_salary,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${head.paysheet_number}.csv`; a.click();
  URL.revokeObjectURL(url);
}
