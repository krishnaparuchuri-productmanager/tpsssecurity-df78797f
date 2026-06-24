import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { X, ChevronDown } from "lucide-react";

type Action = "can_view" | "can_create" | "can_edit" | "can_delete" | "can_approve" | "can_export";
const ACTIONS: Action[] = ["can_view", "can_create", "can_edit", "can_delete", "can_approve", "can_export"];
const LABELS: Record<Action, string> = {
  can_view: "View", can_create: "Create", can_edit: "Edit", can_delete: "Delete", can_approve: "Approve", can_export: "Export",
};

const ROLE_LABELS: Record<string, string> = {
  ceo_admin: "CEO / Admin", coo_ops: "COO / Operations", accountant: "Accountant",
};

// UI-layer grouping only — no DB schema change. Unmapped screens fall into "Other".
const MODULE_MAP: Record<string, string> = {
  activity_log: "Administration", audit_logs: "Administration", branch_summary: "Administration",
  branches_admin: "Administration", company_profile: "Administration", users: "Administration", permissions: "Administration",
  clients: "Client & Employee", employees: "Client & Employee",
  payroll: "Payroll", payslips: "Payroll", salary_register: "Payroll", bank_payment: "Payroll",
  uniform_advance: "Payroll", canteen_deductions: "Payroll",
  expenses: "Finance", compliance: "Finance",
  reports: "Reports", reports_annual: "Reports", reports_client_history: "Reports", reports_comparative: "Reports",
  reports_employee_history: "Reports", reports_mom: "Reports", pf_statement: "Reports", esi_statement: "Reports",
  pt_report: "Reports", full_and_final_settlement: "Reports",
  dashboard: "Settings",
};
const MODULE_ORDER = ["Administration", "Client & Employee", "Payroll", "Finance", "Reports", "Settings", "Other"];
function moduleOf(screen: string) { return MODULE_MAP[screen] ?? "Other"; }

interface Perm { id: string; role: string; screen_name: string; [k: string]: unknown; }
interface UserRow { id: string; full_name: string; email: string; role: string | null; }

export default function Permissions() {
  const [rows, setRows] = useState<Perm[] | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState("");

  useEffect(() => {
    supabase.from("role_permissions").select("*").order("role").order("screen_name").then(({ data }) => setRows((data ?? []) as Perm[]));
    (async () => {
      const [{ data: profiles }, { data: roleRows }] = await Promise.all([
        supabase.from("user_profiles").select("id, full_name, email").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const map = new Map((roleRows ?? []).map((r) => [r.user_id, r.role as string]));
      setUsers(((profiles ?? []) as Array<{ id: string; full_name: string; email: string }>).map((p) => ({ ...p, role: map.get(p.id) ?? null })));
    })();
  }, []);

  async function update(id: string, action: Action, value: boolean) {
    const patch: Record<string, boolean> = { [action]: value };
    const { error } = await supabase.from("role_permissions").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((cur) => (cur ?? []).map((r) => r.id === id ? { ...r, [action]: value } : r));
  }

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (search && !r.screen_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, search, roleFilter]);

  const grouped = useMemo(() => {
    if (!filteredRows) return null;
    const map = new Map<string, Perm[]>();
    for (const r of filteredRows) {
      const mod = moduleOf(r.screen_name);
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(r);
    }
    return MODULE_ORDER.filter((m) => map.has(m)).map((m) => ({ module: m, rows: map.get(m)! }));
  }, [filteredRows]);

  function isModuleOpen(mod: string) { return openModules[mod] !== false; } // default expanded

  const selectedUserRow = users.find((u) => u.id === selectedUser);
  const byUserRows = useMemo(() => {
    if (!rows || !selectedUserRow?.role) return null;
    const map = new Map<string, Perm[]>();
    for (const r of rows.filter((r) => r.role === selectedUserRow.role)) {
      const mod = moduleOf(r.screen_name);
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(r);
    }
    return MODULE_ORDER.filter((m) => map.has(m)).map((m) => ({ module: m, rows: map.get(m)! }));
  }, [rows, selectedUserRow]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Role Permissions</h1>
        <p className="text-sm text-app-muted">Toggle what each role can do on each screen.</p>
      </div>

      <Tabs defaultValue="by-role">
        <TabsList>
          <TabsTrigger value="by-role">By Role</TabsTrigger>
          <TabsTrigger value="by-user">By User</TabsTrigger>
        </TabsList>

        <TabsContent value="by-role" className="space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative max-w-xs w-full">
              <Input placeholder="Search screen name…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearch("")}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Object.keys(ROLE_LABELS).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {grouped === null ? <Skeleton className="h-64 w-full" /> : grouped.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No matching rows</div>
          ) : grouped.map(({ module, rows: modRows }) => (
            <Collapsible key={module} open={isModuleOpen(module)} onOpenChange={(v) => setOpenModules((p) => ({ ...p, [module]: v }))}>
              <div className="bg-white border border-app-border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-2 bg-app-surface hover:bg-app-surface/80 text-left">
                  <span className="font-semibold text-app-navy">{module}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isModuleOpen(module) ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left border-b border-app-border text-app-muted">
                      <th className="py-2 px-3">Role</th><th className="py-2 px-3">Screen</th>
                      {ACTIONS.map((a) => <th key={a} className="py-2 px-3 text-center">{LABELS[a]}</th>)}
                    </tr></thead>
                    <tbody>
                      {modRows.map((r) => {
                        const zeroAccess = ACTIONS.every((a) => !r[a]);
                        return (
                          <tr key={r.id} className={`border-b border-app-border/60 ${zeroAccess ? "opacity-40 bg-muted/30" : ""}`}>
                            <td className="py-2 px-3 font-mono text-xs">{r.role}</td>
                            <td className="py-2 px-3">{r.screen_name}</td>
                            {ACTIONS.map((a) => (
                              <td key={a} className="py-2 px-3 text-center">
                                <Checkbox checked={!!r[a]} onCheckedChange={(v) => update(r.id, a, !!v)} />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </TabsContent>

        <TabsContent value="by-user" className="space-y-3">
          <div className="max-w-sm">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email} {u.role ? `(${ROLE_LABELS[u.role] ?? u.role})` : "(no role)"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!selectedUser ? (
            <div className="py-12 text-center text-muted-foreground">Select a user to view their access</div>
          ) : !selectedUserRow?.role ? (
            <div className="py-12 text-center text-muted-foreground">This user has no role assigned, so they have no access anywhere.</div>
          ) : byUserRows && byUserRows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No permissions configured for this role yet.</div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-app-muted">
                Read-only — to change this user's access, change their role in User Management or edit the role's permissions in the By Role tab.
              </p>
              {byUserRows?.map(({ module, rows: modRows }) => (
                <div key={module} className="bg-white border border-app-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-app-surface font-semibold text-app-navy">{module}</div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left border-b border-app-border text-app-muted">
                      <th className="py-2 px-3">Screen</th>
                      {ACTIONS.map((a) => <th key={a} className="py-2 px-3 text-center">{LABELS[a]}</th>)}
                    </tr></thead>
                    <tbody>
                      {modRows.map((r) => {
                        const zeroAccess = ACTIONS.every((a) => !r[a]);
                        return (
                          <tr key={r.id} className={`border-b border-app-border/60 ${zeroAccess ? "opacity-40 bg-muted/30" : ""}`}>
                            <td className="py-2 px-3">{r.screen_name}</td>
                            {ACTIONS.map((a) => (
                              <td key={a} className="py-2 px-3 text-center">
                                {r[a] ? <Checkbox checked disabled /> : <span className="text-muted-foreground">—</span>}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
