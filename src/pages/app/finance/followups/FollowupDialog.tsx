import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

interface Row {
  id: string; status: string; contact_mode: string | null; response: string | null;
  promise_date: string | null; next_followup_date: string | null; closed_reason: string | null;
  invoice_id: string;
}
interface InvOpt { id: string; invoice_number: string; client_id: string; outstanding_amount: number; clients: { client_name: string } | null; }

const MODES = ["Phone", "In-Person", "Email", "WhatsApp", "Other"];
const STATUSES = ["open", "in_progress", "promised", "closed"];

export default function FollowupDialog({
  followup, onClose, onSaved,
}: { followup: Row | null; onClose: () => void; onSaved: () => void }) {
  const { isSandbox } = useEnvironment();
  const today = new Date().toISOString().slice(0, 10);
  const [invoiceId, setInvoiceId] = useState(followup?.invoice_id ?? "");
  const [followupDate, setFollowupDate] = useState(today);
  const [mode, setMode] = useState(followup?.contact_mode ?? "Phone");
  const [response, setResponse] = useState(followup?.response ?? "");
  const [promise, setPromise] = useState(followup?.promise_date ?? "");
  const [next, setNext] = useState(followup?.next_followup_date ?? "");
  const [status, setStatus] = useState(followup?.status ?? "open");
  const [closedReason, setClosedReason] = useState(followup?.closed_reason ?? "");
  const [invs, setInvs] = useState<InvOpt[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (followup) return;
    supabase.from("invoices")
      .select("id, invoice_number, client_id, outstanding_amount, clients(client_name)")
      .eq("is_sandbox", isSandbox).eq("is_deleted", false).gt("outstanding_amount", 0)
      .order("invoice_date", { ascending: false }).limit(200)
      .then(({ data }) => setInvs((data ?? []) as unknown as InvOpt[]));
  }, [isSandbox, followup]);

  async function save() {
    if (!followup && !invoiceId) return toast.error("Select invoice");
    setSaving(true);
    if (followup) {
      const { error } = await supabase.rpc("update_followup", {
        _id: followup.id,
        _payload: {
          status, contact_mode: mode, response, promise_date: promise || null,
          next_followup_date: next || null, closed_reason: closedReason || null,
        } as never,
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Followup updated");
    } else {
      const inv = invs.find((i) => i.id === invoiceId);
      const { error } = await supabase.rpc("create_followup", {
        _payload: {
          invoice_id: invoiceId, client_id: inv?.client_id, followup_date: followupDate,
          contact_mode: mode, response, promise_date: promise || null,
          next_followup_date: next || null, status,
        } as never,
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Followup logged");
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{followup ? "Update Followup" : "Log Followup"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!followup && (
            <div>
              <Label>Invoice *</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Select overdue invoice" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {invs.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoice_number} — {i.clients?.client_name} — {formatINR(Number(i.outstanding_amount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-3">
            {!followup && <div><Label>Date</Label><Input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} /></div>}
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Response / Notes</Label>
            <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={3} maxLength={1000} />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Promise Date</Label><Input type="date" value={promise} onChange={(e) => setPromise(e.target.value)} /></div>
            <div><Label>Next Followup</Label><Input type="date" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          </div>
          {status === "closed" && (
            <div><Label>Close Reason</Label><Input value={closedReason} onChange={(e) => setClosedReason(e.target.value)} placeholder="e.g. Paid in full" /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-app-navy text-white" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
