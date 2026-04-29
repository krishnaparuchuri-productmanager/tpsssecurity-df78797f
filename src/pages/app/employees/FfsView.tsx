import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import jsPDF from "jspdf";

export default function FfsView() {
  const { id } = useParams();
  const [f, setF] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from("employee_ffs")
      .select("*, employee:employees(full_name, employee_code, designation, date_of_joining), client:clients(client_name)")
      .eq("id", id).maybeSingle().then(({ data }) => setF(data));
  }, [id]);

  function download() {
    if (!f) return;
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16); doc.text("FULL & FINAL SETTLEMENT", 105, y, { align: "center" }); y += 8;
    doc.setFontSize(10); doc.text("Trinetra Professional Security Services", 105, y, { align: "center" }); y += 12;
    doc.setFontSize(11);
    doc.text(`FFS No: ${f.ffs_number}`, 14, y); doc.text(`Date: ${formatDate(f.relieving_date)}`, 140, y); y += 7;
    doc.text(`Employee: ${f.employee?.full_name} (${f.employee?.employee_code})`, 14, y); y += 6;
    doc.text(`Client: ${f.client?.client_name ?? "—"}`, 14, y); y += 6;
    doc.text(`Reason: ${f.reason_for_leaving}`, 14, y); y += 10;

    doc.setFont(undefined, "bold"); doc.text("EARNINGS", 14, y); doc.setFont(undefined, "normal"); y += 6;
    [["Earned Wages Pending", f.earned_wages_pending],
     ["Leave Encashment", f.leave_encashment_amount],
     ["Bonus", f.bonus_amount],
     ["Gratuity", f.gratuity_amount ?? 0]].forEach(([l,v]) => {
      doc.text(String(l), 20, y); doc.text(formatINR(Number(v)), 180, y, { align: "right" }); y += 5;
    });
    doc.setFont(undefined,"bold"); doc.text("Total Earnings", 20, y); doc.text(formatINR(f.total_earnings), 180, y, { align:"right"}); y += 10;

    doc.text("DEDUCTIONS", 14, y); doc.setFont(undefined,"normal"); y += 6;
    [["Advance Outstanding", f.advance_outstanding],
     [f.other_deductions_label || "Other", f.other_deductions]].forEach(([l,v]) => {
      doc.text(String(l), 20, y); doc.text(formatINR(Number(v)), 180, y, { align: "right" }); y += 5;
    });
    doc.setFont(undefined,"bold"); doc.text("Total Deductions", 20, y); doc.text(formatINR(f.total_deductions_ffs), 180, y, { align:"right"}); y += 10;

    doc.setFontSize(13); doc.text(`NET PAYABLE: ${formatINR(f.net_payable)}`, 14, y); y += 20;
    doc.setFontSize(10); doc.setFont(undefined,"normal");
    doc.text("Employee Signature: _________________________", 14, y);
    doc.text("Authorized Signatory: ______________________", 120, y);
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
          <div className="flex justify-between"><span>{f.other_deductions_label || "Other"}</span><span className="tabular-nums">{formatINR(f.other_deductions)}</span></div>
          <div className="flex justify-between border-t pt-1 font-semibold"><span>Total Deductions</span><span className="tabular-nums">{formatINR(f.total_deductions_ffs)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold text-app-navy"><span>Net Payable</span><span className="tabular-nums">{formatINR(f.net_payable)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
