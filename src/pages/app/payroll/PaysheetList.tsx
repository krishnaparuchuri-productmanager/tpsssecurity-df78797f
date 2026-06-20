import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, Send, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

interface ClientLite { id: string; client_name: string; }

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
  cancelled: "bg-gray-200 text-gray-500 line-through",
};

export default function PaysheetList() {
  const { isSandbox } = useEnvironment();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientFilter, setClientFilter] = useState("all");

  useEffect(() => {
    supabase.from("clients").select("id, client_name").eq("is_active", true).eq("is_sandbox", isSandbox).order("client_name")
      .then(({ data }) => setClients((data ?? []) as ClientLite[]));
  }, [isSandbox]);

  async function load() {
    let q = supabase.from("paysheets")
      .select("*, clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("month_date", { ascending: false });
    if (clientFilter !== "all") q = q.eq("client_id", clientFilter);
    const { data } = await q;
    setRows((data ?? []) as unknown as Row[]);
  }
  useEffect(() => { load(); }, [isSandbox, clientFilter]);

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-app-navy">Monthly Paysheets</h1>
        <div className="flex items-center gap-2">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Link to="/app/payroll/create">
            <Button className="bg-app-navy text-white"><Plus className="h-4 w-4 mr-1" /> Create Paysheet</Button>
          </Link>
        </div>
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
                    <>
                      <Link to={`/app/payroll/create?id=${r.id}`}>
                        <Button size="sm" variant="ghost" title="Edit"><Pencil className="h-4 w-4" /></Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="text-blue-700 gap-1" title="Submit for approval" onClick={() => submitForApproval(r)}>
                        <Send className="h-4 w-4" /><span className="text-xs">Submit</span>
                      </Button>
                    </>
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
