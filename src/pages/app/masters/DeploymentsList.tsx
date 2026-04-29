import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function DeploymentsList() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id:"", client_id:"", shift_id:"", post_id:"", deployment_start_date: new Date().toISOString().slice(0,10), notes:"" });
  const [relieveOpen, setRelieveOpen] = useState<string | null>(null);
  const [relieveForm, setRelieveForm] = useState({ end: new Date().toISOString().slice(0,10), reason: "" });

  async function load() {
    const [{ data: d }, { data: e }, { data: c }, { data: s }] = await Promise.all([
      supabase.from("employee_deployments").select("*, employee:employees(full_name, employee_code), client:clients(client_name), shift:shifts(shift_name)")
        .eq("is_sandbox", isSandbox).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("employees").select("id, full_name, employee_code").eq("status","Active").eq("is_sandbox", isSandbox).eq("is_deleted", false),
      supabase.from("clients").select("id, client_name").eq("is_sandbox", isSandbox).eq("is_deleted", false).eq("is_active", true),
      supabase.from("shifts").select("id, shift_name").eq("is_deleted", false),
    ]);
    setRows(d ?? []); setEmployees(e ?? []); setClients(c ?? []); setShifts(s ?? []);
  }
  useEffect(() => { load(); }, [isSandbox]);

  async function deploy() {
    if (!form.employee_id || !form.client_id || !form.shift_id) { toast.error("Fill required fields"); return; }
    const { error } = await supabase.rpc("create_deployment", { _payload: form as any });
    if (error) { toast.error(error.message); return; }
    toast.success("Deployed"); setOpen(false); load();
  }
  async function relieve(id: string) {
    if (!relieveForm.reason) { toast.error("Reason required"); return; }
    const { error } = await supabase.rpc("relieve_deployment", { _id: id, _end: relieveForm.end, _reason: relieveForm.reason } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Relieved"); setRelieveOpen(null); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app-navy">Deployments</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-app-navy"><Plus className="h-4 w-4 mr-1" /> New Deployment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Deploy Employee</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Employee *</Label>
                <Select value={form.employee_id} onValueChange={v=>setForm({...form,employee_id:v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.employee_code} — {e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Client *</Label>
                <Select value={form.client_id} onValueChange={v=>setForm({...form,client_id:v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.client_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Shift *</Label>
                <Select value={form.shift_id} onValueChange={v=>setForm({...form,shift_id:v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.shift_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Start Date *</Label><Input type="date" value={form.deployment_start_date} onChange={e=>setForm({...form,deployment_start_date:e.target.value})} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              <Button onClick={deploy} className="w-full bg-app-navy">Deploy</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left"><tr><th className="p-2">Employee</th><th className="p-2">Client</th><th className="p-2">Shift</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2">Status</th><th className="p-2"></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No deployments</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.employee?.full_name}</td>
                <td className="p-2">{r.client?.client_name}</td>
                <td className="p-2">{r.shift?.shift_name}</td>
                <td className="p-2">{formatDate(r.deployment_start_date)}</td>
                <td className="p-2">{r.deployment_end_date ? formatDate(r.deployment_end_date) : "—"}</td>
                <td className="p-2">{r.is_current ? <Badge className="bg-green-100 text-green-900">Active</Badge> : <Badge variant="outline">Ended</Badge>}</td>
                <td className="p-2">
                  {r.is_current && (
                    <Dialog open={relieveOpen===r.id} onOpenChange={(o)=>setRelieveOpen(o?r.id:null)}>
                      <DialogTrigger asChild><Button size="sm" variant="outline">Relieve</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Relieve Employee</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>End Date *</Label><Input type="date" value={relieveForm.end} onChange={e=>setRelieveForm({...relieveForm,end:e.target.value})} /></div>
                          <div><Label>Reason *</Label><Input value={relieveForm.reason} onChange={e=>setRelieveForm({...relieveForm,reason:e.target.value})} /></div>
                          <Button onClick={()=>relieve(r.id)} className="w-full bg-app-navy">Confirm</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
