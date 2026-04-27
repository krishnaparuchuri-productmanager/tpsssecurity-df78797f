import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface Row {
  id: string;
  employee_code: string;
  full_name: string;
  designation: string;
  uan_number: string | null;
  esi_number: string | null;
  status: string;
  client_id: string | null;
  client?: { client_name: string } | null;
}

interface ClientLite { id: string; client_name: string; }

export default function EmployeesList() {
  const { can } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Active");

  async function load() {
    setRows(null);
    let q = supabase.from("employees").select("id, employee_code, full_name, designation, uan_number, esi_number, status, client_id, client:clients(client_name)").order("employee_code");
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (clientFilter !== "all") q = q.eq("client_id", clientFilter);
    if (designationFilter !== "all") q = q.eq("designation", designationFilter);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setRows([]); return; }
    setRows((data ?? []) as unknown as Row[]);
  }

  useEffect(() => {
    supabase.from("clients").select("id, client_name").eq("is_active", true).order("client_name").then(({ data }) => setClients((data ?? []) as ClientLite[]));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter, clientFilter, designationFilter]);

  const filtered = (rows ?? []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.full_name.toLowerCase().includes(s) || (r.uan_number ?? "").toLowerCase().includes(s);
  });

  function exportCsv() {
    if (!rows?.length) return;
    const header = ["Code", "Name", "Designation", "Client", "UAN", "ESI", "Status"];
    const lines = [header.join(",")].concat(
      rows.map((r) => [r.employee_code, `"${r.full_name}"`, r.designation, `"${r.client?.client_name ?? ""}"`, r.uan_number ?? "", r.esi_number ?? "", r.status].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "employees.csv"; a.click();
    logAudit({ action: "EXPORT", table: "employees" });
  }

  const designations = Array.from(new Set((rows ?? []).map((r) => r.designation))).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-app-navy">Employees</h1>
          <p className="text-sm text-app-muted">Master records of all field staff</p>
        </div>
        <div className="flex gap-2">
          {can("employees", "can_export") && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export</Button>}
          {can("employees", "can_create") && (
            <Button asChild className="bg-app-navy hover:bg-app-navy/90 text-white">
              <Link to="/app/masters/employees/new"><Plus className="h-4 w-4 mr-2" /> Add Employee</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-app-border rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or UAN…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={designationFilter} onValueChange={setDesignationFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Designation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Designations</SelectItem>
              {designations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Relieved">Relieved</SelectItem>
              <SelectItem value="Absconded">Absconded</SelectItem>
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
                <th className="py-2 px-2">Designation</th>
                <th className="py-2 px-2">Client</th>
                <th className="py-2 px-2">UAN</th>
                <th className="py-2 px-2">ESI</th>
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
                  No employees found. {can("employees", "can_create") && <Link className="text-app-saffron underline" to="/app/masters/employees/new">Add your first employee</Link>}
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-app-border/60 hover:bg-app-surface">
                    <td className="py-2 px-2 font-mono text-xs">{r.employee_code}</td>
                    <td className="py-2 px-2 font-medium">{r.full_name}</td>
                    <td className="py-2 px-2">{r.designation}</td>
                    <td className="py-2 px-2">{r.client?.client_name ?? "—"}</td>
                    <td className="py-2 px-2 font-mono text-xs">{r.uan_number ?? "—"}</td>
                    <td className="py-2 px-2 font-mono text-xs">{r.esi_number ?? "—"}</td>
                    <td className="py-2 px-2">
                      {r.status === "Active"
                        ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                        : <Badge variant="secondary">{r.status}</Badge>}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {can("employees", "can_edit") && (
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/app/masters/employees/${r.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                        </Button>
                      )}
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
