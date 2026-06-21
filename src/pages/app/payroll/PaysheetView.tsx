import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Download, Printer, Ban, RefreshCw } from "lucide-react";
import { formatINR, formatDate } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { downloadPaysheetExcel } from "@/lib/exportPaysheet";
import { CancelDialog } from "@/components/CancelDialog";
import { toast } from "sonner";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import tpssLogo from "@/assets/tpss-logo-portal.jpg";

export default function PaysheetView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const company = useCompanyProfile();
  const canExportExcel = role === "ceo_admin" || role === "coo_ops";
  const isCEO = role === "ceo_admin";
  const [showCancel, setShowCancel] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState<{ id: string; invoice_number: string; status: string } | null>(null);
  const [head, setHead] = useState<{
    id?: string; paysheet_number: string; month: string; status: string; rejection_reason: string | null;
    total_employees: number; total_net_salary: number;
    cancelled_at?: string | null; cancellation_reason?: string | null;
    replaced_by_id?: string | null; replaces_id?: string | null;
    clients: { client_name: string } | null;
  } | null>(null);
  const [emps, setEmps] = useState<Array<{
    id: string; employee_name: string; designation: string; uan_number: string | null; esi_number: string | null;
    earned_wages: number; epf_employee_deduction: number; esi_employee_deduction: number;
    pt_deduction: number; final_net_salary: number; no_of_duties: number; advance_deduction: number; uniform_advance_deduction: number;
  }>>([]);

  async function load() {
    if (!id) return;
    const [{ data: h }, { data: e }, { data: linked }] = await Promise.all([
      supabase.from("paysheets").select("id, paysheet_number, month, status, rejection_reason, total_employees, total_net_salary, cancelled_at, cancellation_reason, replaced_by_id, replaces_id, clients(client_name)").eq("id", id).maybeSingle(),
      supabase.from("paysheet_employees").select("*").eq("paysheet_id", id).order("employee_name"),
      supabase.from("invoices").select("id, invoice_number, status").eq("paysheet_id", id).eq("is_deleted", false).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setHead(h as unknown as typeof head);
    setEmps((e ?? []) as unknown as typeof emps);
    setLinkedInvoice(linked as typeof linkedInvoice);
  }
  useEffect(() => { load(); }, [id]);

  async function cancelPaysheet(reason: string, cascade: boolean) {
    if (!id) return;
    const { error } = await supabase.rpc("cancel_paysheet", { _id: id, _reason: reason, _cascade_invoice: cascade });
    if (error) {
      if (error.message.includes("LINKED_INVOICE_EXISTS")) {
        toast.error("Linked invoice exists. Tick the cascade option to cancel both.");
      } else if (error.message.includes("RECEIPTS_EXIST")) {
        toast.error("Linked invoice has receipts. Reverse them first.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Paysheet cancelled");
    setShowCancel(false);
    load();
  }

  async function recreatePaysheet() {
    if (!id) return;
    const { data, error } = await supabase.rpc("recreate_paysheet", { _old_id: id });
    if (error) return toast.error(error.message);
    toast.success("New draft created");
    navigate(`/app/payroll/create?id=${data as string}`);
  }

  if (!head) return <div className="text-muted-foreground">Loading…</div>;
  const isCancelled = head.status === "cancelled";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-app-navy">{head.paysheet_number}</h1>
            <Badge className={isCancelled ? "bg-gray-200 text-gray-600 line-through" : ""}>{head.status}</Badge>
          </div>
          <div className="text-base font-medium text-app-navy mt-0.5">{head.clients?.client_name}</div>
          <div className="text-sm text-app-muted">{head.month}</div>
          {head.rejection_reason && <div className="text-sm text-red-600 mt-1">Reason: {head.rejection_reason}</div>}
        </div>
        <div className="ml-auto flex gap-2 print:hidden flex-wrap">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
          {canExportExcel && (
            <Button variant="outline" onClick={() => downloadPaysheetExcel(head, emps, company)}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          )}
          {!isCancelled && head.status === "approved" && (
            <Link to={`/app/invoices/new?paysheet=${id}`}>
              <Button className="bg-app-navy text-white"><FileText className="h-4 w-4 mr-1" /> Generate Invoice</Button>
            </Link>
          )}
          {!isCancelled && isCEO && head.status !== "draft" && (
            <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setShowCancel(true)}>
              <Ban className="h-4 w-4 mr-1" /> Cancel Paysheet
            </Button>
          )}
          {isCancelled && isCEO && !head.replaced_by_id && (
            <Button onClick={recreatePaysheet} className="bg-app-navy text-white">
              <RefreshCw className="h-4 w-4 mr-1" /> Re-create Paysheet
            </Button>
          )}
        </div>
      </div>

      {isCancelled && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
          <div className="font-semibold text-destructive">CANCELLED{head.cancelled_at ? ` on ${formatDate(head.cancelled_at)}` : ""}</div>
          <div className="mt-1">Reason: {head.cancellation_reason ?? "—"}</div>
          {head.replaced_by_id && (
            <Link to={`/app/payroll/${head.replaced_by_id}/view`} className="text-app-navy underline mt-1 inline-block">
              View replacement paysheet →
            </Link>
          )}
        </div>
      )}

      {head.replaces_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs">
          This paysheet replaces <Link to={`/app/payroll/${head.replaces_id}/view`} className="underline">a cancelled paysheet</Link>.
        </div>
      )}

      <div className="bg-white border border-app-border rounded-lg p-4 flex items-start gap-4">
        {company?.logo_url ? (
          <img src={company.logo_url} alt="company logo" className="h-14 w-auto object-contain flex-shrink-0" />
        ) : (
          <img src={tpssLogo} alt="company logo" className="h-14 w-auto object-contain flex-shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-base font-bold text-app-navy">{company?.company_name ?? ""}</div>
          <div className="text-xs text-app-muted">{company?.registered_address ?? ""}</div>
          <div className="text-xs text-app-muted">{company?.phone}{company?.phone && company?.email ? " | " : ""}{company?.email}</div>
        </div>
      </div>

      <div className="bg-white border border-app-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-app-surface text-left">
            <tr>
              <th className="p-1 w-7">#</th>
              <th className="p-1">Name</th><th className="p-1">Desig</th>
              <th className="p-1">UAN</th><th className="p-1">ESI</th>
              <th className="p-1">Duties</th>
              <th className="p-1 text-right">Earned</th>
              <th className="p-1 text-right">EPF</th><th className="p-1 text-right">ESI</th>
              <th className="p-1 text-right">PT</th><th className="p-1 text-right">Adv</th>
              <th className="p-1 text-right">U.Adv</th><th className="p-1 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((e, idx) => (
              <tr key={e.id} className="border-t border-app-border">
                <td className="p-1 text-app-muted">{idx + 1}</td>
                <td className="p-1">{e.employee_name}</td>
                <td className="p-1">{e.designation}</td>
                <td className="p-1">{e.uan_number ?? "—"}</td>
                <td className="p-1">{e.esi_number ?? "—"}</td>
                <td className="p-1">{e.no_of_duties}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.earned_wages))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.epf_employee_deduction))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.esi_employee_deduction))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.pt_deduction))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.advance_deduction))}</td>
                <td className="p-1 text-right tabular-nums">{formatINR(Number(e.uniform_advance_deduction))}</td>
                <td className="p-1 text-right tabular-nums font-bold">{formatINR(Number(e.final_net_salary))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-app-surface font-bold">
            <tr>
              <td className="p-1" colSpan={12}>Total ({head.total_employees} employees)</td>
              <td className="p-1 text-right tabular-nums">{formatINR(Number(head.total_net_salary))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <CancelDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title={`Cancel paysheet ${head.paysheet_number}?`}
        description="The paysheet will be marked cancelled. You can re-create a fresh draft afterwards."
        showCascade={!!linkedInvoice}
        cascadeLabel={linkedInvoice ? `Also cancel linked invoice ${linkedInvoice.invoice_number} (${linkedInvoice.status})` : undefined}
        onConfirm={(reason, cascade) => cancelPaysheet(reason, cascade)}
      />
    </div>
  );
}
