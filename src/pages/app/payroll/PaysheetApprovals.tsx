import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { Check, X, Eye } from "lucide-react";
import { formatINR } from "@/lib/format";

export default function PaysheetApprovals() {
  const { isSandbox } = useEnvironment();
  const { user, role } = useAuth();
  const [rows, setRows] = useState<Array<{
    id: string; paysheet_number: string; month: string; submitted_by: string | null;
    total_employees: number; total_net_salary: number; anomaly_count: number;
    clients: { client_name: string } | null;
  }>>([]);
  const [reject, setReject] = useState<{ id: string; reason: string } | null>(null);

  async function load() {
    const { data } = await supabase.from("paysheets")
      .select("id, paysheet_number, month, submitted_by, total_employees, total_net_salary, anomaly_count, clients(client_name)")
      .eq("status", "submitted")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("submitted_at", { ascending: true });
    setRows((data ?? []) as unknown as typeof rows);
  }
  useEffect(() => { load(); }, [isSandbox]);

  async function approve(id: string, submittedBy: string | null) {
    if (submittedBy && submittedBy === user?.id && role !== "ceo_admin") {
      toast.error("Cannot approve your own submission");
      return;
    }
    const { error } = await supabase.rpc("approve_paysheet", { _id: id });
    if (error) return toast.error(error.message);
    toast.success("Approved");
    load();
  }

  async function doReject() {
    if (!reject) return;
    if (reject.reason.trim().length < 10 || reject.reason.length > 200) {
      toast.error("Reason must be 10–200 characters");
      return;
    }
    const { error } = await supabase.rpc("reject_paysheet", {
      _id: reject.id, _reason: reject.reason.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setReject(null);
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Approval Queue</h1>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-2">No</th><th className="p-2">Month</th><th className="p-2">Client</th>
              <th className="p-2">Employees</th><th className="p-2 text-right">Net Salary</th>
              <th className="p-2">Anomalies</th><th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No paysheets pending approval</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-app-border">
                <td className="p-2 font-mono text-xs">{r.paysheet_number}</td>
                <td className="p-2">{r.month}</td>
                <td className="p-2">{r.clients?.client_name ?? "—"}</td>
                <td className="p-2">{r.total_employees}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(Number(r.total_net_salary))}</td>
                <td className="p-2">{r.anomaly_count > 0 ? `⚠️ ${r.anomaly_count}` : "—"}</td>
                <td className="p-2 flex gap-1">
                  <Link to={`/app/payroll/${r.id}/view`}><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
                  <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => approve(r.id, r.submitted_by)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setReject({ id: r.id, reason: "" })}>
                    <X className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject paysheet</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Reason (10–200 characters)"
              value={reject?.reason ?? ""}
              onChange={(e) => setReject((r) => r ? { ...r, reason: e.target.value } : null)}
              maxLength={200}
              rows={4}
            />
            <div className="text-xs text-muted-foreground text-right">
              {(reject?.reason ?? "").length}/200 (min 10)
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
