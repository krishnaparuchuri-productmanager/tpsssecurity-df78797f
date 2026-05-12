import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR, formatDate } from "@/lib/format";
import { activity } from "@/lib/activity";
import { drawLetterhead, getCompanyHeader, jsPDF, autoTable } from "@/lib/reportPdf";

function fyOptions() {
  const now = new Date();
  const baseY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const opts: { value: string; label: string; from: string; to: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const y = baseY - i;
    opts.push({ value: `${y}`, label: `FY ${y}-${String(y + 1).slice(2)}`, from: `${y}-04-01`, to: `${y + 1}-03-31` });
  }
  return opts;
}

export default function AnnualSummary() {
  const opts = fyOptions();
  const [fy, setFy] = useState(opts[0].value);
  const [branchId, setBranchId] = useState("all");
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("branches").select("id, branch_name").eq("is_deleted", false).order("branch_name")
      .then(({ data }) => setBranches((data ?? []) as never));
  }, []);

  const period = opts.find((o) => o.value === fy)!;

  async function fetchAll() {
    const filterBranch = branchId === "all" ? null : branchId;
    const [invQ, payQ, expQ, compQ] = await Promise.all([
      supabase.from("invoices").select("invoice_number, month_date, invoice_date, billing_amount, gst_amount, tds_amount, total_invoice_value, amount_received, outstanding_amount, status, branch_id, client_id, clients(client_name)")
        .gte("month_date", period.from).lte("month_date", period.to).eq("is_deleted", false).neq("status", "cancelled")
        .then((r) => filterBranch ? { ...r, data: (r.data ?? []).filter((x: { branch_id: string | null }) => x.branch_id === filterBranch) } : r),
      supabase.from("paysheets").select("paysheet_number, month, month_date, total_employees, total_earned_wages, total_epf_employee, total_epf_employer, total_esi_employee, total_esi_employer, total_pt_deduction, total_net_salary, client_id, clients(client_name)")
        .gte("month_date", period.from).lte("month_date", period.to).eq("is_deleted", false).neq("status", "cancelled"),
      supabase.from("expenses").select("expense_number, expense_date, amount, status, description, branch_id, expense_categories(category_name)")
        .gte("expense_date", period.from).lte("expense_date", period.to).eq("is_deleted", false).eq("status", "approved")
        .then((r) => filterBranch ? { ...r, data: (r.data ?? []).filter((x: { branch_id: string | null }) => x.branch_id === filterBranch) } : r),
      supabase.from("compliance_payments").select("payment_type, payment_date, payment_month, amount, late_fee, interest, total_paid, challan_number, branch_id")
        .gte("payment_date", period.from).lte("payment_date", period.to).eq("is_deleted", false)
        .then((r) => filterBranch ? { ...r, data: (r.data ?? []).filter((x: { branch_id: string | null }) => x.branch_id === filterBranch) } : r),
    ]);
    return {
      invoices: (invQ.data ?? []) as Array<{ invoice_number: string; month_date: string; invoice_date: string; billing_amount: number; gst_amount: number; tds_amount: number; total_invoice_value: number; amount_received: number; outstanding_amount: number; status: string; client_id: string; clients?: { client_name?: string } }>,
      paysheets: (payQ.data ?? []) as Array<{ paysheet_number: string; month: string; month_date: string; total_employees: number; total_earned_wages: number; total_epf_employee: number; total_epf_employer: number; total_esi_employee: number; total_esi_employer: number; total_pt_deduction: number; total_net_salary: number; client_id: string; clients?: { client_name?: string } }>,
      expenses: (expQ.data ?? []) as Array<{ expense_number: string; expense_date: string; amount: number; description: string; expense_categories?: { category_name?: string } }>,
      compliance: (compQ.data ?? []) as Array<{ payment_type: string; payment_date: string; payment_month: string; amount: number; late_fee: number; interest: number; total_paid: number; challan_number: string | null }>,
    };
  }

  async function downloadExcel() {
    setLoading(true);
    try {
      const d = await fetchAll();
      const wb = XLSX.utils.book_new();

      // 1. Invoice register
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.invoices.map((i) => ({
        "Invoice #": i.invoice_number, Month: i.month_date?.slice(0, 7) ?? "", Date: i.invoice_date, Client: i.clients?.client_name ?? "",
        Billing: Number(i.billing_amount), GST: Number(i.gst_amount), TDS: Number(i.tds_amount),
        "Invoice Value": Number(i.total_invoice_value), Received: Number(i.amount_received),
        Outstanding: Number(i.outstanding_amount), Status: i.status,
      }))), "1. Invoice Register");

      // 2. Payment register (receipts table)
      const { data: rcpt } = await supabase
        .from("payments").select("receipt_number, payment_date, amount, payment_mode, reference_number, invoices(invoice_number, clients(client_name))")
        .gte("payment_date", period.from).lte("payment_date", period.to).eq("is_deleted", false);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(((rcpt ?? []) as Array<{ receipt_number: string; payment_date: string; amount: number; payment_mode: string; reference_number: string | null; invoices?: { invoice_number?: string; clients?: { client_name?: string } } }>).map((r) => ({
        Receipt: r.receipt_number, Date: r.payment_date, Invoice: r.invoices?.invoice_number ?? "",
        Client: r.invoices?.clients?.client_name ?? "", Amount: Number(r.amount),
        Mode: r.payment_mode, Reference: r.reference_number ?? "",
      }))), "2. Payment Register");

      // 3. Outstanding summary client-wise
      const outMap: Record<string, { client: string; outstanding: number; count: number }> = {};
      d.invoices.forEach((i) => {
        const k = i.client_id;
        const c = i.clients?.client_name ?? "—";
        outMap[k] = outMap[k] ?? { client: c, outstanding: 0, count: 0 };
        outMap[k].outstanding += Number(i.outstanding_amount);
        if (Number(i.outstanding_amount) > 0) outMap[k].count += 1;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.values(outMap).map((v) => ({
        Client: v.client, "Open Invoices": v.count, "Outstanding (₹)": v.outstanding,
      }))), "3. Outstanding");

      // 4. Payroll summary
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.paysheets.map((p) => ({
        Paysheet: p.paysheet_number, Month: p.month, Client: p.clients?.client_name ?? "",
        Employees: p.total_employees, "Earned Wages": Number(p.total_earned_wages),
        "Net Salary": Number(p.total_net_salary),
      }))), "4. Payroll Summary");

      // 5. EPF/ESI summary
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.paysheets.map((p) => ({
        Month: p.month, Client: p.clients?.client_name ?? "",
        "EPF Employee": Number(p.total_epf_employee), "EPF Employer": Number(p.total_epf_employer),
        "EPF Total": Number(p.total_epf_employee) + Number(p.total_epf_employer),
        "ESI Employee": Number(p.total_esi_employee), "ESI Employer": Number(p.total_esi_employer),
        "ESI Total": Number(p.total_esi_employee) + Number(p.total_esi_employer),
        PT: Number(p.total_pt_deduction),
      }))), "5. EPF-ESI Summary");

      // 6. Expense by category
      const expMap: Record<string, number> = {};
      d.expenses.forEach((e) => {
        const c = e.expense_categories?.category_name ?? "Other";
        expMap[c] = (expMap[c] ?? 0) + Number(e.amount);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(expMap).map(([k, v]) => ({ Category: k, Amount: v }))), "6. Expenses");

      // 7. Compliance register
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.compliance.map((c) => ({
        Type: c.payment_type, "Pay Date": c.payment_date, "For Month": c.payment_month,
        Amount: Number(c.amount), Interest: Number(c.interest), "Late Fee": Number(c.late_fee),
        Total: Number(c.total_paid), Challan: c.challan_number ?? "",
      }))), "7. Compliance");

      // 8. P&L summary
      const totalBilling = d.invoices.reduce((s, i) => s + Number(i.billing_amount), 0);
      const totalGstOut = d.invoices.reduce((s, i) => s + Number(i.gst_amount), 0);
      const totalReceived = d.invoices.reduce((s, i) => s + Number(i.amount_received), 0);
      const totalSalary = d.paysheets.reduce((s, p) => s + Number(p.total_net_salary), 0);
      const totalExp = d.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const totalCompl = d.compliance.reduce((s, c) => s + Number(c.total_paid), 0);
      const grossMargin = totalBilling - totalSalary;
      const netMargin = grossMargin - totalExp - totalCompl;
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { Item: "Total Billing", Amount: totalBilling },
        { Item: "Total GST Output", Amount: totalGstOut },
        { Item: "Total Received", Amount: totalReceived },
        { Item: "Total Salaries", Amount: totalSalary },
        { Item: "Gross Margin (Billing - Salaries)", Amount: grossMargin },
        { Item: "Total Admin Expenses", Amount: totalExp },
        { Item: "Total Compliance Payments", Amount: totalCompl },
        { Item: "Net Margin (approx)", Amount: netMargin },
      ]), "8. P&L Summary");

      const fname = `AnnualSummary_FY${fy}.xlsx`;
      XLSX.writeFile(wb, fname);
      activity.export(fname, "excel");
    } finally { setLoading(false); }
  }

  async function downloadPdf() {
    setLoading(true);
    try {
      const d = await fetchAll();
      const header = await getCompanyHeader();
      const doc = new jsPDF();
      let y = drawLetterhead(doc, header, `Annual Summary — FY ${fy}-${(Number(fy) + 1).toString().slice(2)}`);
      doc.setFontSize(9); doc.setTextColor(60);
      doc.text(`Period: ${formatDate(period.from)} to ${formatDate(period.to)}`, 14, y);
      y += 6;

      const totalBilling = d.invoices.reduce((s, i) => s + Number(i.billing_amount), 0);
      const totalReceived = d.invoices.reduce((s, i) => s + Number(i.amount_received), 0);
      const totalOutstanding = d.invoices.reduce((s, i) => s + Number(i.outstanding_amount), 0);
      const totalSalary = d.paysheets.reduce((s, p) => s + Number(p.total_net_salary), 0);
      const totalExp = d.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const totalCompl = d.compliance.reduce((s, c) => s + Number(c.total_paid), 0);

      autoTable(doc, { startY: y + 2,
        head: [["P&L Summary", "Amount (₹)"]],
        body: [
          ["Total Billing", formatINR(totalBilling)],
          ["Total Received", formatINR(totalReceived)],
          ["Total Outstanding", formatINR(totalOutstanding)],
          ["Total Salaries Paid", formatINR(totalSalary)],
          ["Total Admin Expenses", formatINR(totalExp)],
          ["Total Compliance Payments", formatINR(totalCompl)],
          ["Approx. Net Margin", formatINR(totalBilling - totalSalary - totalExp - totalCompl)],
        ], styles: { fontSize: 9 }, headStyles: { fillColor: [10, 22, 40] } });

      doc.setFontSize(8); doc.setTextColor(120);
      doc.text("Share with your CA/Auditor for annual filing.", 14, doc.internal.pageSize.getHeight() - 10);

      const fname = `AnnualSummary_FY${fy}.pdf`;
      doc.save(fname);
      activity.export(fname, "pdf");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Annual Summary (CA-Ready)</h1>
      <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm text-yellow-900">
        Share with your CA/Auditor for annual filing.
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[180px]"><Label>Financial Year</Label>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]"><Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={downloadExcel} disabled={loading} className="bg-app-navy text-white">
              <Download className="h-4 w-4 mr-1" /> {loading ? "Building…" : "Download Full Report (Excel)"}
            </Button>
            <Button variant="outline" onClick={downloadPdf} disabled={loading}>
              <FileText className="h-4 w-4 mr-1" /> Download PDF Summary
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Sections included</CardTitle></CardHeader>
        <CardContent>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-app-muted">
            <li>Invoice Register (all invoices, month-wise)</li>
            <li>Payment Register (all receipts)</li>
            <li>Outstanding Summary (client-wise)</li>
            <li>Payroll Summary (month-wise, client-wise)</li>
            <li>EPF / ESI Summary (month-wise contributions)</li>
            <li>Expense Summary (category-wise)</li>
            <li>Compliance Payment Register</li>
            <li>P&amp;L Summary (annual)</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
