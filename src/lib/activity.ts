import { supabase } from "@/integrations/supabase/client";

function deviceInfo(): string {
  if (typeof navigator === "undefined") return "unknown";
  return `${navigator.userAgent}`.slice(0, 240);
}

async function logRaw(type: string, details?: Record<string, unknown>, page_url?: string) {
  try {
    await supabase.rpc("log_activity", {
      _type: type,
      _page_url: page_url ?? (typeof window !== "undefined" ? window.location.pathname : null),
      _ip: null,
      _device: deviceInfo(),
      _details: (details ?? null) as never,
    });
  } catch {
    /* swallow — activity logging must never block UX */
  }
}

export const activity = {
  login: () => logRaw("login"),
  logout: () => logRaw("logout"),
  failedLogin: async (email: string) => {
    try {
      await supabase.rpc("log_failed_login", { _email: email, _ip: null, _device: deviceInfo() });
    } catch { /* ignore */ }
  },
  export: (filename: string, kind: "excel" | "pdf" | "csv" | "txt") =>
    logRaw("export", { filename, kind }),
  approve: (table: string, record_id: string, extra?: Record<string, unknown>) =>
    logRaw("approve", { table, record_id, ...(extra ?? {}) }),
  reject: (table: string, record_id: string, extra?: Record<string, unknown>) =>
    logRaw("reject", { table, record_id, ...(extra ?? {}) }),
  create: (table: string, record_id: string, extra?: Record<string, unknown>) =>
    logRaw("create", { table, record_id, ...(extra ?? {}) }),
  update: (table: string, record_id: string, extra?: Record<string, unknown>) =>
    logRaw("update", { table, record_id, ...(extra ?? {}) }),
};
