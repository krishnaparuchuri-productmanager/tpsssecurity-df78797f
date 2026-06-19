import { createContext, useContext, ReactNode } from "react";

export type AppEnvironment = "sandbox" | "production";

// Environment is determined by hostname — no DB toggle needed.
// sandbox.pages.dev  →  sandbox Supabase project  →  isSandbox = true
// portal.tpsssecurity.com / production URL         →  isSandbox = false
const SANDBOX_HOSTNAMES = [
  "tpss-security-sandbox.pages.dev",
  "localhost",
  "127.0.0.1",
];

function detectEnvironment(): AppEnvironment {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  return SANDBOX_HOSTNAMES.some((h) => host === h || host.endsWith(`.${h}`))
    ? "sandbox"
    : "production";
}

const ENVIRONMENT: AppEnvironment = detectEnvironment();

interface EnvCtx {
  environment: AppEnvironment;
  isSandbox: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  setEnvironment: (env: AppEnvironment) => Promise<{ error: string | null }>;
}

const Ctx = createContext<EnvCtx | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  return (
    <Ctx.Provider value={{
      environment: ENVIRONMENT,
      isSandbox: ENVIRONMENT === "sandbox",
      loading: false,
      refresh: async () => {},
      setEnvironment: async () => ({ error: "Environment is set by deployment URL and cannot be changed here." }),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEnvironment() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEnvironment must be used within EnvironmentProvider");
  return v;
}
