import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Play } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

interface Log {
  id: string; backup_date: string; backup_type: string; status: string;
  file_path: string | null; file_size_kb: number; tables_included: string[] | null;
  error_message: string | null;
}

export default function BackupAdmin() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);

  function load() {
    supabase.from("backup_logs").select("id, backup_date, backup_type, status, file_path, file_size_kb, tables_included, error_message")
      .order("backup_date", { ascending: false }).limit(50)
      .then(({ data }) => setLogs((data ?? []) as unknown as Log[]));
  }
  useEffect(load, []);

  async function triggerNow() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("monthly-backup", {
      headers: { "x-cron-secret": "manual-trigger" },
    });
    setBusy(false);
    if (error) {
      toast.error("Manual trigger requires server access. Backups run automatically on the 1st of each month.");
      return;
    }
    toast.success("Backup triggered");
    load();
  }

  async function download(filePath: string) {
    const { data, error } = await supabase.storage.from("backups").createSignedUrl(filePath, 60);
    if (error || !data) return toast.error("Failed to generate download link");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">System Backups</h1>
        <Button variant="outline" disabled={busy} onClick={triggerNow}>
          <Play className="h-4 w-4 mr-1" /> {busy ? "Triggering…" : "Trigger Now"}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-app-muted mb-3">
            Automatic monthly backups run on the 1st of every month at 02:00 UTC.
            All key tables (clients, employees, paysheets, invoices, ledger, expenses, compliance) are exported as CSV inside a single zip.
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
              <TableHead>Size (KB)</TableHead><TableHead>Tables</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {logs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-app-muted">No backups yet</TableCell></TableRow>}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.backup_date)}</TableCell>
                  <TableCell>{l.backup_type}</TableCell>
                  <TableCell>
                    <Badge className={l.status === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {l.status}
                    </Badge>
                    {l.error_message && <div className="text-xs text-red-600 mt-1">{l.error_message}</div>}
                  </TableCell>
                  <TableCell className="tabular-nums">{l.file_size_kb}</TableCell>
                  <TableCell className="text-xs">{(l.tables_included ?? []).length} tables</TableCell>
                  <TableCell>
                    {l.file_path && (
                      <Button size="sm" variant="outline" onClick={() => download(l.file_path!)}>
                        <Download className="h-4 w-4 mr-1" /> Download
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
