import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

interface Row { id: string; user_id: string | null; activity_type: string; page_url: string | null; ip_address: string | null; device_info: string | null; details: Record<string, unknown> | null; created_at: string; }
interface UserOpt { id: string; full_name: string; email: string; }

const TYPE_COLORS: Record<string, string> = {
  login: "bg-green-100 text-green-800",
  login_failed: "bg-red-100 text-red-800",
  export: "bg-yellow-100 text-yellow-800",
  logout: "bg-slate-100 text-slate-700",
  approve: "bg-blue-100 text-blue-800",
  reject: "bg-orange-100 text-orange-800",
};

export default function ActivityLog() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [userFilter, setUserFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [ipFilter, setIpFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ logins_today: 0, failed_7d: 0, exports_month: 0, top_user: "—" });

  useEffect(() => {
    supabase.from("user_profiles").select("id, full_name, email").order("full_name")
      .then(({ data }) => setUsers((data ?? []) as UserOpt[]));
  }, []);

  useEffect(() => {
    let q = supabase.from("user_activity_log")
      .select("id, user_id, activity_type, page_url, ip_address, device_info, details, created_at")
      .gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false }).limit(500);
    if (userFilter !== "all") q = q.eq("user_id", userFilter);
    if (typeFilter !== "all") q = q.eq("activity_type", typeFilter);
    if (ipFilter) q = q.ilike("ip_address", `%${ipFilter}%`);
    q.then(({ data }) => setRows((data ?? []) as Row[]));
  }, [userFilter, typeFilter, from, to, ipFilter]);

  useEffect(() => {
    const todayStart = `${today}T00:00:00`;
    const monthStart = today.slice(0, 7) + "-01T00:00:00";
    Promise.all([
      supabase.from("user_activity_log").select("*", { count: "exact", head: true }).eq("activity_type", "login").gte("created_at", todayStart),
      supabase.from("user_activity_log").select("*", { count: "exact", head: true }).eq("activity_type", "login_failed").gte("created_at", `${weekAgo}T00:00:00`),
      supabase.from("user_activity_log").select("*", { count: "exact", head: true }).eq("activity_type", "export").gte("created_at", monthStart),
      supabase.from("user_activity_log").select("user_id").gte("created_at", `${weekAgo}T00:00:00`),
    ]).then(([li, fl, ex, all]) => {
      const counts: Record<string, number> = {};
      ((all.data ?? []) as Array<{ user_id: string | null }>).forEach((r) => { if (r.user_id) counts[r.user_id] = (counts[r.user_id] ?? 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      setStats({ logins_today: li.count ?? 0, failed_7d: fl.count ?? 0, exports_month: ex.count ?? 0, top_user: top ? (users.find((u) => u.id === top[0])?.full_name ?? "—") : "—" });
    });
  }, [today, weekAgo, users]);

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.full_name || u.email])), [users]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Activity Log</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Logins Today</div><div className="text-xl font-bold tabular-nums">{stats.logins_today}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Failed Logins (7d)</div><div className={`text-xl font-bold tabular-nums ${stats.failed_7d > 5 ? "text-red-700" : ""}`}>{stats.failed_7d}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Exports This Month</div><div className="text-xl font-bold tabular-nums">{stats.exports_month}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-app-muted">Most Active User (7d)</div><div className="text-base font-semibold">{stats.top_user}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[200px]"><Label>User</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]"><Label>Activity</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {["login","login_failed","logout","export","approve","reject","create","update","delete"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div><Label>IP search</Label><Input value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} placeholder="x.x.x.x" /></div>
          </div>

          <Table>
            <TableHeader><TableRow>
              <TableHead>Timestamp</TableHead><TableHead>User</TableHead><TableHead>Activity</TableHead>
              <TableHead>Details</TableHead><TableHead>IP</TableHead><TableHead>Device</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-app-muted">No activity in range</TableCell></TableRow>}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.created_at)} {new Date(r.created_at).toLocaleTimeString()}</TableCell>
                  <TableCell>{r.user_id ? (userMap[r.user_id] ?? r.user_id.slice(0, 8)) : "—"}</TableCell>
                  <TableCell><Badge className={TYPE_COLORS[r.activity_type] ?? "bg-slate-100"}>{r.activity_type}</Badge></TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs">{r.details ? JSON.stringify(r.details) : (r.page_url ?? "—")}</TableCell>
                  <TableCell className="text-xs">{r.ip_address ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate" title={r.device_info ?? ""}>{r.device_info ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
