import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "LOGIN"
  | "EXPORT";

// Fields that must NEVER be stored in audit logs in plaintext.
// Aadhaar, bank, UAN, ESI, mobile etc. are sensitive PII under India's DPDPA.
const SENSITIVE_FIELDS = new Set([
  "aadhaar_number",
  "bank_account_number",
  "bank_ifsc",
  "bank_name",
  "uan_number",
  "esi_number",
  "mobile",
  "contact_phone",
  "contact_email",
  "pan_number",
  "gst_number",
  "cin_number",
  "password",
  "phone",
  "email",
]);

function maskValue(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  const s = String(val);
  if (s.length <= 4) return "****";
  return `****${s.slice(-4)}`;
}

/**
 * Strip / mask sensitive PII from an audit payload before persisting.
 * - Sensitive fields are replaced with a masked value (last 4 chars only)
 * - Non-sensitive fields pass through unchanged
 * - Nested objects/arrays are sanitized recursively
 */
export function sanitizeForAudit(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(sanitizeForAudit);
  if (typeof input !== "object") return input;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key)) {
      out[key] = maskValue(value);
    } else if (value && typeof value === "object") {
      out[key] = sanitizeForAudit(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function logAudit(args: {
  action: AuditAction;
  table?: string;
  recordId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: args.action,
    table_name: args.table ?? null,
    record_id: args.recordId ?? null,
    old_values: (sanitizeForAudit(args.oldValues) ?? null) as never,
    new_values: (sanitizeForAudit(args.newValues) ?? null) as never,
    ip_address: null,
  });
}
