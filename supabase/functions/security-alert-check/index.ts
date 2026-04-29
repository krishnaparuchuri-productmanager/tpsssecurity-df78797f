// Daily security sweep: scan failed logins in last 1h. If any user has > 5,
// insert a SECURITY_ALERT row in audit_logs so the CEO dashboard widget can surface it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: failures, error } = await supabase
      .from("user_activity_log")
      .select("user_id, ip_address, created_at")
      .eq("activity_type", "login_failed")
      .gte("created_at", sinceIso);

    if (error) throw error;

    const counts = new Map<string, { count: number; ip: string | null }>();
    for (const r of failures ?? []) {
      const key = r.user_id ?? "unknown";
      const cur = counts.get(key) ?? { count: 0, ip: r.ip_address };
      cur.count += 1;
      counts.set(key, cur);
    }

    const alerts: Array<{ user_id: string; count: number; ip: string | null }> = [];
    for (const [user_id, info] of counts) {
      if (info.count > 5) alerts.push({ user_id, count: info.count, ip: info.ip });
    }

    for (const a of alerts) {
      await supabase.from("audit_logs").insert({
        user_id: null,
        action: "SECURITY_ALERT",
        table_name: "user_activity_log",
        new_values: { reason: "excessive_failed_logins", subject_user_id: a.user_id, count: a.count, ip: a.ip, window: "1h" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, scanned: failures?.length ?? 0, alerts: alerts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
