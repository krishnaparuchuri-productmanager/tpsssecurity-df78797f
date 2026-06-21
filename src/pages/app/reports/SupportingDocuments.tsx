import { useEffect, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { getCompanyHeader, jsPDF, autoTable } from "@/lib/reportPdf";
import type { CompanyHeader } from "@/lib/reportPdf";
import { formatINR } from "@/lib/format";
import { FileText, Loader2 } from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function monthTextToDate(t: string): Date | null {
  const p = t.trim().split(" ");
  if (p.length !== 2) return null;
  const mi = MONTH_NAMES.indexOf(p[0]);
  const yr = parseInt(p[1]);
  if (mi === -1 || isNaN(yr)) return null;
  return new Date(yr, mi, 1);
}

function isFutureMonth(t: string): boolean {
  const d = monthTextToDate(t);
  if (!d) return false;
  const n = new Date();
  return d > new Date(n.getFullYear(), n.getMonth(), 1);
}

async function fetchLogoBase64(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const blob = await (await fetch(logoUrl)).blob();
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── shared PDF header ───────────────────────────────────────────────────────

function drawReportHeader(
  doc: jsPDF,
  header: CompanyHeader,
  logoBase64: string | null,
  title: string,
  subtitle: string,
  companyName: string,
  isSandbox: boolean,
): number {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // watermark first
  doc.setFont("helvetica", "bold"); doc.setFontSize(52); doc.setTextColor(237, 237, 237);
  doc.text(companyName.toUpperCase(), pw / 2, ph / 2, { align: "center", angle: 45 });
  if (isSandbox) {
    doc.setFontSize(62); doc.setTextColor(255, 218, 218);
    doc.text("SANDBOX", pw / 2, ph / 2 + 32, { align: "center", angle: 45 });
  }

  let y = 10;
  if (logoBase64) {
    try { doc.addImage(logoBase64, "JPEG", 10, y - 2, 15, 15); } catch {}
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(10, 22, 40);
    doc.text(header.company_name, 28, y + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(80);
    if (header.registered_address) { doc.text(header.registered_address, 28, y + 8, { maxWidth: pw - 40 }); }
    y += 17;
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(10, 22, 40);
    doc.text(header.company_name, pw / 2, y + 3, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(80);
    if (header.registered_address) { doc.text(header.registered_address, pw / 2, y, { align: "center", maxWidth: pw - 20 }); y += 4; }
    const meta: string[] = [];
    if (header.gst_number) meta.push(`GSTIN: ${header.gst_number}`);
    if (header.pan_number) meta.push(`PAN: ${header.pan_number}`);
    if (header.phone) meta.push(header.phone);
    if (meta.length) { doc.text(meta.join("  •  "), pw / 2, y, { align: "center" }); y += 4; }
  }

  doc.setDrawColor(201, 168, 76); doc.setLineWidth(0.5); doc.line(10, y + 1, pw - 10, y + 1);
  y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(10, 22, 40);
  doc.text(title, pw / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(80);
  doc.text(subtitle, pw / 2, y, { align: "center" });
  y += 6;

  return y;
}

function repeatWatermarkOnNewPage(doc: jsPDF, companyName: string, isSandbox: boolean) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "bold"); doc.setFontSize(52); doc.setTextColor(237, 237, 237);
  doc.text(companyName.toUpperCase(), pw / 2, ph / 2, { align: "center", angle: 45 });
  if (isSandbox) {
    doc.setFontSize(62); doc.setTextColor(255, 218, 218);
    doc.text("SANDBOX", pw / 2, ph / 2 + 32, { align: "center", angle: 45 });
  }
}

// ─── Salary Register PDF ─────────────────────────────────────────────────────

function buildSalaryRegister(
  emps: any[], clientName: string, month: string,
  header: CompanyHeader, logoBase64: string | null, isSandbox: boolean,
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const cn = header.company_name || "TPSS";
  const subtitle = `Client: ${clientName}  |  Month: ${month}`;
  const y = drawReportHeader(doc, header, logoBase64, "SALARY REGISTER", subtitle, cn, isSandbox);

  const rows = emps.map((e, i) => [
    i + 1,
    e.employee_name ?? "—",
    e.designation ?? "—",
    e.no_of_duties ?? 0,
    formatINR(Number(e.earned_wages ?? 0)),
    formatINR(Number(e.epf_employee_deduction ?? 0)),
    formatINR(Number(e.esi_employee_deduction ?? 0)),
    formatINR(Number(e.pt_deduction ?? 0)),
    formatINR(Number(e.advance_deduction ?? 0)),
    formatINR(Number(e.uniform_advance_deduction ?? 0)),
    formatINR(Number(e.canteen_total ?? 0)),
    formatINR(Number(e.final_net_salary ?? 0)),
  ]);

  const sum = (col: keyof typeof emps[0]) =>
    emps.reduce((s, e) => s + Number(e[col] ?? 0), 0);

  autoTable(doc, {
    startY: y,
    head: [["#", "Employee Name", "Designation", "Duties", "Earned Wages", "EPF Emp", "ESI Emp", "PT", "Advance", "Unif. Adv", "Canteen", "Net Pay"]],
    body: rows,
    foot: [["", `Total (${emps.length})`, "", "", formatINR(sum("earned_wages")), formatINR(sum("epf_employee_deduction")), formatINR(sum("esi_employee_deduction")), formatINR(sum("pt_deduction")), formatINR(sum("advance_deduction")), formatINR(sum("uniform_advance_deduction")), formatINR(sum("canteen_total")), formatINR(sum("final_net_salary"))]],
    theme: "striped",
    headStyles: { fillColor: [10, 22, 40] as [number,number,number], textColor: 255, fontSize: 7 },
    footStyles: { fillColor: [235, 240, 246] as [number,number,number], fontStyle: "bold", fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 1.4 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" as const },
      1: { cellWidth: 44 },
      2: { cellWidth: 28 },
      3: { cellWidth: 13, halign: "center" as const },
      4: { cellWidth: 24, halign: "right" as const },
      5: { cellWidth: 20, halign: "right" as const },
      6: { cellWidth: 20, halign: "right" as const },
      7: { cellWidth: 16, halign: "right" as const },
      8: { cellWidth: 20, halign: "right" as const },
      9: { cellWidth: 20, halign: "right" as const },
      10: { cellWidth: 20, halign: "right" as const },
      11: { cellWidth: 24, halign: "right" as const, fontStyle: "bold" },
    },
    didDrawPage: (d: any) => { if (d.pageNumber > 1) repeatWatermarkOnNewPage(doc, cn, isSandbox); },
    margin: { left: 10, right: 10 },
  });

  addReportFooter(doc, "Salary Register");
  return doc;
}

// ─── PF Contribution Statement PDF ───────────────────────────────────────────

function buildPFStatement(
  emps: any[], clientName: string, month: string,
  header: CompanyHeader, logoBase64: string | null, isSandbox: boolean,
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const cn = header.company_name || "TPSS";
  const subtitle = `Client: ${clientName}  |  Month: ${month}`;
  const y = drawReportHeader(doc, header, logoBase64, "PF CONTRIBUTION STATEMENT", subtitle, cn, isSandbox);

  const rows = emps.map((e, i) => [
    i + 1,
    e.employee_name ?? "—",
    e.uan_number ?? "—",
    formatINR(Number(e.epf_wages ?? 0)),
    formatINR(Number(e.epf_employee_deduction ?? 0)),
    formatINR(Number(e.epf_employer_contribution ?? 0)),
    formatINR(Number(e.epf_employee_deduction ?? 0) + Number(e.epf_employer_contribution ?? 0)),
  ]);

  const sum = (col: keyof typeof emps[0]) => emps.reduce((s, e) => s + Number(e[col] ?? 0), 0);
  const totalEmp = sum("epf_employee_deduction");
  const totalEmpr = sum("epf_employer_contribution");

  autoTable(doc, {
    startY: y,
    head: [["#", "Employee Name", "UAN", "EPF Wages", "Employee (12%)", "Employer (13%)", "Total"]],
    body: rows,
    foot: [["", `Total (${emps.length})`, "", formatINR(sum("epf_wages")), formatINR(totalEmp), formatINR(totalEmpr), formatINR(totalEmp + totalEmpr)]],
    theme: "striped",
    headStyles: { fillColor: [10, 22, 40] as [number,number,number], textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [235, 240, 246] as [number,number,number], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.6 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" as const },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 27, halign: "right" as const },
      4: { cellWidth: 27, halign: "right" as const },
      5: { cellWidth: 27, halign: "right" as const },
      6: { cellWidth: 24, halign: "right" as const, fontStyle: "bold" },
    },
    didDrawPage: (d: any) => { if (d.pageNumber > 1) repeatWatermarkOnNewPage(doc, cn, isSandbox); },
    margin: { left: 14, right: 14 },
  });

  addReportFooter(doc, "PF Contribution Statement");
  return doc;
}

// ─── ESI Contribution Statement PDF ──────────────────────────────────────────

function buildESIStatement(
  emps: any[], clientName: string, month: string,
  header: CompanyHeader, logoBase64: string | null, isSandbox: boolean,
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const cn = header.company_name || "TPSS";
  const subtitle = `Client: ${clientName}  |  Month: ${month}`;
  const y = drawReportHeader(doc, header, logoBase64, "ESI CONTRIBUTION STATEMENT", subtitle, cn, isSandbox);

  const rows = emps.map((e, i) => [
    i + 1,
    e.employee_name ?? "—",
    e.esi_number ?? "—",
    formatINR(Number(e.esi_wages ?? 0)),
    formatINR(Number(e.esi_employee_deduction ?? 0)),
    formatINR(Number(e.esi_employer_contribution ?? 0)),
    formatINR(Number(e.esi_employee_deduction ?? 0) + Number(e.esi_employer_contribution ?? 0)),
  ]);

  const sum = (col: keyof typeof emps[0]) => emps.reduce((s, e) => s + Number(e[col] ?? 0), 0);
  const totalEmp = sum("esi_employee_deduction");
  const totalEmpr = sum("esi_employer_contribution");

  autoTable(doc, {
    startY: y,
    head: [["#", "Employee Name", "ESI No.", "ESI Wages", "Employee (0.75%)", "Employer (3.25%)", "Total"]],
    body: rows,
    foot: [["", `Total (${emps.length})`, "", formatINR(sum("esi_wages")), formatINR(totalEmp), formatINR(totalEmpr), formatINR(totalEmp + totalEmpr)]],
    theme: "striped",
    headStyles: { fillColor: [10, 22, 40] as [number,number,number], textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [235, 240, 246] as [number,number,number], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.6 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" as const },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      3: { cellWidth: 27, halign: "right" as const },
      4: { cellWidth: 27, halign: "right" as const },
      5: { cellWidth: 27, halign: "right" as const },
      6: { cellWidth: 26, halign: "right" as const, fontStyle: "bold" },
    },
    didDrawPage: (d: any) => { if (d.pageNumber > 1) repeatWatermarkOnNewPage(doc, cn, isSandbox); },
    margin: { left: 14, right: 14 },
  });

  addReportFooter(doc, "ESI Contribution Statement");
  return doc;
}

// ─── PT Deduction Report PDF ──────────────────────────────────────────────────

function buildPTReport(
  emps: any[], clientName: string, month: string,
  header: CompanyHeader, logoBase64: string | null, isSandbox: boolean,
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const cn = header.company_name || "TPSS";
  const subtitle = `Client: ${clientName}  |  Month: ${month}`;
  const y = drawReportHeader(doc, header, logoBase64, "PROFESSIONAL TAX DEDUCTION REPORT", subtitle, cn, isSandbox);

  const liable = emps.filter((e) => Number(e.pt_deduction ?? 0) > 0);
  const rows = liable.map((e, i) => [
    i + 1,
    e.employee_name ?? "—",
    e.designation ?? "—",
    formatINR(Number(e.earned_wages ?? 0)),
    formatINR(Number(e.pt_deduction ?? 0)),
  ]);

  const totalPT = liable.reduce((s, e) => s + Number(e.pt_deduction ?? 0), 0);

  autoTable(doc, {
    startY: y,
    head: [["#", "Employee Name", "Designation", "Gross Earned", "PT Deducted"]],
    body: rows.length > 0 ? rows : [["—", "No employees with PT deduction", "", "", ""]],
    foot: rows.length > 0 ? [["", `Total (${liable.length} employees)`, "", "", formatINR(totalPT)]] : undefined,
    theme: "striped",
    headStyles: { fillColor: [10, 22, 40] as [number,number,number], textColor: 255, fontSize: 8 },
    footStyles: { fillColor: [235, 240, 246] as [number,number,number], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" as const },
      1: { cellWidth: 70 },
      2: { cellWidth: 52 },
      3: { cellWidth: 28, halign: "right" as const },
      4: { cellWidth: 24, halign: "right" as const, fontStyle: "bold" },
    },
    didDrawPage: (d: any) => { if (d.pageNumber > 1) repeatWatermarkOnNewPage(doc, cn, isSandbox); },
    margin: { left: 14, right: 14 },
  });

  addReportFooter(doc, "PT Deduction Report");
  return doc;
}

function addReportFooter(doc: jsPDF, docName: string) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(6.5); doc.setFont("helvetica", "italic"); doc.setTextColor(150);
  doc.text(
    `System-generated ${docName}. Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.`,
    pw / 2, ph - 6, { align: "center" }
  );
}

const REPORT_TYPES = [
  { id: "salary-register", label: "Salary Register", desc: "Consolidated earnings, deductions, and net pay for all employees." },
  { id: "pf-statement", label: "PF Statement", desc: "Employee-wise PF wages, employee (12%) and employer (13%) contributions." },
  { id: "esi-statement", label: "ESI Statement", desc: "Employee-wise ESI wages, employee (0.75%) and employer (3.25%) contributions." },
  { id: "pt-report", label: "PT Report", desc: "Professional Tax deducted per employee for the selected month." },
] as const;

type ReportTypeId = typeof REPORT_TYPES[number]["id"];

// ─── component ───────────────────────────────────────────────────────────────

interface AvailableSheet {
  id: string;
  month: string;
  client_id: string;
  client_name: string;
}

export default function SupportingDocuments() {
  const { isSandbox } = useEnvironment();
  const company = useCompanyProfile();

  const [sheets, setSheets] = useState<AvailableSheet[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selMonth, setSelMonth] = useState("");
  const [clientsForMonth, setClientsForMonth] = useState<{ id: string; name: string }[]>([]);
  const [selClients, setSelClients] = useState<string[]>([]);
  const [generating, setGenerating] = useState<ReportTypeId | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSheets(); }, [isSandbox]);

  async function loadSheets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("paysheets")
      .select("id, month, client_id, clients(client_name)")
      .eq("status", "approved")
      .eq("is_sandbox", isSandbox);

    if (error) { toast.error(error.message); setLoading(false); return; }

    const valid: AvailableSheet[] = (data ?? [])
      .filter((ps: any) => !isFutureMonth(ps.month))
      .map((ps: any) => ({
        id: ps.id,
        month: ps.month,
        client_id: ps.client_id,
        client_name: (ps.clients as any)?.client_name ?? "—",
      }));

    setSheets(valid);

    const ms = [...new Set(valid.map((v) => v.month))].sort((a, b) => {
      const da = monthTextToDate(a), db = monthTextToDate(b);
      if (!da || !db) return 0;
      return db.getTime() - da.getTime();
    });
    setMonths(ms);
    setSelMonth(""); setClientsForMonth([]); setSelClients([]);
    setLoading(false);
  }

  useEffect(() => {
    if (!selMonth) { setClientsForMonth([]); setSelClients([]); return; }
    const clients = sheets
      .filter((v) => v.month === selMonth)
      .map((v) => ({ id: v.client_id, name: v.client_name }))
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
      .sort((a, b) => a.name.localeCompare(b.name));
    setClientsForMonth(clients);
    setSelClients(clients.map((c) => c.id));
  }, [selMonth]);

  function toggleClient(id: string) {
    setSelClients((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  async function generateReport(type: ReportTypeId) {
    if (!selMonth || selClients.length === 0) { toast.error("Select a month and at least one client"); return; }

    const selectedSheets = sheets.filter((v) => v.month === selMonth && selClients.includes(v.client_id));
    if (selectedSheets.length === 0) { toast.error("No paysheets found for selection"); return; }

    setGenerating(type);
    try {
      const header = await getCompanyHeader();
      const logoBase64 = await fetchLogoBase64(company?.logo_url);

      // Fetch all employees for all selected paysheets in one call
      const paysheetIds = selectedSheets.map((s) => s.id);
      const { data: allEmps, error } = await supabase
        .from("paysheet_employees")
        .select("*")
        .in("paysheet_id", paysheetIds)
        .eq("is_deleted", false)
        .order("employee_name");

      if (error) throw error;
      if (!allEmps || allEmps.length === 0) { toast.error("No employee records found"); return; }

      // Group employees by paysheet_id
      const byPaysheet = new Map<string, any[]>();
      allEmps.forEach((e: any) => {
        const arr = byPaysheet.get(e.paysheet_id) ?? [];
        arr.push(e);
        byPaysheet.set(e.paysheet_id, arr);
      });

      const typeLabel = REPORT_TYPES.find((r) => r.id === type)?.label ?? type;
      const tag = selMonth.replace(/\s+/g, "_");

      interface PdfEntry { name: string; data: Uint8Array }
      const pdfs: PdfEntry[] = [];

      for (const ps of selectedSheets) {
        const emps = byPaysheet.get(ps.id) ?? [];
        if (emps.length === 0) continue;

        let doc: jsPDF;
        if (type === "salary-register") doc = buildSalaryRegister(emps, ps.client_name, selMonth, header, logoBase64, isSandbox);
        else if (type === "pf-statement") doc = buildPFStatement(emps, ps.client_name, selMonth, header, logoBase64, isSandbox);
        else if (type === "esi-statement") doc = buildESIStatement(emps, ps.client_name, selMonth, header, logoBase64, isSandbox);
        else doc = buildPTReport(emps, ps.client_name, selMonth, header, logoBase64, isSandbox);

        const cTag = ps.client_name.replace(/[\s/\\]/g, "_");
        pdfs.push({ name: `${typeLabel.replace(/\s+/g, "_")}_${cTag}_${tag}.pdf`, data: new Uint8Array(doc.output("arraybuffer") as ArrayBuffer) });
      }

      if (pdfs.length === 0) { toast.error("No data to generate"); return; }

      if (pdfs.length === 1) {
        downloadBlob(new Blob([pdfs[0].data], { type: "application/pdf" }), pdfs[0].name);
        toast.success("PDF downloaded");
      } else {
        const zip = new JSZip();
        pdfs.forEach(({ name, data }) => zip.file(name, data));
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${typeLabel.replace(/\s+/g, "_")}_${tag}.zip`);
        toast.success(`${pdfs.length} PDFs downloaded as ZIP`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(null);
    }
  }

  const canGenerate = !!selMonth && selClients.length > 0;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Statutory & Payroll Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generated from approved paysheets only. Select multiple clients to download a ZIP.
          {isSandbox && " SANDBOX — PDFs will carry a SANDBOX watermark."}
        </p>
      </div>

      {/* Shared filter */}
      <div className="bg-white border border-app-border rounded-lg p-5 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading paysheets…
          </div>
        ) : months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved paysheets found for this environment.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Month *</Label>
              <Select value={selMonth} onValueChange={setSelMonth}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select month…" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {selMonth && clientsForMonth.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Clients *</Label>
                  <button
                    className="text-xs text-app-navy underline"
                    onClick={() =>
                      setSelClients(
                        selClients.length === clientsForMonth.length
                          ? []
                          : clientsForMonth.map((c) => c.id)
                      )
                    }
                  >
                    {selClients.length === clientsForMonth.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {clientsForMonth.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 p-2.5 border border-app-border rounded-lg cursor-pointer hover:bg-app-surface text-sm"
                    >
                      <Checkbox
                        checked={selClients.includes(c.id)}
                        onCheckedChange={() => toggleClient(c.id)}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                </div>
                {selClients.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {selClients.length} clients selected — generates a ZIP file.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Report tabs */}
      {!loading && months.length > 0 && (
        <Tabs defaultValue="salary-register">
          <TabsList className="grid grid-cols-4 w-full">
            {REPORT_TYPES.map((r) => (
              <TabsTrigger key={r.id} value={r.id} className="text-xs">{r.label}</TabsTrigger>
            ))}
          </TabsList>

          {REPORT_TYPES.map((r) => (
            <TabsContent key={r.id} value={r.id}>
              <div className="bg-white border border-app-border rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">{r.desc}</p>
                <Button
                  onClick={() => generateReport(r.id)}
                  disabled={!canGenerate || generating !== null}
                  className="bg-app-navy text-white"
                >
                  {generating === r.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      {selClients.length > 1 ? `Download ZIP (${selClients.length} clients)` : "Download PDF"}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
