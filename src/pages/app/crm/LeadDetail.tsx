import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatDate, formatINR } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import ActivityDialog from "./ActivityDialog";
import ClosureDialog from "./ClosureDialog";
import QuotationDialog from "./QuotationDialog";
import {
  Phone, Mail, MapPin, User, Building2, Calendar, Clock,
  Plus, Pencil, CheckCircle2, XCircle, FileText, ChevronRight,
  Globe, Users,
} from "lucide-react";

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
  low: "text-gray-500", medium: "text-blue-600", high: "text-orange-600", urgent: "text-red-600 font-bold",
};

const ACTIVITY_ICONS: Record<string, string> = {
  lead_created: "🌱", lead_imported: "🌐", status_changed: "🔄",
  assignment_changed: "👤", call_made: "📞", email_sent: "📧",
  whatsapp: "💬", meeting: "🤝", site_visit: "📍",
  quotation_added: "📋", quotation_submitted: "📤",
  followup_scheduled: "📅", note: "📝", reminder: "⏰", closure: "🏁",
};

const EDITABLE_STATUSES = ["new","contacted","qualified","site_visit_planned","proposal_pending","quotation_submitted","negotiation","on_hold"];

interface Lead {
  id: string; lead_number: string; source: string; status: string; priority: string;
  company_name: string; contact_person_name: string; contact_designation: string | null;
  phone: string; alternate_phone: string | null; email: string | null;
  location: string | null; address: string | null; preferred_contact_mode: string | null;
  requirement_category: string | null; no_of_guards: number | null;
  requirement_notes: string | null; expected_business_value: number | null;
  assigned_to_user_id: string | null; created_by_user_id: string | null;
  first_response_due_at: string | null; next_followup_at: string | null;
  expected_closure_date: string | null;
  closure_type: string | null; closure_summary: string | null; closure_date: string | null;
  lost_to_competitor: string | null; closure_price_issue: boolean | null;
  closure_no_response: boolean | null; closure_client_dropped: boolean | null;
  closure_scope_mismatch: boolean | null;
  closure_reason?: { reason_name: string } | null;
  created_at: string; updated_at: string;
}

interface Activity {
  id: string; activity_type: string; activity_datetime: string;
  notes: string | null; outcome: string | null; next_action: string | null;
  next_followup_at: string | null; contact_mode: string | null;
  created_by_user_id: string | null; created_at: string;
}

interface Quotation {
  id: string; quotation_number: string | null; quotation_date: string;
  value: number | null; summary: string | null; status: string;
  created_at: string;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, can, role } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [showActivity, setShowActivity] = useState(false);
  const [showClosure, setShowClosure] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function load() {
    if (!id) return;
    const [{ data: l }, { data: acts }, { data: quots }] = await Promise.all([
      supabase.from("crm_leads")
        .select("*, closure_reason:crm_closure_reasons(reason_name)")
        .eq("id", id).single(),
      supabase.from("crm_lead_activities")
        .select("*").eq("lead_id", id).eq("is_deleted", false)
        .order("activity_datetime", { ascending: false }),
      supabase.from("crm_lead_quotations")
        .select("*").eq("lead_id", id).eq("is_deleted", false)
        .order("created_at", { ascending: false }),
    ]);
    setLead(l as unknown as Lead);
    setActivities((acts ?? []) as unknown as Activity[]);
    setQuotations((quots ?? []) as unknown as Quotation[]);
  }

  useEffect(() => {
    supabase.from("user_profiles").select("id, full_name")
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach((u: any) => { m[u.id] = u.full_name; });
        setUserMap(m);
      });
  }, []);

  useEffect(() => { load(); }, [id]);

  async function changeStatus(newStatus: string) {
    if (!lead || !id) return;
    const oldStatus = lead.status;
    if (oldStatus === newStatus) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from("crm_leads").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error(error.message); setUpdatingStatus(false); return; }
    await supabase.from("crm_lead_activities").insert({
      lead_id: id, activity_type: "status_changed",
      activity_datetime: new Date().toISOString(),
      notes: `Status changed from "${oldStatus.replace(/_/g, " ")}" to "${newStatus.replace(/_/g, " ")}"`,
      created_by_user_id: user?.id ?? null,
    });
    await logAudit({ action: "UPDATE", table: "crm_leads", recordId: id, oldValues: { status: oldStatus }, newValues: { status: newStatus } });
    setUpdatingStatus(false);
    toast.success("Status updated");
    load();
  }

  if (!lead) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const isClosed = ["won", "lost", "closed"].includes(lead.status);
  const canEdit = can("crm_leads", "can_edit") && !isClosed;
  const canCreate = can("crm_leads", "can_create");
  const now = new Date().toISOString();
  const followupOverdue = lead.next_followup_at && lead.next_followup_at < now && !isClosed;

  function fmtCategory(c: string | null) {
    return { security_guards: "Security Guards", aso: "ASO", housekeeping: "Housekeeping", other: "Other" }[c ?? ""] ?? c ?? "—";
  }

  const SOURCE_ICON = lead.source === "website" ? <Globe className="h-3 w-3 inline mr-1" /> : <Users className="h-3 w-3 inline mr-1" />;

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-app-muted mb-1">
            <Link to="/app/crm/leads" className="hover:text-app-navy">Leads Pipeline</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-mono">{lead.lead_number}</span>
          </div>
          <h1 className="text-2xl font-bold text-app-navy">{lead.company_name || "Untitled Lead"}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={STATUS_COLOR[lead.status] ?? "bg-gray-100"}>{lead.status.replace(/_/g, " ")}</Badge>
            <span className={`text-xs font-medium ${PRIORITY_COLOR[lead.priority]}`}>{lead.priority} priority</span>
            <span className="text-xs text-app-muted">{SOURCE_ICON}{lead.source.replace(/_/g, " ")}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <Link to={`/app/crm/leads/${id}/edit`}>
              <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
            </Link>
          )}
          {canCreate && !isClosed && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowActivity(true)}>
                <Plus className="h-4 w-4 mr-1" /> Log Activity
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowQuotation(true)}>
                <FileText className="h-4 w-4 mr-1" /> Add Quotation
              </Button>
              <Button
                size="sm"
                className={lead.closure_type === "won" ? "bg-green-600 text-white" : lead.closure_type === "lost" ? "bg-red-600 text-white" : "bg-app-navy text-white"}
                onClick={() => setShowClosure(true)}
              >
                Close Lead
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status update bar */}
      {!isClosed && canEdit && (
        <div className="flex items-center gap-3 bg-white border border-app-border rounded-lg px-4 py-3">
          <span className="text-sm text-app-muted">Move status to:</span>
          <Select value={lead.status} onValueChange={changeStatus} disabled={updatingStatus}>
            <SelectTrigger className="w-56 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EDITABLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {updatingStatus && <span className="text-xs text-app-muted animate-pulse">Saving…</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column: summary + quotations */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact card */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Contact & Company</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-app-muted mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">{lead.contact_person_name}</div>
                  {lead.contact_designation && <div className="text-app-muted text-xs">{lead.contact_designation}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-app-muted shrink-0" />
                <span>{lead.company_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-app-muted shrink-0" />
                <a href={`tel:${lead.phone}`} className="hover:text-app-navy">{lead.phone}</a>
                {lead.alternate_phone && <span className="text-app-muted">/ {lead.alternate_phone}</span>}
              </div>
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-app-muted shrink-0" />
                  <a href={`mailto:${lead.email}`} className="hover:text-app-navy truncate">{lead.email}</a>
                </div>
              )}
              {lead.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-app-muted shrink-0" />
                  <span>{lead.location}</span>
                </div>
              )}
              {lead.preferred_contact_mode && (
                <div className="text-xs text-app-muted">Prefers: {lead.preferred_contact_mode}</div>
              )}
            </CardContent>
          </Card>

          {/* Requirement card */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Requirement</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-app-muted">Category: </span>{fmtCategory(lead.requirement_category)}</div>
              {lead.no_of_guards && <div><span className="text-app-muted">Guards: </span>{lead.no_of_guards}</div>}
              {lead.expected_business_value && (
                <div><span className="text-app-muted">Est. Value: </span>{formatINR(lead.expected_business_value)}/mo</div>
              )}
              {lead.requirement_notes && (
                <div className="mt-2 p-2 bg-app-surface rounded text-xs leading-relaxed">{lead.requirement_notes}</div>
              )}
            </CardContent>
          </Card>

          {/* Assignment / timeline card */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Assignment & Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-app-muted shrink-0" />
                <span>{lead.assigned_to_user_id ? userMap[lead.assigned_to_user_id] ?? "—" : <span className="text-app-muted">Unassigned</span>}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-app-muted text-xs">Created by:</span>
                <span className="text-xs">{lead.created_by_user_id ? userMap[lead.created_by_user_id] ?? "System" : "Website"}</span>
              </div>
              {lead.first_response_due_at && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-app-muted shrink-0" />
                  <span className="text-xs">First response due: {formatDate(lead.first_response_due_at)}</span>
                </div>
              )}
              {lead.next_followup_at && (
                <div className={`flex items-center gap-2 ${followupOverdue ? "text-red-600 font-semibold" : ""}`}>
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="text-xs">Next follow-up: {formatDate(lead.next_followup_at)}</span>
                  {followupOverdue && <span className="text-xs">⚠ Overdue</span>}
                </div>
              )}
              {lead.expected_closure_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-app-muted shrink-0" />
                  <span className="text-xs">Expected closure: {formatDate(lead.expected_closure_date)}</span>
                </div>
              )}
              <div className="text-xs text-app-muted pt-1">Created: {formatDate(lead.created_at)}</div>
            </CardContent>
          </Card>

          {/* Closure details (shown if won/lost) */}
          {isClosed && lead.closure_type && (
            <Card className={lead.closure_type === "positive" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {lead.closure_type === "positive"
                    ? <><CheckCircle2 className="h-4 w-4 text-green-600" /> Won</>
                    : <><XCircle className="h-4 w-4 text-red-600" /> Lost</>
                  }
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {lead.closure_date && <div><span className="text-app-muted">Closure date: </span>{formatDate(lead.closure_date)}</div>}
                {lead.closure_reason && <div><span className="text-app-muted">Reason: </span>{lead.closure_reason.reason_name}</div>}
                {lead.closure_summary && <div className="p-2 bg-white/60 rounded text-xs">{lead.closure_summary}</div>}
                {lead.closure_type === "negative" && (
                  <div className="text-xs text-app-muted space-y-0.5">
                    {lead.lost_to_competitor && <div>Competitor: {lead.lost_to_competitor}</div>}
                    {lead.closure_price_issue && <div>• Price was too high</div>}
                    {lead.closure_no_response && <div>• Client stopped responding</div>}
                    {lead.closure_client_dropped && <div>• Client dropped the plan</div>}
                    {lead.closure_scope_mismatch && <div>• Scope mismatch</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quotations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Quotations</CardTitle>
              {canCreate && !isClosed && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowQuotation(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <p className="text-xs text-app-muted">No quotations yet</p>
              ) : (
                <div className="space-y-2">
                  {quotations.map((q) => (
                    <div key={q.id} className="border border-app-border rounded p-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{q.quotation_number ?? "Quotation"}</span>
                        <Badge className="text-[10px] h-4">{q.status}</Badge>
                      </div>
                      {q.value && <div className="text-app-muted">Value: {formatINR(q.value)}</div>}
                      <div className="text-app-muted">Date: {formatDate(q.quotation_date)}</div>
                      {q.summary && <div className="text-foreground">{q.summary}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: activity timeline */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">Activity Timeline ({activities.length})</CardTitle>
              {canCreate && !isClosed && (
                <Button size="sm" className="bg-app-navy text-white h-7 text-xs" onClick={() => setShowActivity(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Log Activity
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-app-muted">No activity recorded yet.</p>
              ) : (
                <div className="space-y-0">
                  {activities.map((a, i) => (
                    <div key={a.id} className="relative">
                      {i < activities.length - 1 && (
                        <div className="absolute left-[18px] top-8 bottom-0 w-px bg-app-border" />
                      )}
                      <div className="flex gap-3 py-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-app-surface border border-app-border flex items-center justify-center text-base">
                          {ACTIVITY_ICONS[a.activity_type] ?? "📌"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-app-navy capitalize">
                              {a.activity_type.replace(/_/g, " ")}
                            </span>
                            {a.contact_mode && (
                              <span className="text-[10px] bg-app-surface border border-app-border rounded px-1.5 py-0.5">
                                via {a.contact_mode}
                              </span>
                            )}
                            <span className="text-[10px] text-app-muted ml-auto">
                              {formatDate(a.activity_datetime)}
                              {a.created_by_user_id && ` · ${userMap[a.created_by_user_id] ?? "—"}`}
                            </span>
                          </div>
                          {a.notes && <p className="text-xs mt-1 text-foreground leading-relaxed">{a.notes}</p>}
                          {a.outcome && <p className="text-xs mt-1 text-app-muted"><span className="font-medium">Outcome:</span> {a.outcome}</p>}
                          {a.next_action && <p className="text-xs text-app-muted"><span className="font-medium">Next:</span> {a.next_action}</p>}
                          {a.next_followup_at && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              📅 Follow-up: {formatDate(a.next_followup_at)}
                            </p>
                          )}
                        </div>
                      </div>
                      {i < activities.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ActivityDialog
        leadId={id!}
        open={showActivity}
        onClose={() => setShowActivity(false)}
        onSaved={() => load()}
      />
      <ClosureDialog
        leadId={id!}
        open={showClosure}
        onClose={() => setShowClosure(false)}
        onClosed={() => load()}
      />
      <QuotationDialog
        leadId={id!}
        open={showQuotation}
        onClose={() => setShowQuotation(false)}
        onSaved={() => load()}
      />
    </div>
  );
}
