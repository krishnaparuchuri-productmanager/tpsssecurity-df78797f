// Monthly backup edge function — exports critical tables to CSV, zips,
// and uploads to private `backups` storage bucket. Triggered by pg_cron
// on the 1st of every month. Auth: x-cron-secret header OR service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const TABLES = [
  "clients",
  "client_contracts",
  "client_wage_config",
  "employees",
  "employee_advances",
  "advance_recovery_schedule",
  "employee_ffs",
  "invoices",
  "invoice_followups",
  "expenses",
  "expense_categories",
  "compliance_payments",
  "compliance_tasks",
  "financial_ledger",
];

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const startedAt = new Date();
  const monthLabel = startedAt.toISOString().slice(0, 7); // YYYY-MM
  const zip = new JSZip();
  const included: string[] = [];

  try {
    for (const t of TABLES) {
      // Fetch in chunks of 1000 to avoid the row cap.
      let offset = 0;
      const all: Record<string, unknown>[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from(t)
          .select("*")
          .range(offset, offset + 999);
        if (error) throw new Error(`${t}: ${error.message}`);
        if (!data || data.length === 0) break;
        all.push(...(data as Record<string, unknown>[]));
        if (data.length < 1000) break;
        offset += 1000;
      }
      zip.file(`${t}.csv`, toCSV(all));
      included.push(t);
    }

    const zipBlob = await zip.generateAsync({ type: "uint8array" });
    const filePath = `${monthLabel}/backup_${monthLabel}_${startedAt.getTime()}.zip`;

    const { error: upErr } = await supabase.storage
      .from("backups")
      .upload(filePath, zipBlob, {
        contentType: "application/zip",
        upsert: true,
      });
    if (upErr) throw upErr;

    await supabase.rpc("record_backup_log", {
      _payload: {
        backup_type: "monthly_auto",
        file_path: filePath,
        file_size_kb: Math.round(zipBlob.length / 1024),
        tables_included: included,
        status: "success",
      },
    });

    return new Response(
      JSON.stringify({ ok: true, file: filePath, sizeKb: Math.round(zipBlob.length / 1024) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    console.error("monthly-backup failed:", msg);
    await supabase.rpc("record_backup_log", {
      _payload: {
        backup_type: "monthly_auto",
        tables_included: included,
        status: "failed",
        error_message: msg,
      },
    });
    return new Response(JSON.stringify({ ok: false, error: "Backup failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
