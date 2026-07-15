import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Paginator from "@/components/Paginator";
import { Plus, Eye, Search, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;

const STATUS_COLOR: Record<string, string> = {
  new:                 "bg-blue-100 text-blue-700",
  contacted:           "bg-purple-100 text-purple-700",
  qualified:           "bg-indigo-100 text-indigo-700",
  site_visit_planned:  "bg-orange-100 text-orange-700",
  proposal_pending:    "bg-yellow-100 text-yellow-800",
  quotation_submitted: "bg-amber-100 text-amber-700",
  negotiation:         "bg-teal-100 text-teal-700",
  on_hold:             "bg-gray-100 text-gray-600",
  won:                 "bg-green-100 text-green-700",
  lost:                "bg-red-100 text-red-700",
  closed:              "bg-gray-200 text-gray-500",
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-gray-50 text-gray-500",
  medium: "bg-blue-50 text-blue-600",
  high:   "bg-orange-50 text-orange-600",
  urgent: "bg-red-50 text-red-600",
};

const SOURCE_LABEL: Record<string, string> = {
  website:         "Website",
  manual:          "Manual",
  referral:        "Referral",
  call:            "Call",
  walk_in:         "Walk-in",
  existing_client: "Existing Client",
  other:           "Other",
};

const STATUS_OPTIONS = [
  "new","contacted","qualified","site_visit_planned","proposal_pending",
  "quotation_submitted","negotiation","on_hold","won","lost","closed",
];

interface Row {
  id: string; lead_number: string; company_name: string;
  contact_person_name: string; phone: string; status: string;
  priority: string; source: string;
  requirement_category: string | null; no_of_guards: number | null;
  next_followup_at: string | null; assigned_to_user_id: string | null;
  created_at: string;
}

interface UserMap { [id: string]: string }

export default function LeadsList() {
  const { isSandbox } = useEnvironment();
  const { can } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase.from("user_profiles").select("id, full_name")
      .then(({ data }) => {
        const m: UserMap = {};
        (data ?? []).forEach((u: any) => { m[u.id] = u.full_name; });
        setUserMap(m);
      });
  }, []);

  useEffect(() => {
    setPage(1);
    supabase.from("crm_leads")
      .select("id, lead_number, company_name, contact_person_name, phone, status, priority, source, requirement_category, no_of_guards, next_followup_at, assigned_to_user_id, created_at")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [isSandbox]);

  const now = new Date().toISOString();

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (sourceFilter !== "all") r = r.filter((x) => x.source === sourceFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter((x) =>
        x.company_name.toLowerCase().includes(q) ||
        x.contact_person_name.toLowerCase().includes(q) ||
        x.phone.includes(q) ||
        x.lead_number.toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, statusFilter, sourceFilter, search]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function fmtCategory(c: string | null) {
    if (!c) return "—";
    return { security_guards: "Security Guards", aso: "ASO", housekeeping: "Housekeeping", other: "Other" }[c] ?? c;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-app-navy">Leads Pipeline</h1>
        {can("crm_leads", "can_create") && (
          <Link to="/app/crm/leads/new">
            <Button className="bg-app-navy text-white"><Plus className="h-4 w-4 mr-1" /> New Lead</Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search company, contact, phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 w-60"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {Object.entries(SOURCE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-app-muted">{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-app-surface text-left text-xs text-app-muted uppercase tracking-wide">
            <tr>
              <th className="p-2 pl-3">Lead #</th>
              <th className="p-2">Company</th>
              <th className="p-2">Contact</th>
              <th className="p-2">Category</th>
              <th className="p-2">Status</th>
              <th className="p-2">Priority</th>
              <th className="p-2">Next Follow-up</th>
              <th className="p-2">Assigned To</th>
              <th className="p-2">Source</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No leads found</td></tr>
            ) : paged.map((r) => {
              const overdue = r.next_followup_at && r.next_followup_at < now && !["won","lost","closed"].includes(r.status);
              return (
                <tr key={r.id} className={`border-t border-app-border hover:bg-app-surface/50 ${overdue ? "bg-red-50" : ""}`}>
                  <td className="p-2 pl-3 font-mono text-xs font-semibold text-app-navy">{r.lead_number}</td>
                  <td className="p-2 font-medium max-w-[160px] truncate">{r.company_name || "—"}</td>
                  <td className="p-2">
                    <div className="font-medium truncate max-w-[120px]">{r.contact_person_name}</div>
                    <div className="text-xs text-app-muted">{r.phone}</div>
                  </td>
                  <td className="p-2 text-xs">
                    {fmtCategory(r.requirement_category)}
                    {r.no_of_guards ? <span className="text-app-muted"> ×{r.no_of_guards}</span> : null}
                  </td>
                  <td className="p-2">
                    <Badge className={`text-xs ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Badge className={`text-xs ${PRIORITY_COLOR[r.priority] ?? ""}`}>{r.priority}</Badge>
                  </td>
                  <td className="p-2">
                    {r.next_followup_at ? (
                      <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-600 font-semibold" : ""}`}>
                        {overdue && <AlertCircle className="h-3 w-3" />}
                        {formatDate(r.next_followup_at)}
                      </span>
                    ) : <span className="text-app-muted text-xs">—</span>}
                  </td>
                  <td className="p-2 text-xs">{r.assigned_to_user_id ? userMap[r.assigned_to_user_id] ?? "—" : <span className="text-app-muted">Unassigned</span>}</td>
                  <td className="p-2">
                    <span className="text-xs text-app-muted">{SOURCE_LABEL[r.source] ?? r.source}</span>
                  </td>
                  <td className="p-2">
                    <Link to={`/app/crm/leads/${r.id}`}>
                      <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <Paginator page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage} />
      )}
    </div>
  );
}
