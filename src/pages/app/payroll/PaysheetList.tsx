import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

interface Row {
  id: string; paysheet_number: string; month: string; month_date: string;
  client_id: string; total_employees: number; total_earned_wages: number;
  total_epf_employee: number; total_esi_employee: number; anomaly_count: number;
  status: string; created_at: string;
  clients?: { client_name: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function PaysheetList() {
  const { isSandbox } = useEnvironment();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const { data } = await supabase.from("paysheets")
      .select("*, clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("month_date", { ascending: false });
    setRows((data ?? []) as unknown as Row[]);
  }
  useEffect(() => { load(); }, [isSandbox]);

  async function submitForApproval(r: Row) {
    if (r.anomaly_count > 0 && !confirm(`This paysheet has ${r.anomaly_count} anomaly flag(s). Submit anyway?`)) return;
    const { error } = await supabase.from("paysheets").update({
      status: "submitted", submitted_by: user?.id, submitted_at: new Date().toISOString(),
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Submitted for approval");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Monthly Paysheets</h1>
        <Link to="/app/payroll/create">
          <Button className="bg-app-navy text-white"><Plus className="h-4 w-4 mr-1" /> Create Paysheet</Button>
        </Link>
      </div>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-2">No</th><th className="p-2">Month</th><th className="p-2">Client</th>
              <th className="p-2">Employees</th><th className="p-2 text-right">Wages</th>
              <th className="p-2 text-right">EPF</th><th className="p-2 text-right">ESI</th>
              <th className="p-2">Anomalies</th><th className="p-2">Status</th><th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No paysheets yet</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-app-border">
                <td className="p-2 font-mono text-xs">{r.paysheet_number}</td>
                <td className="p-2">{r.month}</td>
                <td className="p-2">{r.clients?.client_name ?? "—"}</td>
                <td className="p-2">{r.total_employees}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(Number(r.total_earned_wages))}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(Number(r.total_epf_employee))}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(Number(r.total_esi_employee))}</td>
                <td className="p-2">{r.anomaly_count > 0 ? <Badge variant="outline" className="text-yellow-700 border-yellow-300">⚠️ {r.anomaly_count}</Badge> : "—"}</td>
                <td className="p-2"><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></td>
                <td className="p-2 text-right whitespace-nowrap">
                  <Link to={`/app/payroll/${r.id}/view`}><Button size="sm" variant="ghost" title="View"><Eye className="h-4 w-4" /></Button></Link>
                  {(r.status === "draft" || r.status === "rejected") && (
                    <Button size="sm" variant="ghost" className="text-blue-700" title="Submit for approval" onClick={() => submitForApproval(r)}>
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
