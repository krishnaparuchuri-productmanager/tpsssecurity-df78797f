import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { Plus } from "lucide-react";

interface Site { id: string; post_name: string; unit_name: string | null; is_active: boolean; }

/**
 * Sites / posts of a client (table client_posts). Saved immediately, separate
 * from the client form's Save. Sites are deactivated, not deleted: deployments
 * keep pointing at them, and a browser soft delete is blocked by RLS.
 */
export function ClientSites({ clientId }: { clientId: string }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.from("client_posts")
      .select("id, post_name, unit_name, is_active")
      .eq("client_id", clientId).eq("is_deleted", false)
      .order("post_name");
    if (error) { toast.error(error.message); return; }
    setSites((data ?? []) as Site[]);
  }
  useEffect(() => { load(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!name.trim()) { toast.error("Site name is required"); return; }
    if (sites.some((s) => s.post_name.trim().toUpperCase() === name.trim().toUpperCase())) {
      toast.error("A site with this name already exists for this client"); return;
    }
    setBusy(true);
    const { data, error } = await supabase.from("client_posts")
      .insert({ client_id: clientId, post_name: name.trim(), unit_name: unit.trim() || null })
      .select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "CREATE", table: "client_posts", recordId: data.id, newValues: { post_name: name.trim(), unit_name: unit.trim() || null } });
    setName(""); setUnit("");
    toast.success("Site added");
    load();
  }

  async function setActive(s: Site, active: boolean) {
    const { error } = await supabase.from("client_posts")
      .update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "UPDATE", table: "client_posts", recordId: s.id, newValues: { is_active: active } });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Site / post name * (e.g. Main Gate)" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit / location (optional)" />
        </div>
        <Button variant="outline" size="sm" onClick={add} disabled={busy}><Plus className="h-4 w-4 mr-1" /> Add Site</Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-app-muted">
            <th className="py-1 pr-2">Site / Post</th>
            <th className="py-1 pr-2">Unit / Location</th>
            <th className="py-1 pr-2">Active</th>
          </tr>
        </thead>
        <tbody>
          {sites.length === 0 && (
            <tr><td colSpan={3} className="py-2 text-app-muted">No sites yet. Add the client's sites so deployments can name the post.</td></tr>
          )}
          {sites.map((s) => (
            <tr key={s.id} className="border-t border-app-border">
              <td className="py-1 pr-2">{s.post_name}</td>
              <td className="py-1 pr-2">{s.unit_name ?? "—"}</td>
              <td className="py-1 pr-2"><Switch checked={s.is_active} onCheckedChange={(v) => setActive(s, v)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
