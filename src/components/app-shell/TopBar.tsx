import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

function formatTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const ROLE_LABEL: Record<string, string> = {
  ceo_admin: "CEO",
  coo_ops: "COO / Operations",
  accountant: "Accountant",
};

export default function TopBar({ remainingMs }: { remainingMs: number }) {
  const { profile, role, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const unread = notifs.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (active && data) setNotifs(data as Notification[]); });

    const ch = supabase
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setNotifs((cur) => [payload.new as Notification, ...cur].slice(0, 20))
      )
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  async function markAllRead() {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifs((cur) => cur.map((n) => ({ ...n, is_read: true })));
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <span className="hidden md:inline text-xs text-app-muted tabular-nums">
        Session: <span className="font-mono">{formatTimer(remainingMs)}</span>
      </span>

      <DropdownMenu onOpenChange={(o) => o && markAllRead()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5 text-app-navy" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-app-saffron text-[10px] font-bold text-white flex items-center justify-center">
                {unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifs.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            notifs.slice(0, 8).map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                <div className="text-[10px] text-muted-foreground">{formatDate(n.created_at)}</div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <div className="h-8 w-8 rounded-full bg-app-navy text-white flex items-center justify-center text-xs font-semibold">
              {(profile?.full_name || profile?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col items-start leading-tight">
              <span className="text-xs font-medium text-app-navy">{profile?.full_name || profile?.email}</span>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-app-saffron/15 text-app-saffron border-0">
                {role ? ROLE_LABEL[role] : "—"}
              </Badge>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{profile?.full_name || profile?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
