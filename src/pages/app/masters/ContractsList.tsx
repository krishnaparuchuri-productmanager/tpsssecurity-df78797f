import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export default function ContractsList() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id:"", contract_start_date: new Date().toISOString().slice(0,10), contract_end_date:"", po_number:"", po_date:"", po_amount:"", notes:"" });
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    const [{ data: c }, { data: cl }] = await Promise.all([
      supabase.from("client_contracts").select("*, client:clients(client_name, client_code)").eq("is_sandbox", isSandbox).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, client_name").eq("is_sandbox", isSandbox).eq("is_deleted", false).eq("is_active", true),
    ]);
    setRows(c ?? []); setClients(cl ?? []);
  }
  useEffect(() => { load(); }, [isSandbox]);

  async function create() {
    if (!form.client_id || !form.contract_start_date) { toast.error("Client and start date required"); return; }
    const { error } = await supabase.rpc("create_contract", { _payload: form as any });
    if (error) { toast.error(error.message); return; }
    toast.success("Contract created"); setOpen(false); load();
  }

  function expiryBadge(end: string | null) {
    if (!end) return <Badge variant="outline">Open-ended</Badge>;
    const d = (new Date(end).getTime() - Date.now()) / 86400000;
    if (d < 0) return <Badge className="bg-red-100 text-red-900">🔴 Expired</Badge>;
    if (d < 30) return <Badge className="bg-yellow-100 text-yellow-900">🟡 {Math.ceil(d)}d</Badge>;
    return <Badge className="bg-green-100 text-green-900">🟢 Active</Badge>;
  }

  const filtered = rows.filter(r => statusFilter === "all" || r.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Contracts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-app-navy"><Plus className="h-4 w-4 mr-1" /> New Contract</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Client *</Label>
                <Select value={form.client_id} onValueChange={v=>setForm({...form,client_id:v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Start *</Label><Input type="date" value={form.contract_start_date} onChange={e=>setForm({...form,contract_start_date:e.target.value})} /></div>
                <div><Label>End</Label><Input type="date" value={form.contract_end_date} onChange={e=>setForm({...form,contract_end_date:e.target.value})} /></div>
                <div><Label>PO Number</Label><Input value={form.po_number} onChange={e=>setForm({...form,po_number:e.target.value})} /></div>
                <div><Label>PO Date</Label><Input type="date" value={form.po_date} onChange={e=>setForm({...form,po_date:e.target.value})} /></div>
                <div className="col-span-2"><Label>PO Amount</Label><Input type="number" value={form.po_amount} onChange={e=>setForm({...form,po_amount:e.target.value})} /></div>
                <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              </div>
              <Button onClick={create} className="w-full bg-app-navy">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-2">
        {["all","active","expired","renewed","terminated"].map(s => (
          <Button key={s} size="sm" variant={statusFilter===s?"default":"outline"} onClick={()=>setStatusFilter(s)}>{s}</Button>
        ))}
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left"><tr><th className="p-2">Contract No</th><th className="p-2">Client</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2">PO</th><th className="p-2">Status</th><th className="p-2">Expiry</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No contracts</td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono text-xs">{r.contract_number}</td>
                <td className="p-2">{r.client?.client_name}</td>
                <td className="p-2">{formatDate(r.contract_start_date)}</td>
                <td className="p-2">{r.contract_end_date ? formatDate(r.contract_end_date) : "—"}</td>
                <td className="p-2">{r.po_number ?? "—"}</td>
                <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                <td className="p-2">{expiryBadge(r.contract_end_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
