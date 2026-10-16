// @vitest-environment jsdom
// R-XLS — paysheet Excel/CSV exports, built in memory from synthetic rows (nothing written to disk).
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured: { wb?: unknown; filename?: string } = {};
vi.mock("xlsx", async (orig) => {
  const real = await orig<typeof import("xlsx")>();
  return { ...real, writeFile: (wb: unknown, filename: string) => { captured.wb = wb; captured.filename = filename; } };
});

import * as XLSX from "xlsx";
import { downloadPaysheetCsv, downloadPaysheetExcel } from "@/lib/exportPaysheet";

const emp = (name: string, net: number) => ({
  employee_name: name, designation: "S.GUARD", uan_number: null, esi_number: null, no_of_duties: 30,
  basic: 100, da: 0, ta: 0, four_hour_ot: 0, weekly_off: 0, bonus: 0, relieving_charges: 0, leave_wages: 0,
  conveyance_allowance: 0, washing_allowance: 0, uniform_allowance: 0, spl_allowance: 0, payable_gross: 100, earned_wages: 100,
  epf_employee_deduction: 0, epf_employer_contribution: 0, esi_employee_deduction: 0, esi_employer_contribution: 0,
  pt_deduction: 0, advance_deduction: 0, uniform_advance_deduction: 0, canteen_price: 0, canteen_quantity: 0, canteen_subsidy: 0, canteen_total: 0,
  net_salary: net, final_net_salary: net,
});
const head = { paysheet_number: "PS-TEST-001", month: "Oct 2026", total_employees: 2, total_net_salary: 250, clients: { client_name: "Test Client, Ltd." } };
const emps = [emp("Test Employee A", 100), emp('Test "Quoted" B', 150)];

describe("R-XLS paysheet exports", () => {
  beforeEach(() => { captured.wb = undefined; captured.filename = undefined; });

  it("R-XLS-01 Excel: one row per employee, names and final net as on the paysheet, total matches", () => {
    downloadPaysheetExcel(head, emps);
    expect(captured.filename).toBe("PS-TEST-001_Test_Client_Ltd_.xlsx");
    const sheet = (captured.wb as XLSX.WorkBook).Sheets["Paysheet"];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    expect(rows.map((r) => r.Name)).toEqual(emps.map((e) => e.employee_name));
    expect(rows.reduce((s, r) => s + Number(r["Final Net"]), 0)).toBe(head.total_net_salary);
  });

  it("R-XLS-02 CSV: header + one line per employee; quotes and commas are escaped", async () => {
    let blob: Blob | undefined;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (b: Blob) => { blob = b; return "blob:test"; };
    URL.revokeObjectURL = () => {};
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      downloadPaysheetCsv(head, emps);
    } finally {
      URL.createObjectURL = origCreate;
      click.mockRestore();
    }
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob!);
    });
    const lines = text.split("\n");
    expect(lines).toHaveLength(1 + emps.length);
    expect(lines[0].startsWith("#,Name,Designation")).toBe(true);
    expect(lines[2]).toContain('"Test ""Quoted"" B"');
    const finalNet = lines.slice(1).map((l) => Number(l.split('","').pop()!.replace(/"/g, "")));
    expect(finalNet.reduce((s, v) => s + v, 0)).toBe(head.total_net_salary);
  });
});
