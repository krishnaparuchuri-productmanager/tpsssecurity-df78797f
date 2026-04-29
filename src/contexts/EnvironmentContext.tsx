import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppEnvironment = "sandbox" | "production";

interface EnvCtx {
  environment: AppEnvironment;
  isSandbox: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  setEnvironment: (env: AppEnvironment) => Promise<{ error: string | null }>;
}

const Ctx = createContext<EnvCtx | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environment, setEnv] = useState<AppEnvironment>("sandbox");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "environment")
      .maybeSingle();
    if (data?.value === "production" || data?.value === "sandbox") {
      setEnv(data.value as AppEnvironment);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // realtime
    const ch = supabase
      .channel("app_config-env")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_config", filter: "key=eq.environment" },
        (payload) => {
          const v = (payload.new as { value?: string })?.value;
          if (v === "production" || v === "sandbox") setEnv(v as AppEnvironment);
        }
      )
      .subscribe();
    // periodic refresh every 5 min
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(id);
    };
  }, [refresh]);

  async function setEnvironment(env: AppEnvironment) {
    const { data: cfg } = await supabase
      .from("app_config")
      .select("id")
      .eq("key", "environment")
      .maybeSingle();
    const { data: { user } } = await supabase.auth.getUser();
    if (!cfg) return { error: "Config row missing" };
    const { error } = await supabase
      .from("app_config")
      .update({ value: env, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("id", cfg.id);
    if (error) return { error: error.message };
    setEnv(env);
    return { error: null };
  }

  return (
    <Ctx.Provider value={{ environment, isSandbox: environment === "sandbox", loading, refresh, setEnvironment }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEnvironment() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEnvironment must be used within EnvironmentProvider");
  return v;
}
