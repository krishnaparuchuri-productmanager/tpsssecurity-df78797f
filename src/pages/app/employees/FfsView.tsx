import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { formatINR, formatINRForPdf, formatDate } from "@/lib/format";
import { getCompanyHeader, drawLetterhead, drawWatermark, jsPDF, autoTable } from "@/lib/reportPdf";

function inWords(amount: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function two(n: number): string {
    return n < 20 ? ones[n] : (tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "")).trim();
  }
  function three(n: number): string {
    return n >= 100 ? ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + two(n % 100) : "") : two(n);
  }
  function convert(n: number): string {
    if (n === 0) return "";
    if (n >= 10000000) return three(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
    if (n >= 100000) return three(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    if (n >= 1000) return three(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + three(n % 1000) : "");
    return three(n);
  }
  const n = Math.round(Math.abs(amount));
  return (amount < 0 ? "Negative " : "") + "Rupees " + (convert(n) || "Zero") + " Only";
}

export default function FfsView() {
  const { id } = useParams();
  const [f, setF] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("employee_ffs")
      .select("*, employee:employees(full_name, employee_code, designation, date_of_joining), client:clients(client_name, canteen_enabled)")
      .eq("id", id).maybeSingle().then(({ data }) => setF(data));
  }, [id]);

  async function download() {
    if (!f) return;
    const header = await getCompanyHeader();
    const doc = new jsPDF();

    // Watermark drawn first so content renders on top
    drawWatermark(doc, header.company_name, f.is_sandbox);

    doc.setTextColor(0, 0, 0);
    let y = drawLetterhead(doc, header, "FULL & FINAL SETTLEMENT");

    // Header details block
    y += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    doc.text(`FFS No: ${f.ffs_number}`, 14, y);
    doc.text(`Date: ${formatDate(f.relieving_date)}`, 105, y);
    doc.text(`Status: ${(f.status ?? "").toUpperCase()}`, 162, y);
    y += 6;
    doc.text(`Employee: ${f.employee?.full_name} (${f.employee?.employee_code})`, 14, y);
    y += 5;
    doc.text(`Designation: ${f.employee?.designation ?? "—"}`, 14, y);
    doc.text(`DOJ: ${formatDate(f.employee?.date_of_joining)}`, 105, y);
    y += 5;
    doc.text(`Client: ${f.client?.client_name ?? "—"}`, 14, y);
    doc.text(`Reason: ${f.reason_for_leaving}`, 105, y);
    y += 5;
    doc.text(`Relieving Date: ${formatDate(f.relieving_date)}`, 14, y);
    doc.text(`Last Working Day: ${formatDate(f.last_working_day)}`, 105, y);
    y += 5;
    doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(14, y, 196, y);
    y += 4;

    // Earnings table
    const earningsRows: [string, string][] = [
      ["Earned Wages Pending", formatINRForPdf(f.earned_wages_pending)],
      ["Leave Encashment", formatINRForPdf(f.leave_encashment_amount)],
      ["Bonus", formatINRForPdf(f.bonus_amount)],
    ];
    if (Number(f.gratuity_amount) > 0) {
      earningsRows.push([`Gratuity (${f.gratuity_years_of_service} yrs service)`, formatINRForPdf(f.gratuity_amount)]);
    }
    earningsRows.push(["TOTAL EARNINGS", formatINRForPdf(f.total_earnings)]);

    autoTable(doc, {
      startY: y,
      head: [["EARNINGS", "Amount (Rs.)"]],
      body: earningsRows,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [10, 22, 40], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      columnStyles: { 0: { cellWidth: 130 }, 1: { halign: "right", cellWidth: 52 } },
      didParseCell(data) {
        if (data.section === "body" && data.row.index === earningsRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Deductions table
    const dedRows: [string, string][] = [
      ["Advance Outstanding", formatINRForPdf(f.advance_outstanding)],
    ];
    if (Number(f.canteen_deduction) > 0) {
      dedRows.push(["Canteen Dues", formatINRForPdf(f.canteen_deduction)]);
    }
    if (Number(f.other_deductions) > 0) {
      dedRows.push([f.other_deductions_label || "Other Deductions", formatINRForPdf(f.other_deductions)]);
    }
    dedRows.push(["TOTAL DEDUCTIONS", formatINRForPdf(f.total_deductions_ffs)]);

    autoTable(doc, {
      startY: y,
      head: [["DEDUCTIONS", "Amount (Rs.)"]],
      body: dedRows,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [140, 30, 30], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      columnStyles: { 0: { cellWidth: 130 }, 1: { halign: "right", cellWidth: 52 } },
      didParseCell(data) {
        if (data.section === "body" && data.row.index === dedRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // Net payable
    doc.setDrawColor(10, 22, 40); doc.setLineWidth(0.6); doc.line(14, y, 196, y); y += 6;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(10, 22, 40);
    doc.text("NET PAYABLE", 14, y);
    doc.text(formatINRForPdf(f.net_payable), 196, y, { align: "right" });
    y += 6;
    doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(80);
    doc.text(`Amount in words: ${inWords(f.net_payable)}`, 14, y);
    y += 14;

    // Signature lines
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(0);
    doc.text("Employee Signature: _________________________", 14, y);
    doc.text("Authorized Signatory: ______________________", 116, y);

    doc.save(`${f.ffs_number}.pdf`);
  }

  if (!f) return <div>Loading…</div>;
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/app/employees/ffs/list"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <h1 className="text-2xl font-bold text-app-navy">{f.ffs_number}</h1>
          <Badge variant="outline">{f.status}</Badge>
        </div>
        <Button onClick={download} variant="outline"><Download className="h-4 w-4 mr-2" /> PDF</Button>
      </div>
      <Card><CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-xs text-muted-foreground">Employee</div>{f.employee?.full_name}</div>
        <div><div className="text-xs text-muted-foreground">Client</div>{f.client?.client_name ?? "—"}</div>
        <div><div className="text-xs text-muted-foreground">Relieving Date</div>{formatDate(f.relieving_date)}</div>
        <div><div className="text-xs text-muted-foreground">Last Working Day</div>{formatDate(f.last_working_day)}</div>
        <div><div className="text-xs text-muted-foreground">Reason</div>{f.reason_for_leaving}</div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Settlement</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="font-semibold">Earnings</div>
          <div className="flex justify-between"><span>Earned Wages Pending</span><span className="tabular-nums">{formatINR(f.earned_wages_pending)}</span></div>
          <div className="flex justify-between"><span>Leave Encashment</span><span className="tabular-nums">{formatINR(f.leave_encashment_amount)}</span></div>
          <div className="flex justify-between"><span>Bonus</span><span className="tabular-nums">{formatINR(f.bonus_amount)}</span></div>
          <div className="flex justify-between"><span>Gratuity</span><span className="tabular-nums">{formatINR(f.gratuity_amount ?? 0)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total Earnings</span><span className="tabular-nums">{formatINR(f.total_earnings)}</span></div>
          <div className="font-semibold mt-3">Deductions</div>
          <div className="flex justify-between"><span>Advance Outstanding</span><span className="tabular-nums">{formatINR(f.advance_outstanding)}</span></div>
          {Number(f.canteen_deduction) > 0 && (
            <div className="flex justify-between"><span>Canteen Dues</span><span className="tabular-nums">{formatINR(f.canteen_deduction)}</span></div>
          )}
          <div className="flex justify-between"><span>{f.other_deductions_label || "Other"}</span><span className="tabular-nums">{formatINR(f.other_deductions)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total Deductions</span><span className="tabular-nums">{formatINR(f.total_deductions_ffs)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold text-app-navy"><span>Net Payable</span><span className="tabular-nums">{formatINR(f.net_payable)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
