import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { getCompanyHeader, jsPDF, autoTable } from "@/lib/reportPdf";
import type { CompanyHeader } from "@/lib/reportPdf";
import { formatINRForPdf as formatINR } from "@/lib/format";
import { FileText, Loader2 } from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function monthTextToDate(text: string): Date | null {
  const parts = text.trim().split(" ");
  if (parts.length !== 2) return null;
  const mi = MONTH_NAMES.indexOf(parts[0]);
  const yr = parseInt(parts[1]);
  if (mi === -1 || isNaN(yr)) return null;
  return new Date(yr, mi, 1);
}

function isFutureMonth(text: string): boolean {
  const d = monthTextToDate(text);
  if (!d) return false;
  const now = new Date();
  return d > new Date(now.getFullYear(), now.getMonth(), 1);
}

function inWords(num: number): string {
  const ones = [
    "","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen",
  ];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function cvt(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + cvt(n % 100);
    if (n < 100000) return cvt(Math.floor(n / 1000)) + "Thousand " + cvt(n % 1000);
    if (n < 10000000) return cvt(Math.floor(n / 100000)) + "Lakh " + cvt(n % 100000);
    return cvt(Math.floor(n / 10000000)) + "Crore " + cvt(n % 10000000);
  }
  if (num === 0) return "Zero Rupees Only";
  const intPart = Math.floor(Math.abs(num));
  const dec = Math.round((Math.abs(num) - intPart) * 100);
  let result = cvt(intPart).trim() + " Rupees";
  if (dec > 0) result += " and " + cvt(dec).trim() + " Paise";
  return result + " Only";
}

function drawPayslipLetterhead(
  doc: jsPDF,
  header: CompanyHeader,
  logoBase64: string | null,
  month: string,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  let y = 12;

  if (logoBase64) {
    try { doc.addImage(logoBase64, "JPEG", 14, y - 4, 18, 18); } catch { /* skip logo on error */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(10, 22, 40);
    doc.text(header.company_name, 38, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    if (header.registered_address) {
      doc.text(header.registered_address, 38, y, { maxWidth: 148 });
      y += 4;
    }
    const meta: string[] = [];
    if (header.gst_number) meta.push(`GSTIN: ${header.gst_number}`);
    if (header.pan_number) meta.push(`PAN: ${header.pan_number}`);
    if (header.phone) meta.push(header.phone);
    if (header.email) meta.push(header.email);
    if (meta.length) { doc.text(meta.join("  |  "), 38, y, { maxWidth: 148 }); y += 4; }
    y = Math.max(y, 30);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(10, 22, 40);
    doc.text(header.company_name, pageW / 2, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    if (header.registered_address) {
      doc.text(header.registered_address, pageW / 2, y, { align: "center", maxWidth: 170 });
      y += 4;
    }
    const meta: string[] = [];
    if (header.gst_number) meta.push(`GSTIN: ${header.gst_number}`);
    if (header.pan_number) meta.push(`PAN: ${header.pan_number}`);
    if (header.phone) meta.push(header.phone);
    if (header.email) meta.push(header.email);
    if (meta.length) {
      doc.text(meta.join("  •  "), pageW / 2, y, { align: "center", maxWidth: 170 });
      y += 4;
    }
  }

  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.6);
  doc.line(14, y + 1, pageW - 14, y + 1);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(10, 22, 40);
  doc.text("SALARY SLIP", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`For the month of ${month}`, pageW / 2, y, { align: "center" });
  y += 6;

  return y;
}

function generateSlipOnPage(
  doc: jsPDF,
  emp: any,
  ps: any,
  header: CompanyHeader,
  logoBase64: string | null,
  isSandbox: boolean,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Watermark — drawn first, with real transparency, so content renders opaquely on top
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(50);
  doc.setTextColor(120, 120, 120);
  doc.text(
    (header.company_name || "TPSS").replace(/\s+/g, "").toUpperCase(),
    pageW / 2, pageH / 2,
    { align: "center", angle: 45 },
  );
  if (isSandbox) {
    doc.setFontSize(60);
    doc.setTextColor(200, 0, 0);
    doc.text("SANDBOX", pageW / 2, pageH / 2 + 30, { align: "center", angle: 45 });
  }
  doc.restoreGraphicsState();

  // Header
  let y = drawPayslipLetterhead(doc, header, logoBase64, ps.month);

  // Employee info
  const e = emp.emp ?? {};
  const doj = e.date_of_joining
    ? new Date(e.date_of_joining).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const clientName = (ps.clients as any)?.client_name ?? "—";

  const infoRows = [
    ["Employee Name", emp.employee_name ?? "—", "Month", ps.month],
    ["Employee Code", e.employee_code ?? "—", "UAN No.", emp.uan_number ?? "—"],
    ["Designation", emp.designation ?? "—", "ESI No.", emp.esi_number ?? "—"],
    ["Client / Site", clientName, "Date of Joining", doj],
    ["Bank Account", e.bank_account_number ?? "—", "Bank Name", e.bank_name ?? "—"],
    ["IFSC Code", e.bank_ifsc ?? "—", "Payment Mode", "Bank Transfer"],
  ];

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 38, fillColor: [245, 247, 250] as [number, number, number] },
      1: { cellWidth: 52 },
      2: { fontStyle: "bold", cellWidth: 38, fillColor: [245, 247, 250] as [number, number, number] },
      3: { cellWidth: 52 },
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Attendance
  const workingDays = Number(emp.working_days ?? 26);
  const duties = Number(emp.no_of_duties ?? 0);
  const absent = Math.max(0, workingDays - duties);
  autoTable(doc, {
    startY: y,
    head: [["Total Working Days", "Days Present (Duties)", "Days Absent / Leave"]],
    body: [[workingDays, duties, absent]],
    theme: "grid",
    headStyles: { fillColor: [10, 22, 40] as [number, number, number], textColor: 255, fontSize: 8, halign: "center" },
    styles: { fontSize: 9, halign: "center", cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Earnings
  const earnings: [string, string][] = [];
  const addE = (lbl: string, val: number) => { if (val > 0) earnings.push([lbl, formatINR(val)]); };
  addE("Basic Wages", Number(emp.basic ?? 0));
  addE("Dearness Allowance (DA)", Number(emp.da ?? 0));
  addE("Transport Allowance (TA)", Number(emp.ta ?? 0));
  addE("4-Hour OT", Number(emp.four_hour_ot ?? 0));
  addE("Weekly Off Allowance", Number(emp.weekly_off ?? 0));
  addE("Bonus", Number(emp.bonus ?? 0));
  addE("Relieving Charges", Number(emp.relieving_charges ?? 0));
  addE("Leave Wages", Number(emp.leave_wages ?? 0));
  addE("Conveyance Allowance", Number(emp.conveyance_allowance ?? 0));
  addE("Washing Allowance", Number(emp.washing_allowance ?? 0));
  addE("Special Allowance", Number(emp.spl_allowance ?? 0));
  const grossEarned = Number(emp.earned_wages ?? 0);

  // Deductions (only show if > 0; canteen only if canteen_total > 0)
  const deductions: [string, string][] = [];
  const addD = (lbl: string, val: number) => { if (val > 0) deductions.push([lbl, formatINR(val)]); };
  addD("Provident Fund (EPF)", Number(emp.epf_employee_deduction ?? 0));
  addD("ESI Deduction", Number(emp.esi_employee_deduction ?? 0));
  addD("Professional Tax (PT)", Number(emp.pt_deduction ?? 0));
  addD("Advance Recovery", Number(emp.advance_deduction ?? 0));
  addD("Uniform Advance Recovery", Number(emp.uniform_advance_deduction ?? 0));
  addD("Canteen Deduction", Number(emp.canteen_total ?? 0));
  const totalDed =
    Number(emp.epf_employee_deduction ?? 0) +
    Number(emp.esi_employee_deduction ?? 0) +
    Number(emp.pt_deduction ?? 0) +
    Number(emp.advance_deduction ?? 0) +
    Number(emp.uniform_advance_deduction ?? 0) +
    Number(emp.canteen_total ?? 0);

  const maxRows = Math.max(earnings.length, deductions.length);
  const tableRows: string[][] = Array.from({ length: maxRows }, (_, i) => [
    earnings[i]?.[0] ?? "",
    earnings[i]?.[1] ?? "",
    deductions[i]?.[0] ?? "",
    deductions[i]?.[1] ?? "",
  ]);
  tableRows.push(["Gross Earnings", formatINR(grossEarned), "Total Deductions", formatINR(totalDed)]);

  autoTable(doc, {
    startY: y,
    head: [["Earnings", "Amount (Rs.)", "Deductions", "Amount (Rs.)"]],
    body: tableRows,
    theme: "grid",
    headStyles: { fillColor: [10, 22, 40] as [number, number, number], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 30, halign: "right" as const },
      2: { cellWidth: 60 },
      3: { cellWidth: 30, halign: "right" as const },
    },
    didParseCell: (data: any) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [235, 240, 246];
      }
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Net pay
  const netPay = Number(emp.final_net_salary ?? 0);
  autoTable(doc, {
    startY: y,
    body: [
      ["NET PAY", formatINR(netPay)],
      ["In Words", inWords(netPay)],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: {
        fontStyle: "bold",
        cellWidth: 40,
        fillColor: [10, 22, 40] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
      },
      1: { fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Footer
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(140);
  doc.text(
    "This is a system-generated salary slip and does not require a signature.",
    pageW / 2,
    Math.min(y, pageH - 10),
    { align: "center" },
  );
}

export default function Payslip() {
  const { isSandbox } = useEnvironment();
  const company = useCompanyProfile();

  const [paysheets, setPaysheets] = useState<any[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [selClient, setSelClient] = useState("");
  const [availMonths, setAvailMonths] = useState<string[]>([]);
  const [selMonth, setSelMonth] = useState("");
  const [empList, setEmpList] = useState<{ id: string; name: string }[]>([]);
  const [selEmp, setSelEmp] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPaysheets(); }, [isSandbox]);

  async function loadPaysheets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("paysheets")
      .select("id, month, client_id, clients(client_name)")
      .eq("status", "approved")
      .eq("is_sandbox", isSandbox)
      .order("created_at", { ascending: false });

    if (error) { toast.error(error.message); setLoading(false); return; }

    const valid = (data ?? []).filter((ps: any) => !isFutureMonth(ps.month));
    setPaysheets(valid);

    const cMap = new Map<string, string>();
    valid.forEach((ps: any) => {
      if (ps.client_id && (ps.clients as any)?.client_name) {
        cMap.set(ps.client_id, (ps.clients as any).client_name);
      }
    });
    setClients(
      [...cMap.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setSelClient(""); setAvailMonths([]); setSelMonth("");
    setEmpList([]); setSelEmp("all");
    setLoading(false);
  }

  useEffect(() => {
    if (!selClient) { setAvailMonths([]); setSelMonth(""); return; }
    const ms = paysheets.filter((ps) => ps.client_id === selClient).map((ps) => ps.month);
    const unique = [...new Set(ms)].sort((a, b) => {
      const da = monthTextToDate(a), db = monthTextToDate(b);
      if (!da || !db) return 0;
      return db.getTime() - da.getTime();
    });
    setAvailMonths(unique);
    setSelMonth(""); setEmpList([]); setSelEmp("all");
  }, [selClient]);

  useEffect(() => {
    if (!selClient || !selMonth) { setEmpList([]); return; }
    const ps = paysheets.find((p) => p.client_id === selClient && p.month === selMonth);
    if (!ps) return;
    (async () => {
      const { data } = await supabase
        .from("paysheet_employees")
        .select("employee_id, employee_name")
        .eq("paysheet_id", ps.id)
        .eq("is_deleted", false)
        .order("employee_name");
      setEmpList((data ?? []).map((e: any) => ({ id: e.employee_id, name: e.employee_name })));
      setSelEmp("all");
    })();
  }, [selMonth]);

  async function generate() {
    if (!selClient || !selMonth) { toast.error("Select client and month first"); return; }
    const ps = paysheets.find((p) => p.client_id === selClient && p.month === selMonth);
    if (!ps) { toast.error("Paysheet not found"); return; }

    setGenerating(true);
    try {
      let query = (supabase as any)
        .from("paysheet_employees")
        .select("*, emp:employees!employee_id(employee_code, date_of_joining, bank_account_number, bank_ifsc, bank_name)")
        .eq("paysheet_id", ps.id)
        .eq("is_deleted", false)
        .order("employee_name");
      if (selEmp !== "all") query = query.eq("employee_id", selEmp);

      const { data: emps, error } = await query;
      if (error) throw error;
      if (!emps || emps.length === 0) { toast.error("No employee data found"); return; }

      const header = await getCompanyHeader();

      let logoBase64: string | null = null;
      if (company?.logo_url) {
        try {
          const resp = await fetch(company.logo_url);
          const blob = await resp.blob();
          logoBase64 = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
        } catch { /* proceed without logo */ }
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      emps.forEach((emp: any, idx: number) => {
        if (idx > 0) doc.addPage();
        generateSlipOnPage(doc, emp, ps, header, logoBase64, isSandbox);
      });

      const clientName = ((ps.clients as any)?.client_name ?? "Client").replace(/\s+/g, "_");
      const empLabel = selEmp === "all"
        ? `All_${clientName}`
        : emps[0].employee_name.replace(/\s+/g, "_");
      doc.save(`Payslip_${empLabel}_${ps.month.replace(/\s+/g, "_")}.pdf`);
      toast.success(`${emps.length} payslip${emps.length !== 1 ? "s" : ""} downloaded`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Generate Payslips</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate individual or bulk salary slips from approved paysheets.
          {isSandbox && " SANDBOX environment — slips will include a watermark."}
        </p>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-5 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading paysheets…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Client / Site *</Label>
                <Select value={selClient} onValueChange={setSelClient}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={clients.length === 0 ? "No approved paysheets found" : "Select client…"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Month *</Label>
                <Select value={selMonth} onValueChange={setSelMonth} disabled={!selClient}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selClient ? "Select client first"
                        : availMonths.length === 0 ? "No approved months"
                        : "Select month…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availMonths.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Employee</Label>
                <Select value={selEmp} onValueChange={setSelEmp} disabled={!selMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees ({empList.length})</SelectItem>
                    {empList.map((em) => (
                      <SelectItem key={em.id} value={em.id}>{em.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={generate}
              disabled={!selClient || !selMonth || generating}
              className="bg-app-navy text-white"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              ) : (
                <><FileText className="h-4 w-4 mr-2" /> Generate PDF</>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
