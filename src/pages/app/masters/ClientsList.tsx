import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Power, Download } from "lucide-react";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ClientRow {
  id: string;
  client_code: string;
  client_name: string;
  service_type: string;
  contract_value: number | null;
  tds_percentage: number;
  gst_applicable: boolean;
  is_active: boolean;
}

export default function ClientsList() {
  const { can, role } = useAuth();
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  async function load() {
    setRows(null);
    let q = supabase.from("clients").select("id, client_code, client_name, service_type, contract_value, tds_percentage, gst_applicable, is_active").order("client_code");
    if (statusFilter === "active") q = q.eq("is_active", true);
    if (statusFilter === "inactive") q = q.eq("is_active", false);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setRows([]); return; }
    setRows((data ?? []) as ClientRow[]);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const filtered = (rows ?? []).filter((r) => {
    if (serviceFilter !== "all" && r.service_type !== serviceFilter) return false;
    if (search && !r.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function deactivate(id: string, current: boolean) {
    const { error } = await supabase.from("clients").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "UPDATE", table: "clients", recordId: id, newValues: { is_active: !current } });
    toast.success(!current ? "Client activated" : "Client deactivated");
    load();
  }

  function exportCsv() {
    if (!rows || rows.length === 0) return;
    const header = ["Client Code", "Name", "Service Type", "Contract Value", "TDS %", "GST", "Status"];
    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [r.client_code, `"${r.client_name}"`, r.service_type, r.contract_value ?? 0, r.tds_percentage, r.gst_applicable ? "Yes" : "No", r.is_active ? "Active" : "Inactive"].join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "clients.csv"; a.click(); URL.revokeObjectURL(url);
    logAudit({ action: "EXPORT", table: "clients" });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-app-navy">Clients</h1>
          <p className="text-sm text-app-muted">Manage client master records & minimum-wage rates</p>
        </div>
        <div className="flex gap-2">
          {can("clients", "can_export") && (
            <Button variant="outline" onClick={exportCsv} disabled={!rows?.length}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          )}
          {can("clients", "can_create") && (
            <Button asChild className="bg-app-navy hover:bg-app-navy/90 text-white">
              <Link to="/app/masters/clients/new"><Plus className="h-4 w-4 mr-2" /> Add Client</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="Security">Security</SelectItem>
              <SelectItem value="Housekeeping">Housekeeping</SelectItem>
              <SelectItem value="Both">Both</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-app-border text-app-muted">
                <th className="py-2 px-2">Code</th>
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Service</th>
                <th className="py-2 px-2 text-right">Contract</th>
                <th className="py-2 px-2 text-right">TDS%</th>
                <th className="py-2 px-2">GST</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="py-2"><Skeleton className="h-8 w-full" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">
                  No clients found. {can("clients", "can_create") && <Link className="text-app-saffron underline" to="/app/masters/clients/new">Add your first client</Link>}
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-app-border/60 hover:bg-app-surface">
                    <td className="py-2 px-2 font-mono text-xs">{r.client_code}</td>
                    <td className="py-2 px-2 font-medium">{r.client_name}</td>
                    <td className="py-2 px-2">{r.service_type}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatINR(r.contract_value ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.tds_percentage}%</td>
                    <td className="py-2 px-2">{r.gst_applicable ? <Badge variant="secondary">Yes</Badge> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 px-2">
                      {r.is_active
                        ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                        : <Badge variant="secondary">Inactive</Badge>}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex justify-end gap-1">
                        {can("clients", "can_edit") && (
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/app/masters/clients/${r.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                        )}
                        {role === "ceo_admin" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost"><Power className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{r.is_active ? "Deactivate" : "Activate"} client?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {r.is_active
                                    ? "This will hide the client from active lists. No data is deleted."
                                    : "This will restore the client to the active list."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deactivate(r.id, r.is_active)}>Confirm</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
