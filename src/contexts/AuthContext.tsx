import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "ceo_admin" | "coo_ops" | "accountant";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface PermissionRow {
  screen_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  can_export: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  permissions: PermissionRow[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  can: (screen: string, action: keyof Omit<PermissionRow, "screen_name">) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUserData(uid: string) {
    const [{ data: prof }, { data: roleRow }] = await Promise.all([
      supabase.from("user_profiles").select("id, full_name, email, is_active").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile(prof as UserProfile | null);
    const r = (roleRow?.role ?? null) as AppRole | null;
    setRole(r);
    if (r) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export")
        .eq("role", r);
      setPermissions((perms ?? []) as PermissionRow[]);
    } else {
      setPermissions([]);
    }
  }

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer heavy work to avoid deadlocks
        setTimeout(() => loadUserData(sess.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
        setPermissions([]);
      }
    });

    // Then load existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadUserData(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // Update last_login + log audit
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      await supabase.from("user_profiles").update({ last_login: new Date().toISOString() }).eq("id", u.id);
      await supabase.from("audit_logs").insert({ user_id: u.id, action: "LOGIN", table_name: null });
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setPermissions([]);
  }

  function can(screen: string, action: keyof Omit<PermissionRow, "screen_name">) {
    const row = permissions.find((p) => p.screen_name === screen);
    return !!row?.[action];
  }

  async function refresh() {
    if (user) await loadUserData(user.id);
  }

  return (
    <AuthContext.Provider
      value={{ user, session, profile, role, permissions, loading, signIn, signOut, can, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
