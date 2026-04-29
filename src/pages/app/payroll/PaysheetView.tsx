import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { downloadPaysheetExcel } from "@/lib/exportPaysheet";

export default function PaysheetView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const canExportExcel = role === "ceo_admin" || role === "coo_ops";
  const [head, setHead] = useState<{
    paysheet_number: string; month: string; status: string; rejection_reason: string | null;
    total_employees: number; total_net_salary: number;
    clients: { client_name: string } | null;
  } | null>(null);
  const [emps, setEmps] = useState<Array<{
    id: string; employee_name: string; designation: string; uan_number: string | null; esi_number: string | null;
    earned_wages: number; epf_employee_deduction: number; esi_employee_deduction: number;
    pt_deduction: number; final_net_salary: number; no_of_duties: number; advance_deduction: number;
  }>>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: h }, { data: e }] = await Promise.all([
        supabase.from("paysheets").select("paysheet_number, month, status, rejection_reason, total_employees, total_net_salary, clients(client_name)").eq("id", id).maybeSingle(),
        supabase.from("paysheet_employees").select("*").eq("paysheet_id", id).order("employee_name"),
      ]);
      setHead(h as unknown as typeof head);
      setEmps((e ?? []) as unknown as typeof emps);
    })();
  }, [id]);

  if (!head) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-app-navy">{head.paysheet_number}</h1>
          <div className="text-sm text-app-muted">{head.clients?.client_name} • {head.month} • <Badge>{head.status}</Badge></div>
          {head.rejection_reason && <div className="text-sm text-red-600 mt-1">Reason: {head.rejection_reason}</div>}
        </div>
        {head.status === "approved" && (
          <Link to={`/app/invoices/new?paysheet=${id}`} className="ml-auto">
            <Button className="bg-app-navy text-white"><FileText className="h-4 w-4 mr-1" /> Generate Invoice</Button>
          </Link>
        )}
      </div>

      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-1">Name</th><th className="p-1">Desig</th>
              <th className="p-1">UAN</th><th className="p-1">ESI</th>
              <th className="p-1">Duties</th>
              <th className="p-1 text-right">Earned</th>
              <th className="p-1 text-right">EPF</th><th className="p-1 text-right">ESI</th>
              <th className="p-1 text-right">PT</th><th className="p-1 text-right">Adv</th>
              <th className="p-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((e) => (
              <tr key={e.id} className="border-t border-app-border">
                <td className="p-1">{e.employee_name}</td>
                <td className="p-1">{e.designation}</td>
                <td className="p-1">{e.uan_number ?? "—"}</td>
                <td className="p-1">{e.esi_number ?? "—"}</td>
                <td className="p-1">{e.no_of_duties}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.earned_wages))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.epf_employee_deduction))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.esi_employee_deduction))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.pt_deduction))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.advance_deduction))}</td>
                <td className="p-1 text-right tabular-nums font-bold">{formatINR(Number(e.final_net_salary))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-app-surface font-bold">
            <tr>
              <td className="p-1" colSpan={10}>Total ({head.total_employees} employees)</td>
              <td className="p-1 text-right tabular-nums">{formatINR(Number(head.total_net_salary))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
