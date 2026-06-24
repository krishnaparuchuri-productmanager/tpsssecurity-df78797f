import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { UserPlus, Loader2 } from "lucide-react";

interface Row { id: string; full_name: string; email: string; is_active: boolean; is_removed: boolean; phone: string | null; last_login: string | null; role: AppRole | null; }

const ROLE_LABELS: Record<AppRole, string> = {
  ceo_admin: "CEO",
  coo_ops: "COO / Operations",
  accountant: "Accountant",
};

export default function UsersAdmin() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole | "">("");
  const [newPhone, setNewPhone] = useState("");

  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: Row; newRole: AppRole } | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const [editUser, setEditUser] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [pendingRemove, setPendingRemove] = useState<Row | null>(null);
  const [savingRemove, setSavingRemove] = useState(false);

  async function load() {
    setRows(null);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("user_profiles").select("id, full_name, email, is_active, is_removed, phone, last_login").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const map = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
    setRows(((profiles ?? []) as Array<{ id: string; full_name: string; email: string; is_active: boolean; is_removed: boolean; phone: string | null; last_login: string | null }>).map((p) => ({ ...p, role: map.get(p.id) ?? null })));
  }
  useEffect(() => { load(); }, []);

  async function confirmRoleChange() {
    if (!pendingRoleChange) return;
    const { user: target, newRole } = pendingRoleChange;
    setSavingRole(true);
    try {
      await supabase.from("user_roles").delete().eq("user_id", target.id);
      const { error } = await supabase.from("user_roles").insert({ user_id: target.id, role: newRole });
      if (error) throw error;
      const { data: { user: actor } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: actor?.id, action: "ROLE_CHANGE", table_name: "user_roles", record_id: target.id,
        old_values: { role: target.role }, new_values: { role: newRole },
      });
      toast.success("Role updated");
      setPendingRoleChange(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingRole(false);
    }
  }

  async function toggleActive(userId: string, active: boolean) {
    const { error } = await supabase.from("user_profiles").update({ is_active: !active }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(!active ? "User activated" : "User deactivated");
    load();
  }

  function openEdit(r: Row) {
    setEditUser(r);
    setEditName(r.full_name);
    setEditPhone(r.phone ?? "");
  }

  async function saveEdit() {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from("user_profiles")
        .update({ full_name: editName.trim(), phone: editPhone.trim() || null })
        .eq("id", editUser.id);
      if (error) throw error;
      const { data: { user: actor } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: actor?.id, action: "UPDATE", table_name: "user_profiles", record_id: editUser.id,
        old_values: { full_name: editUser.full_name, phone: editUser.phone },
        new_values: { full_name: editName.trim(), phone: editPhone.trim() || null },
      });
      toast.success("User updated");
      setEditUser(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setSavingRemove(true);
    try {
      const removing = !pendingRemove.is_removed;
      const { error } = await supabase.from("user_profiles")
        .update({ is_removed: removing, is_active: removing ? false : pendingRemove.is_active })
        .eq("id", pendingRemove.id);
      if (error) throw error;
      const { data: { user: actor } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: actor?.id, action: removing ? "REMOVE" : "RESTORE", table_name: "user_profiles", record_id: pendingRemove.id,
        old_values: { is_removed: pendingRemove.is_removed }, new_values: { is_removed: removing },
      });
      toast.success(removing ? "User removed" : "User restored");
      setPendingRemove(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingRemove(false);
    }
  }

  async function createUser() {
    if (!newName.trim() || !newEmail.trim() || !newRole) {
      toast.error("Name, email, and role are required");
      return;
    }
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { full_name: newName.trim(), email: newEmail.trim(), role: newRole, phone: newPhone.trim() || undefined },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Invite sent to ${newEmail.trim()}`);
      setAddOpen(false);
      setNewName(""); setNewEmail(""); setNewRole(""); setNewPhone("");
      load();
    } catch (e) {
      toast.error((e as Error).message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      if (search && !`${r.full_name} ${r.email}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (statusFilter === "removed" && !r.is_removed) return false;
      if (statusFilter === "active" && (!r.is_active || r.is_removed)) return false;
      if (statusFilter === "inactive" && (r.is_active || r.is_removed)) return false;
      return true;
    });
  }, [rows, search, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app-navy">User Management</h1>
          <p className="text-sm text-app-muted">Invite new users and manage roles and access.</p>
        </div>
        <Button className="bg-app-navy hover:bg-app-navy/90" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-app-border text-app-muted">
            <th className="py-2 px-3">Name</th><th className="py-2 px-3">Email</th>
            <th className="py-2 px-3">Role</th><th className="py-2 px-3">Status</th>
            <th className="py-2 px-3">Last Login</th><th className="py-2 px-3">Actions</th>
          </tr></thead>
          <tbody>
            {filtered === null ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No users found</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-app-border/60">
                <td className="py-2 px-3 font-medium">{r.full_name || "—"}</td>
                <td className="py-2 px-3">{r.email}</td>
                <td className="py-2 px-3">
                  <Select value={r.role ?? ""} onValueChange={(v) => setPendingRoleChange({ user: r, newRole: v as AppRole })} disabled={r.id === me?.id || r.is_removed}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Assign role" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as AppRole[]).map((r2) => <SelectItem key={r2} value={r2}>{ROLE_LABELS[r2]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-2 px-3">
                  {r.is_removed ? <Badge variant="destructive">Removed</Badge>
                    : r.is_active ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                    : <Badge variant="secondary">Inactive</Badge>}
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground">{r.last_login ? new Date(r.last_login).toLocaleString() : "—"}</td>
                <td className="py-2 px-3 space-x-2 whitespace-nowrap">
                  <button className="text-xs text-app-saffron hover:underline disabled:opacity-50" disabled={r.is_removed}
                    onClick={() => openEdit(r)}>
                    Edit
                  </button>
                  <button className="text-xs text-app-saffron hover:underline disabled:opacity-50" disabled={r.id === me?.id || r.is_removed}
                    onClick={() => toggleActive(r.id, r.is_active)}>
                    {r.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button className="text-xs text-destructive hover:underline disabled:opacity-50" disabled={r.id === me?.id}
                    onClick={() => setPendingRemove(r)}>
                    {r.is_removed ? "Restore" : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name *</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div><Label>Email *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div>
              <Label>Role *</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Phone (optional)</Label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">An invite email will be sent to set their password. Their role is assigned immediately.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={createUser} disabled={creating} className="bg-app-navy hover:bg-app-navy/90">
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingRoleChange} onOpenChange={(open) => !open && setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange && (
                <>Change <strong>{pendingRoleChange.user.full_name || pendingRoleChange.user.email}</strong>'s role
                  from <strong>{pendingRoleChange.user.role ? ROLE_LABELS[pendingRoleChange.user.role] : "no role"}</strong> to{" "}
                  <strong>{ROLE_LABELS[pendingRoleChange.newRole]}</strong>? This takes effect immediately.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingRole}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange} disabled={savingRole}>
              {savingRole ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={editUser?.email ?? ""} disabled /><p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={savingEdit}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="bg-app-navy hover:bg-app-navy/90">
              {savingEdit && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingRemove?.is_removed ? "Restore user?" : "Remove user?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove?.is_removed
                ? <>Restore <strong>{pendingRemove.full_name || pendingRemove.email}</strong>? They will need to be reactivated separately to regain access.</>
                : <>Remove <strong>{pendingRemove?.full_name || pendingRemove?.email}</strong>? This is a soft delete — all their historical records (paysheets, approvals, audit trail) are kept intact, but they will be deactivated and hidden from normal use.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingRemove}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={savingRemove} className="bg-destructive hover:bg-destructive/90">
              {savingRemove ? "Saving…" : pendingRemove?.is_removed ? "Restore" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
