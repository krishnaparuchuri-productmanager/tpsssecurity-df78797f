import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";

export default function FfsList() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("employee_ffs")
      .select("id, ffs_number, relieving_date, net_payable, status, employee:employees(full_name), client:clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [isSandbox]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Full & Final Settlements</h1>
        <Link to="/app/employees/ffs/new"><Button className="bg-app-navy"><Plus className="h-4 w-4 mr-2" /> New FFS</Button></Link>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr><th className="p-2">FFS No</th><th className="p-2">Employee</th><th className="p-2">Client</th><th className="p-2">Relieving</th><th className="p-2 text-right">Net</th><th className="p-2">Status</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No FFS records</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono text-xs">{r.ffs_number}</td>
                <td className="p-2">{r.employee?.full_name}</td>
                <td className="p-2">{r.client?.client_name ?? "—"}</td>
                <td className="p-2">{formatDate(r.relieving_date)}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(r.net_payable)}</td>
                <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                <td className="p-2"><Link to={`/app/employees/ffs/${r.id}/view`}><Button size="sm" variant="outline">View</Button></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
