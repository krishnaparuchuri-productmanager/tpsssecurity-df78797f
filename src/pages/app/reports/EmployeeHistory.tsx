import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { formatINR, formatDate } from "@/lib/format";
import { activity } from "@/lib/activity";
import { drawLetterhead, getCompanyHeader, jsPDF, autoTable } from "@/lib/reportPdf";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { addExcelBranding } from "@/lib/excelBranding";

interface EmpOpt { id: string; full_name: string; employee_code: string; }
interface PayrollRow { paysheet_id: string; month: string; client_id: string; client_name: string; no_of_duties: number; earned_wages: number; epf_employee_deduction: number; esi_employee_deduction: number; pt_deduction: number; advance_deduction: number; final_net_salary: number; }
interface AdvanceRow { id: string; advance_date: string; advance_type: string; total_amount: number; monthly_deduction: number; amount_remaining: number; status: string; }
interface DeploymentRow { id: string; client_name: string; shift_name: string | null; post_name: string | null; deployment_start_date: string; deployment_end_date: string | null; }
interface FfsRow { id: string; relieving_date: string; reason_for_leaving: string; net_payable: number; status: string; }

function fyDefault() {
  const n = new Date();
  const y = n.getMonth() + 1 >= 4 ? n.getFullYear() : n.getFullYear() - 1;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

export default function EmployeeHistory() {
  const company = useCompanyProfile();
  const def = fyDefault();
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [empId, setEmpId] = useState("");
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [ffs, setFfs] = useState<FfsRow[]>([]);

  useEffect(() => {
    supabase.from("employees").select("id, full_name, employee_code").eq("is_deleted", false).order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as EmpOpt[]));
  }, []);

  useEffect(() => {
    if (!empId) { setPayroll([]); setAdvances([]); setDeployments([]); setFfs([]); return; }
    (async () => {
      const { data: pe } = await supabase
        .from("paysheet_employees")
        .select("paysheet_id, no_of_duties, earned_wages, epf_employee_deduction, esi_employee_deduction, pt_deduction, advance_deduction, final_net_salary, paysheets!inner(client_id, month, month_date)")
        .eq("employee_id", empId).eq("is_deleted", false)
        .gte("paysheets.month_date", from).lte("paysheets.month_date", to)
        .order("paysheets(month_date)", { ascending: false });
      const clientIds = Array.from(new Set((pe ?? []).map((r: { paysheets?: { client_id?: string } }) => r.paysheets?.client_id).filter(Boolean) as string[]));
      const clientMap: Record<string, string> = {};
      if (clientIds.length) {
        const { data: cs } = await supabase.from("clients").select("id, client_name").in("id", clientIds);
        (cs ?? []).forEach((c: { id: string; client_name: string }) => { clientMap[c.id] = c.client_name; });
      }
      setPayroll(((pe ?? []) as Array<{ paysheet_id: string; no_of_duties: number; earned_wages: number; epf_employee_deduction: number; esi_employee_deduction: number; pt_deduction: number; advance_deduction: number; final_net_salary: number; paysheets?: { client_id?: string; month?: string } }>).map((r) => ({
        paysheet_id: r.paysheet_id,
        month: r.paysheets?.month ?? "",
        client_id: r.paysheets?.client_id ?? "",
        client_name: clientMap[r.paysheets?.client_id ?? ""] ?? "—",
        no_of_duties: Number(r.no_of_duties || 0),
        earned_wages: Number(r.earned_wages || 0),
        epf_employee_deduction: Number(r.epf_employee_deduction || 0),
        esi_employee_deduction: Number(r.esi_employee_deduction || 0),
        pt_deduction: Number(r.pt_deduction || 0),
        advance_deduction: Number(r.advance_deduction || 0),
        final_net_salary: Number(r.final_net_salary || 0),
      })));

      const { data: ad } = await supabase
        .from("employee_advances")
        .select("id, advance_date, advance_type, total_amount, monthly_deduction, amount_remaining, status")
        .eq("employee_id", empId).eq("is_deleted", false)
        .gte("advance_date", from).lte("advance_date", to)
        .order("advance_date", { ascending: false });
      setAdvances((ad ?? []) as AdvanceRow[]);

      const { data: dp } = await supabase
        .from("employee_deployments")
        .select("id, deployment_start_date, deployment_end_date, clients(client_name), shifts(shift_name), client_posts(post_name)")
        .eq("employee_id", empId).eq("is_deleted", false)
        .order("deployment_start_date", { ascending: false });
      setDeployments(((dp ?? []) as Array<{ id: string; deployment_start_date: string; deployment_end_date: string | null; clients?: { client_name?: string }; shifts?: { shift_name?: string } | null; client_posts?: { post_name?: string } | null }>).map((r) => ({
        id: r.id,
        client_name: r.clients?.client_name ?? "—",
        shift_name: r.shifts?.shift_name ?? null,
        post_name: r.client_posts?.post_name ?? null,
        deployment_start_date: r.deployment_start_date,
        deployment_end_date: r.deployment_end_date,
      })));

      const { data: ff } = await supabase
        .from("employee_ffs")
        .select("id, relieving_date, reason_for_leaving, net_payable, status")
        .eq("employee_id", empId).eq("is_deleted", false)
        .order("relieving_date", { ascending: false });
      setFfs((ff ?? []) as FfsRow[]);
    })();
  }, [empId, from, to]);

  const emp = employees.find((e) => e.id === empId);

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const wsPayroll = XLSX.utils.json_to_sheet(payroll.map((r) => ({
      Month: r.month, Client: r.client_name, Duties: r.no_of_duties,
      "Earned Wages": r.earned_wages, PF: r.epf_employee_deduction, ESI: r.esi_employee_deduction,
      PT: r.pt_deduction, "Advance Ded": r.advance_deduction, "Net Salary": r.final_net_salary,
    })));
    if (company) addExcelBranding(wsPayroll, company);
    XLSX.utils.book_append_sheet(wb, wsPayroll, "Payroll");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(advances.map((r) => ({
      Date: r.advance_date, Type: r.advance_type, Amount: Number(r.total_amount),
      "Monthly Ded": Number(r.monthly_deduction), Remaining: Number(r.amount_remaining), Status: r.status,
    }))), "Advances");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deployments.map((r) => ({
      Client: r.client_name, Shift: r.shift_name ?? "", Post: r.post_name ?? "",
      Start: r.deployment_start_date, End: r.deployment_end_date ?? "Current",
    }))), "Deployments");
    if (ffs.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ffs.map((r) => ({
        "Relieving Date": r.relieving_date, Reason: r.reason_for_leaving,
        "Net Payable": Number(r.net_payable), Status: r.status,
      }))), "FFS");
    }
    const fname = `${emp?.employee_code ?? "Employee"}_History.xlsx`;
    XLSX.writeFile(wb, fname);
    activity.export(fname, "excel");
  }

  async function exportPdf() {
    const header = await getCompanyHeader();
    const doc = new jsPDF();
    let y = drawLetterhead(doc, header, "Employee Consolidated History");
    doc.setFontSize(9); doc.setTextColor(60);
    doc.text(`Employee: ${emp?.full_name} (${emp?.employee_code})`, 14, y); y += 5;
    doc.text(`Period: ${formatDate(from)} to ${formatDate(to)}`, 14, y); y += 4;

    autoTable(doc, { startY: y + 4, head: [["Month", "Client", "Duties", "Earned", "PF", "ESI", "PT", "Adv", "Net"]],
      body: payroll.map((r) => [r.month, r.client_name, r.no_of_duties, formatINR(r.earned_wages),
        formatINR(r.epf_employee_deduction), formatINR(r.esi_employee_deduction),
        formatINR(r.pt_deduction), formatINR(r.advance_deduction), formatINR(r.final_net_salary)]),
      styles: { fontSize: 7 }, headStyles: { fillColor: [10, 22, 40] }, margin: { left: 14, right: 14 } });

    const fname = `${emp?.employee_code ?? "Employee"}_History.pdf`;
    doc.save(fname);
    activity.export(fname, "pdf");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Employee Consolidated History</h1>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[260px]"><Label>Employee *</Label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button variant="outline" onClick={exportExcel} disabled={!empId}><Download className="h-4 w-4 mr-1" /> Excel (all tabs)</Button>
            <Button variant="outline" onClick={exportPdf} disabled={!empId}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          </div>
        </CardContent>
      </Card>

      {empId && (
        <Tabs defaultValue="payroll">
          <TabsList>
            <TabsTrigger value="payroll">Payroll ({payroll.length})</TabsTrigger>
            <TabsTrigger value="advances">Advances ({advances.length})</TabsTrigger>
            <TabsTrigger value="deployments">Deployments ({deployments.length})</TabsTrigger>
            {ffs.length > 0 && <TabsTrigger value="ffs">FFS ({ffs.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="payroll">
            <Card><CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Duties</TableHead>
                  <TableHead className="text-right">Earned</TableHead><TableHead className="text-right">PF</TableHead><TableHead className="text-right">ESI</TableHead>
                  <TableHead className="text-right">PT</TableHead><TableHead className="text-right">Adv</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payroll.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-app-muted">No payroll records</TableCell></TableRow>}
                  {payroll.map((r) => (
                    <TableRow key={r.paysheet_id}>
                      <TableCell>{r.month}</TableCell><TableCell>{r.client_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.no_of_duties}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.earned_wages)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.epf_employee_deduction)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.esi_employee_deduction)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.pt_deduction)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.advance_deduction)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatINR(r.final_net_salary)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="advances">
            <Card><CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Monthly Ded</TableHead>
                  <TableHead className="text-right">Remaining</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {advances.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-app-muted">No advances</TableCell></TableRow>}
                  {advances.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.advance_date)}</TableCell><TableCell>{r.advance_type}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(r.total_amount))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(r.monthly_deduction))}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(Number(r.amount_remaining))}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="deployments">
            <Card><CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Shift</TableHead><TableHead>Post</TableHead>
                  <TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Duration</TableHead></TableRow></TableHeader>
                <TableBody>
                  {deployments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-app-muted">No deployments</TableCell></TableRow>}
                  {deployments.map((r) => {
                    const start = new Date(r.deployment_start_date).getTime();
                    const end = r.deployment_end_date ? new Date(r.deployment_end_date).getTime() : Date.now();
                    const days = Math.max(0, Math.round((end - start) / 86400000));
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.client_name}</TableCell><TableCell>{r.shift_name ?? "—"}</TableCell><TableCell>{r.post_name ?? "—"}</TableCell>
                        <TableCell>{formatDate(r.deployment_start_date)}</TableCell>
                        <TableCell>{r.deployment_end_date ? formatDate(r.deployment_end_date) : <Badge>Current</Badge>}</TableCell>
                        <TableCell>{days} days</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {ffs.length > 0 && (
            <TabsContent value="ffs">
              <Card><CardContent className="pt-4">
                <Table>
                  <TableHeader><TableRow><TableHead>Relieving Date</TableHead><TableHead>Reason</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ffs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.relieving_date)}</TableCell>
                        <TableCell>{r.reason_for_leaving}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(Number(r.net_payable))}</TableCell>
                        <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
