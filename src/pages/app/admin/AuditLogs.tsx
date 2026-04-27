import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

interface Log { id: string; action: string; table_name: string | null; record_id: string | null; user_id: string | null; created_at: string; }

export default function AuditLogs() {
  const [rows, setRows] = useState<Log[] | null>(null);
  useEffect(() => {
    supabase.from("audit_logs").select("id, action, table_name, record_id, user_id, created_at").order("created_at", { ascending: false }).limit(200).then(({ data }) => setRows((data ?? []) as Log[]));
  }, []);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Audit Logs</h1>
        <p className="text-sm text-app-muted">Last 200 actions across the system.</p>
      </div>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-app-border text-app-muted">
            <th className="py-2 px-3">Time</th><th className="py-2 px-3">Action</th><th className="py-2 px-3">Table</th><th className="py-2 px-3">Record</th><th className="py-2 px-3">User</th>
          </tr></thead>
          <tbody>
            {rows === null ? <tr><td colSpan={5} className="p-3"><Skeleton className="h-32 w-full" /></td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No audit entries yet</td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-b border-app-border/60">
                  <td className="py-2 px-3 text-xs">{formatDate(r.created_at)} {new Date(r.created_at).toLocaleTimeString("en-IN")}</td>
                  <td className="py-2 px-3"><Badge variant="secondary">{r.action}</Badge></td>
                  <td className="py-2 px-3 font-mono text-xs">{r.table_name ?? "—"}</td>
                  <td className="py-2 px-3 font-mono text-[10px] text-muted-foreground">{r.record_id ?? "—"}</td>
                  <td className="py-2 px-3 font-mono text-[10px] text-muted-foreground">{r.user_id ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
