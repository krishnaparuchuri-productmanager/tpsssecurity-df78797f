import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { activity } from "@/lib/activity";

interface Branch {
  id: string;
  branch_code: string;
  branch_name: string;
  branch_address: string | null;
  is_head_office: boolean;
  is_active: boolean;
  is_deleted: boolean;
}

export default function BranchesAdmin() {
  const [rows, setRows] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ branch_name: "", branch_code: "", branch_address: "", is_head_office: false, is_active: true });

  async function load() {
    const { data } = await supabase.from("branches").select("*").eq("is_deleted", false).order("branch_name");
    setRows((data ?? []) as Branch[]);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ branch_name: "", branch_code: "", branch_address: "", is_head_office: false, is_active: true });
    setOpen(true);
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      branch_name: b.branch_name,
      branch_code: b.branch_code,
      branch_address: b.branch_address ?? "",
      is_head_office: b.is_head_office,
      is_active: b.is_active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.branch_name.trim() || !form.branch_code.trim()) {
      toast.error("Name and code are required"); return;
    }
    const code = form.branch_code.trim().toUpperCase().slice(0, 5);

    // If marking head office, unset existing head office (single-instance enforcement)
    if (form.is_head_office) {
      const { data: existing } = await supabase
        .from("branches").select("id").eq("is_head_office", true).eq("is_deleted", false);
      const others = (existing ?? []).filter((r: { id: string }) => r.id !== editing?.id);
      if (others.length > 0) {
        await supabase.from("branches").update({ is_head_office: false }).in("id", others.map((r: { id: string }) => r.id));
      }
    }

    const payload = {
      branch_name: form.branch_name.trim(),
      branch_code: code,
      branch_address: form.branch_address.trim() || null,
      is_head_office: form.is_head_office,
      is_active: form.is_active,
    };

    if (editing) {
      const { error } = await supabase.from("branches").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      activity.update("branches", editing.id);
      toast.success("Branch updated");
    } else {
      const { data, error } = await supabase.from("branches").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      if (data) activity.create("branches", data.id);
      toast.success("Branch added");
    }
    setOpen(false);
    load();
  }

  async function softDelete(b: Branch) {
    // Block delete when linked clients/employees exist
    const [{ count: cCount }, { count: eCount }] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("branch_id", b.id).eq("is_deleted", false),
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("branch_id", b.id).eq("is_deleted", false),
    ]);
    if ((cCount ?? 0) > 0 || (eCount ?? 0) > 0) {
      toast.error(`Cannot delete: ${cCount ?? 0} clients and ${eCount ?? 0} employees are linked.`);
      return;
    }
    if (!confirm(`Delete branch "${b.branch_name}"?`)) return;
    const { error } = await supabase.from("branches").update({ is_deleted: true, is_active: false }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    activity.delete("branches", b.id);
    toast.success("Branch deleted"); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Branches Management</h1>
        <Button onClick={openNew} className="bg-app-navy"><Plus className="h-4 w-4 mr-1" /> Add Branch</Button>
      </div>

      <Card><CardHeader><CardTitle className="text-base">All Branches</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-app-surface text-left">
              <tr>
                <th className="p-2">Code</th>
                <th className="p-2">Name</th>
                <th className="p-2">Address</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 font-mono">{r.branch_code}</td>
                  <td className="p-2">{r.branch_name}</td>
                  <td className="p-2">{r.branch_address ?? "—"}</td>
                  <td className="p-2">{r.is_head_office ? <Badge>Head Office</Badge> : <Badge variant="outline">Branch</Badge>}</td>
                  <td className="p-2">{r.is_active ? <Badge variant="outline" className="text-green-700 border-green-300">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</td>
                  <td className="p-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => softDelete(r)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-app-muted">No branches yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Branch Name</Label><Input value={form.branch_name} onChange={e => setForm({ ...form, branch_name: e.target.value })} /></div>
            <div><Label>Branch Code (max 5, uppercase)</Label><Input value={form.branch_code} maxLength={5} onChange={e => setForm({ ...form, branch_code: e.target.value.toUpperCase() })} /></div>
            <div><Label>Address</Label><Input value={form.branch_address} onChange={e => setForm({ ...form, branch_address: e.target.value })} /></div>
            <div className="flex items-center justify-between">
              <Label>Head Office</Label>
              <Switch checked={form.is_head_office} onCheckedChange={(v) => setForm({ ...form, is_head_office: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-app-navy">{editing ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
