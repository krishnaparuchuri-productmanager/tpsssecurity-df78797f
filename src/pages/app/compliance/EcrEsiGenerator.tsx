import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { addExcelBranding } from "@/lib/excelBranding";

interface PaysheetRow {
  id: string; month: string;
  paysheet_lines: Array<{
    employee_id: string; uan_number: string | null; esi_number: string | null;
    employee_name: string; gross_wages: number; epf_wages: number; epf_employee: number;
    epf_employer: number; eps_employer: number; esi_wages: number; esi_employee: number;
    esi_employer: number; days_worked: number;
  }> | null;
}

export default function EcrEsiGenerator() {
  const { isSandbox } = useEnvironment();
  const company = useCompanyProfile();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [paysheets, setPaysheets] = useState<PaysheetRow[]>([]);

  useEffect(() => {
    const m = `${year}-${String(month).padStart(2, "0")}`;
    supabase.from("paysheets")
      .select("id, month, paysheet_lines(employee_id, employee_name, uan_number, esi_number, gross_wages, epf_wages, epf_employee, epf_employer, eps_employer, esi_wages, esi_employee, esi_employer, days_worked)")
      .eq("month", m).eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .then(({ data }) => setPaysheets((data ?? []) as unknown as PaysheetRow[]));
  }, [year, month, isSandbox]);

  const allLines = paysheets.flatMap((p) => p.paysheet_lines ?? []);

  function downloadEcrText() {
    if (allLines.length === 0) return toast.error("No paysheet lines for this month");
    // EPFO ECR 2.0 format: pipe-separated, fields:
    // UAN | Member Name | Gross Wages | EPF Wages | EPS Wages | EDLI Wages |
    // EPF Contribution (Employee) | EPS Contribution | EPF Contribution (Employer Diff) | NCP Days | Refund of Advances
    const lines = allLines
      .filter((l) => (l.uan_number || "").trim().length > 0)
      .map((l) => {
        const epfWages = Math.round(Number(l.epf_wages));
        const epsWages = Math.min(epfWages, 15000);
        const edliWages = epsWages;
        const epfEe = Math.round(Number(l.epf_employee));
        const eps = Math.round(Number(l.eps_employer));
        const epfErDiff = Math.max(0, Math.round(Number(l.epf_employer)) - eps);
        const ncpDays = Math.max(0, 30 - Math.round(Number(l.days_worked)));
        return [
          l.uan_number, l.employee_name, Math.round(Number(l.gross_wages)),
          epfWages, epsWages, edliWages, epfEe, eps, epfErDiff, ncpDays, 0,
        ].join("#~#");
      });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ECR_${year}-${String(month).padStart(2, "0")}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`ECR file generated: ${lines.length} members`);
  }

  function downloadEsiExcel() {
    if (allLines.length === 0) return toast.error("No paysheet lines");
    const data = allLines
      .filter((l) => (l.esi_number || "").trim().length > 0)
      .map((l) => ({
        "IP Number": l.esi_number, "IP Name": l.employee_name,
        "No of Days": Math.round(Number(l.days_worked)),
        "Total Monthly Wages": Math.round(Number(l.esi_wages)),
        "Reason Code (numeric only)": "", "Last Working Day": "",
      }));
    const wb = XLSX.utils.book_new();
    const wsEsi = XLSX.utils.json_to_sheet(data);
    if (company) addExcelBranding(wsEsi, company);
    XLSX.utils.book_append_sheet(wb, wsEsi, "ESI");
    XLSX.writeFile(wb, `ESI_Challan_${year}-${String(month).padStart(2, "0")}.xlsx`);
  }

  const epfTotal = allLines.reduce((s, l) => s + Number(l.epf_employee) + Number(l.epf_employer), 0);
  const esiTotal = allLines.reduce((s, l) => s + Number(l.esi_employee) + Number(l.esi_employer), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">ECR & ESI Challan Generator</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" /></div>
            <div><Label>Month</Label><Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20" /></div>
          </div>
          <div className="text-sm text-app-muted">
            {paysheets.length} paysheets · {allLines.length} employee lines
          </div>
          <Tabs defaultValue="ecr">
            <TabsList>
              <TabsTrigger value="ecr">EPFO ECR 2.0</TabsTrigger>
              <TabsTrigger value="esi">ESI Challan</TabsTrigger>
            </TabsList>
            <TabsContent value="ecr" className="pt-4 space-y-3">
              <div className="bg-app-surface p-3 rounded border border-app-border">
                <div className="text-sm">Total EPF contribution (EE+ER): <b>₹ {epfTotal.toFixed(0)}</b></div>
                <div className="text-xs text-app-muted mt-1">Members included: only those with a UAN number on file.</div>
              </div>
              <Button className="bg-app-navy text-white" onClick={downloadEcrText}>
                <Download className="h-4 w-4 mr-1" /> Download ECR text file
              </Button>
            </TabsContent>
            <TabsContent value="esi" className="pt-4 space-y-3">
              <div className="bg-app-surface p-3 rounded border border-app-border">
                <div className="text-sm">Total ESI contribution (EE+ER): <b>₹ {esiTotal.toFixed(0)}</b></div>
                <div className="text-xs text-app-muted mt-1">Members included: only those with an ESI number on file.</div>
              </div>
              <Button className="bg-app-navy text-white" onClick={downloadEsiExcel}>
                <Download className="h-4 w-4 mr-1" /> Download ESI Challan Excel
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
