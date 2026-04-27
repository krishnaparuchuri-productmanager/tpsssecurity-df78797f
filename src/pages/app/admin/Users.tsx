import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface Row { id: string; full_name: string; email: string; is_active: boolean; last_login: string | null; role: AppRole | null; }

export default function UsersAdmin() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  async function load() {
    setRows(null);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("user_profiles").select("id, full_name, email, is_active, last_login").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const map = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
    setRows(((profiles ?? []) as Array<{ id: string; full_name: string; email: string; is_active: boolean; last_login: string | null }>).map((p) => ({ ...p, role: map.get(p.id) ?? null })));
  }
  useEffect(() => { load(); }, []);

  async function setRole(userId: string, role: AppRole) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    load();
  }

  async function toggleActive(userId: string, active: boolean) {
    const { error } = await supabase.from("user_profiles").update({ is_active: !active }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(!active ? "User activated" : "User deactivated");
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">User Management</h1>
        <p className="text-sm text-app-muted">
          To create a new user: open <strong>Cloud → Users → Add User</strong>, then assign their role here.
        </p>
      </div>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-app-border text-app-muted">
            <th className="py-2 px-3">Name</th><th className="py-2 px-3">Email</th>
            <th className="py-2 px-3">Role</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Actions</th>
          </tr></thead>
          <tbody>
            {rows === null ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
            )) : rows.length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No users yet</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-app-border/60">
                <td className="py-2 px-3 font-medium">{r.full_name || "—"}</td>
                <td className="py-2 px-3">{r.email}</td>
                <td className="py-2 px-3">
                  <Select value={r.role ?? ""} onValueChange={(v) => setRole(r.id, v as AppRole)} disabled={r.id === me?.id}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assign role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ceo_admin">CEO / Admin</SelectItem>
                      <SelectItem value="coo_ops">COO / Operations</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-2 px-3">
                  {r.is_active ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                </td>
                <td className="py-2 px-3">
                  <button className="text-xs text-app-saffron hover:underline disabled:opacity-50" disabled={r.id === me?.id}
                    onClick={() => toggleActive(r.id, r.is_active)}>
                    {r.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
