import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { useAuth } from "@/contexts/AuthContext";
import { getCompanyHeader, jsPDF, autoTable } from "@/lib/reportPdf";
import type { CompanyHeader } from "@/lib/reportPdf";
import { formatINR } from "@/lib/format";
import { FileText, Loader2, AlertCircle } from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

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

function monthToYYYYMM(text: string): string {
  const d = monthTextToDate(text);
  if (!d) return "";
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function downloadCSV(rows: string[][], filename: string) {
  const content = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PDF generation ─────────────────────────────────────────────────────────

function generatePDF(
  emps: any[],
  month: string,
  clientNames: string[],
  header: CompanyHeader,
  logoBase64: string | null,
  generatedBy: string,
  isSandbox: boolean,
): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // watermark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(55);
  doc.setTextColor(237, 237, 237);
  doc.text((header.company_name || "TPSS").toUpperCase(), pageW / 2, pageH / 2, { align: "center", angle: 45 });
  if (isSandbox) {
    doc.setFontSize(65);
    doc.setTextColor(255, 218, 218);
    doc.text("SANDBOX", pageW / 2, pageH / 2 + 35, { align: "center", angle: 45 });
  }

  // letterhead
  let y = 10;
  if (logoBase64) {
    try { doc.addImage(logoBase64, "JPEG", 10, y - 2, 16, 16); } catch { /* skip */ }
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(10, 22, 40);
    doc.text(header.company_name, 30, y + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80);
    if (header.registered_address) { doc.text(header.registered_address, 30, y + 8, { maxWidth: 230 }); }
    y += 16;
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(10, 22, 40);
    doc.text(header.company_name, pageW / 2, y + 4, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80);
    const meta: string[] = [];
    if (header.gst_number) meta.push(`GSTIN: ${header.gst_number}`);
    if (header.pan_number) meta.push(`PAN: ${header.pan_number}`);
    if (header.phone) meta.push(header.phone);
    if (header.email) meta.push(header.email);
    if (header.registered_address) { doc.text(header.registered_address, pageW / 2, y, { align: "center", maxWidth: 250 }); y += 4; }
    if (meta.length) { doc.text(meta.join("  •  "), pageW / 2, y, { align: "center" }); y += 4; }
  }

  doc.setDrawColor(201, 168, 76); doc.setLineWidth(0.6); doc.line(10, y + 1, pageW - 10, y + 1);
  y += 5;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(10, 22, 40);
  doc.text("BANK SALARY DISBURSEMENT REPORT", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80);
  doc.text(`For the month of: ${month}`, pageW / 2, y, { align: "center" });
  y += 6;

  // summary box
  const totalAmt = emps.reduce((s, e) => s + Number(e.final_net_salary ?? 0), 0);
  const generatedOn = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const summaryRows = [
    ["Total Employees", String(emps.length), "Month", month],
    ["Total Amount", formatINR(totalAmt), "Generated By", generatedBy],
    ["Clients", clientNames.join(", "), "Generated On", generatedOn],
  ];
  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 38, fillColor: [245, 247, 250] as [number,number,number] },
      1: { cellWidth: 80 },
      2: { fontStyle: "bold", cellWidth: 38, fillColor: [245, 247, 250] as [number,number,number] },
      3: { cellWidth: 100 },
    },
    margin: { left: 10, right: 10 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // employee table
  const yyyymm = monthToYYYYMM(month);
  const tableRows = emps.map((e, idx) => [
    idx + 1,
    e.employee_name ?? "—",
    e.emp?.bank_account_number ?? "—",
    e.emp?.bank_ifsc ?? "—",
    e.emp?.bank_name ?? "—",
    formatINR(Number(e.final_net_salary ?? 0)),
    `${e.paysheet_id?.slice(0, 8) ?? ""}/${yyyymm}/${e.employee_id?.slice(0, 8) ?? ""}`,
    "",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Employee Name", "Account Number", "IFSC", "Bank", "Net Salary (₹)", "Payment Reference", "Remarks"]],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [10, 22, 40] as [number,number,number], textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" as const },
      1: { cellWidth: 50 },
      2: { cellWidth: 40, font: "courier" },
      3: { cellWidth: 28, font: "courier" },
      4: { cellWidth: 32 },
      5: { cellWidth: 30, halign: "right" as const, fontStyle: "bold" },
      6: { cellWidth: 50, font: "courier", fontSize: 6.5 },
      7: { cellWidth: 27 },
    },
    foot: [["", `Total (${emps.length} employees)`, "", "", "", formatINR(totalAmt), "", ""]],
    footStyles: { fillColor: [235, 240, 246] as [number,number,number], fontStyle: "bold", fontSize: 7.5 },
    margin: { left: 10, right: 10 },
    didDrawPage: (data: any) => {
      // repeat watermark on each new page
      if (data.pageNumber > 1) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(55); doc.setTextColor(237, 237, 237);
        doc.text((header.company_name || "TPSS").toUpperCase(), pageW / 2, pageH / 2, { align: "center", angle: 45 });
        if (isSandbox) {
          doc.setFontSize(65); doc.setTextColor(255, 218, 218);
          doc.text("SANDBOX", pageW / 2, pageH / 2 + 35, { align: "center", angle: 45 });
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(140);
  doc.text(
    "This is a system-generated bank disbursement report. Net salary excludes Uniform Allowance and Service Charges.",
    pageW / 2, Math.min(finalY, pageH - 8), { align: "center" }
  );

  return doc;
}

// ─── component ──────────────────────────────────────────────────────────────

interface EligibleSheet {
  id: string;
  month: string;
  client_id: string;
  client_name: string;
  invoice_id: string;
  invoice_number: string;
}

export default function BankDisbursementReport() {
  const { isSandbox } = useEnvironment();
  const company = useCompanyProfile();
  const { user } = useAuth();

  const [eligible, setEligible] = useState<EligibleSheet[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selMonth, setSelMonth] = useState("");
  const [clientsForMonth, setClientsForMonth] = useState<{ id: string; name: string }[]>([]);
  const [selClients, setSelClients] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEligible(); }, [isSandbox]);

  async function loadEligible() {
    setLoading(true);
    // Fetch approved paysheets with their invoices
    const { data, error } = await supabase
      .from("paysheets")
      .select("id, month, client_id, clients(client_name), invoices!paysheet_id(id, invoice_number, status, is_deleted)")
      .eq("status", "approved")
      .eq("is_sandbox", isSandbox);

    if (error) { toast.error(error.message); setLoading(false); return; }

    // Keep only paysheets that have at least one approved (non-deleted) invoice
    const valid: EligibleSheet[] = [];
    for (const ps of data ?? []) {
      if (isFutureMonth((ps as any).month)) continue;
      const approvedInv = ((ps as any).invoices ?? []).find(
        (inv: any) => inv.status === "approved" && !inv.is_deleted
      );
      if (!approvedInv) continue;
      valid.push({
        id: ps.id,
        month: (ps as any).month,
        client_id: (ps as any).client_id,
        client_name: ((ps as any).clients as any)?.client_name ?? "—",
        invoice_id: approvedInv.id,
        invoice_number: approvedInv.invoice_number,
      });
    }

    setEligible(valid);

    // Build month list sorted newest first
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
    const clients = eligible
      .filter((v) => v.month === selMonth)
      .map((v) => ({ id: v.client_id, name: v.client_name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const unique = clients.filter((c, i) => clients.findIndex((x) => x.id === c.id) === i);
    setClientsForMonth(unique);
    setSelClients(unique.map((c) => c.id)); // default: all selected
  }, [selMonth]);

  function toggleClient(id: string) {
    setSelClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function generate() {
    if (!selMonth || selClients.length === 0) {
      toast.error("Select a month and at least one client");
      return;
    }

    const sheets = eligible.filter(
      (v) => v.month === selMonth && selClients.includes(v.client_id)
    );
    if (sheets.length === 0) { toast.error("No eligible paysheets found"); return; }

    setGenerating(true);
    try {
      // Fetch employee data for all selected paysheets
      const paysheetIds = sheets.map((s) => s.id);
      const { data: emps, error } = await (supabase as any)
        .from("paysheet_employees")
        .select("paysheet_id, employee_id, employee_name, final_net_salary, emp:employees!employee_id(bank_account_number, bank_ifsc, bank_name)")
        .in("paysheet_id", paysheetIds)
        .eq("is_deleted", false)
        .order("employee_name");

      if (error) throw error;
      if (!emps || emps.length === 0) { toast.error("No employee records found"); return; }

      const header = await getCompanyHeader();

      // Fetch logo
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

      const clientNames = clientsForMonth
        .filter((c) => selClients.includes(c.id))
        .map((c) => c.name);
      const generatedBy = user?.email ?? "Portal User";
      const yyyymm = monthToYYYYMM(selMonth);
      const tag = selMonth.replace(/\s+/g, "_");

      // Generate PDF
      const doc = generatePDF(emps, selMonth, clientNames, header, logoBase64, generatedBy, isSandbox);
      doc.save(`Bank_Disbursement_${tag}.pdf`);

      // Generate CSV (NEFT batch format)
      const csvRows: string[][] = [
        ["Sr No", "Beneficiary Name", "Account Number", "IFSC Code", "Amount (INR)", "Bank Name", "Payment Reference", "Remarks"],
      ];
      emps.forEach((e: any, idx: number) => {
        csvRows.push([
          String(idx + 1),
          e.employee_name ?? "",
          e.emp?.bank_account_number ?? "",
          e.emp?.bank_ifsc ?? "",
          Number(e.final_net_salary ?? 0).toFixed(2),
          e.emp?.bank_name ?? "",
          `${e.paysheet_id?.slice(0, 8) ?? ""}/${yyyymm}/${e.employee_id?.slice(0, 8) ?? ""}`,
          "",
        ]);
      });
      downloadCSV(csvRows, `Bank_Disbursement_${tag}.csv`);

      toast.success(`Report generated — ${emps.length} employees, PDF + CSV downloaded`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const selectedSheets = eligible.filter(
    (v) => v.month === selMonth && selClients.includes(v.client_id)
  );

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Bank Salary Disbursement Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Available only when both the paysheet and client invoice are in{" "}
          <span className="font-medium">Approved</span> status.
          {isSandbox && " SANDBOX — generated PDFs will carry a SANDBOX watermark."}
        </p>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-5 space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading eligible months…
          </div>
        ) : months.length === 0 ? (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              No eligible months found. A month is available here only when both its paysheet{" "}
              <strong>and</strong> its client invoice are in <strong>Approved</strong> status. Approve the invoice first.
            </span>
          </div>
        ) : (
          <>
            {/* Month */}
            <div className="space-y-1.5">
              <Label className="text-xs">Month *</Label>
              <Select value={selMonth} onValueChange={setSelMonth}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="Select month…" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Client multi-select */}
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
                  {clientsForMonth.map((c) => {
                    const sheet = eligible.find((v) => v.month === selMonth && v.client_id === c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-start gap-2 p-2.5 border border-app-border rounded-lg cursor-pointer hover:bg-app-surface text-sm"
                      >
                        <Checkbox
                          checked={selClients.includes(c.id)}
                          onCheckedChange={() => toggleClient(c.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          {sheet && (
                            <div className="text-xs text-muted-foreground">
                              Inv: {sheet.invoice_number}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary preview */}
            {selClients.length > 0 && selectedSheets.length > 0 && (
              <div className="text-xs text-muted-foreground bg-app-surface border border-app-border rounded-lg px-3 py-2">
                {selectedSheets.length} paysheet{selectedSheets.length !== 1 ? "s" : ""} selected ·{" "}
                Generates PDF + CSV (NEFT format)
              </div>
            )}

            <Button
              onClick={generate}
              disabled={!selMonth || selClients.length === 0 || generating}
              className="bg-app-navy text-white"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              ) : (
                <><FileText className="h-4 w-4 mr-2" /> Generate PDF + CSV</>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
