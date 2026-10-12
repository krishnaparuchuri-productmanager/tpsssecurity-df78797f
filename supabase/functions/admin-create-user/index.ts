// Admin-only: creates a new portal user via Supabase Admin Auth API and
// assigns their role. Only callable by an authenticated super_admin.
//
// Auth: relies on platform JWT verification (verify_jwt=true) plus an
// explicit super_admin + is_active check against user_roles/user_profiles
// using the service role client (never trusts the client-supplied role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["super_admin", "ceo_admin", "coo_ops", "accountant"];

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const [{ data: callerRole }, { data: callerProfile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle(),
      admin.from("user_profiles").select("is_active").eq("id", caller.id).maybeSingle(),
    ]);
    if (callerRole?.role !== "super_admin" || !callerProfile?.is_active) {
      return json({ error: "Only an active Super Admin can create users" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const full_name = (body.full_name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const role = body.role;
    const phone = (body.phone ?? "").trim() || null;

    if (!full_name || !email || !role) {
      return json({ error: "full_name, email, and role are required" }, 400);
    }
    if (!VALID_ROLES.includes(role)) {
      return json({ error: "Invalid role" }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    const newUserId = created.user.id;

    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newUserId, role });
    if (roleErr) {
      return json({ error: `User invited but role assignment failed: ${roleErr.message}` }, 500);
    }

    if (phone) {
      await admin.from("user_profiles").update({ phone }).eq("id", newUserId);
    }

    await admin.from("audit_logs").insert({
      user_id: caller.id,
      action: "CREATE",
      table_name: "auth.users",
      record_id: newUserId,
      new_values: { email, full_name, role },
    });

    return json({ ok: true, user_id: newUserId }, 200);
  } catch (e) {
    console.error("admin-create-user failed:", (e as Error).message);
    return json({ error: "Internal error" }, 500);
  }
});
