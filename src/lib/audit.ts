import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "LOGIN"
  | "EXPORT";

export async function logAudit(args: {
  action: AuditAction;
  table?: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: args.action,
    table_name: args.table ?? null,
    record_id: args.recordId ?? null,
    old_values: args.oldValues ?? null,
    new_values: args.newValues ?? null,
    ip_address: null,
  });
}
