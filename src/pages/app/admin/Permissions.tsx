import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type Action = "can_view" | "can_create" | "can_edit" | "can_delete" | "can_approve" | "can_export";
const ACTIONS: Action[] = ["can_view", "can_create", "can_edit", "can_delete", "can_approve", "can_export"];
const LABELS: Record<Action, string> = {
  can_view: "View", can_create: "Create", can_edit: "Edit", can_delete: "Delete", can_approve: "Approve", can_export: "Export",
};

interface Perm { id: string; role: string; screen_name: string; [k: string]: unknown; }

export default function Permissions() {
  const [rows, setRows] = useState<Perm[] | null>(null);
  useEffect(() => {
    supabase.from("role_permissions").select("*").order("role").order("screen_name").then(({ data }) => setRows((data ?? []) as Perm[]));
  }, []);

  async function update(id: string, action: Action, value: boolean) {
    const patch: Record<string, boolean> = { [action]: value };
    const { error } = await supabase.from("role_permissions").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((cur) => (cur ?? []).map((r) => r.id === id ? { ...r, [action]: value } : r));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-app-navy">Role Permissions</h1>
        <p className="text-sm text-app-muted">Toggle what each role can do on each screen.</p>
      </div>
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-app-border text-app-muted">
            <th className="py-2 px-3">Role</th><th className="py-2 px-3">Screen</th>
            {ACTIONS.map((a) => <th key={a} className="py-2 px-3 text-center">{LABELS[a]}</th>)}
          </tr></thead>
          <tbody>
            {rows === null ? <tr><td colSpan={8} className="p-3"><Skeleton className="h-32 w-full" /></td></tr>
              : rows.map((r) => (
                <tr key={r.id} className="border-b border-app-border/60">
                  <td className="py-2 px-3 font-mono text-xs">{r.role}</td>
                  <td className="py-2 px-3">{r.screen_name}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="py-2 px-3 text-center">
                      <Checkbox checked={!!r[a]} onCheckedChange={(v) => update(r.id, a, !!v)} />
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
