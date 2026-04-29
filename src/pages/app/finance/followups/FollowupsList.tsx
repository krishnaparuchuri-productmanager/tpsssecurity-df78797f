import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { formatINR, formatDate } from "@/lib/format";
import FollowupDialog from "./FollowupDialog";

interface Row {
  id: string; followup_date: string; status: string; contact_mode: string | null;
  response: string | null; promise_date: string | null; next_followup_date: string | null;
  invoice_id: string; client_id: string;
  invoices: { invoice_number: string; due_date: string | null; outstanding_amount: number } | null;
  clients: { client_name: string } | null;
}

const STATUSES = ["open", "in_progress", "promised", "closed"];
const STATUS_COLOR: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-blue-100 text-blue-700",
  promised: "bg-yellow-100 text-yellow-800",
  closed: "bg-green-100 text-green-700",
};

export default function FollowupsList() {
  const { isSandbox } = useEnvironment();
  const [statusFilter, setStatusFilter] = useState("open");
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let q = supabase.from("invoice_followups")
      .select("id, followup_date, status, contact_mode, response, promise_date, next_followup_date, invoice_id, client_id, invoices(invoice_number, due_date, outstanding_amount), clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("followup_date", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    q.then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [statusFilter, isSandbox, refresh]);

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, promised: 0, closed: 0 } as Record<string, number>;
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  async function autoSweep() {
    const { error } = await supabase.rpc("auto_open_followups");
    if (error) return toast.error(error.message);
    toast.success("Followups updated");
    setRefresh((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Invoice Followups</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={autoSweep}><RefreshCcw className="h-4 w-4 mr-1" /> Auto-sweep overdue</Button>
          <Button className="bg-app-navy text-white" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Log Followup
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[160px]">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex gap-3 text-sm">
              <span>Open: <b className="text-red-700">{counts.open ?? 0}</b></span>
              <span>In Progress: <b className="text-blue-700">{counts.in_progress ?? 0}</b></span>
              <span>Promised: <b className="text-yellow-700">{counts.promised ?? 0}</b></span>
              <span>Closed: <b className="text-green-700">{counts.closed ?? 0}</b></span>
            </div>
          </div>

          <Table>
            <TableHeader><TableRow>
              <TableHead>Followup Date</TableHead><TableHead>Invoice</TableHead><TableHead>Client</TableHead>
              <TableHead className="text-right">Outstanding</TableHead><TableHead>Mode</TableHead>
              <TableHead>Response</TableHead><TableHead>Promise Date</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-app-muted">No followups</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.followup_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoices?.invoice_number ?? "—"}</TableCell>
                  <TableCell>{r.clients?.client_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(r.invoices?.outstanding_amount ?? 0))}</TableCell>
                  <TableCell>{r.contact_mode ?? "—"}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{r.response ?? "—"}</TableCell>
                  <TableCell>{r.promise_date ? formatDate(r.promise_date) : "—"}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Update</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {open && (
        <FollowupDialog
          followup={editing}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); setRefresh((k) => k + 1); }}
        />
      )}
    </div>
  );
}
