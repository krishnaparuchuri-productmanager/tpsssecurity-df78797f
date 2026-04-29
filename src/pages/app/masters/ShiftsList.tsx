import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function ShiftsList() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [form, setForm] = useState({ shift_name:"", shift_code:"", shift_start_time:"07:00", shift_end_time:"19:00", shift_hours:8, branch_id:"" });

  async function load() {
    const [{ data: s }, { data: b }] = await Promise.all([
      supabase.from("shifts").select("*, branch:branches(branch_name)").eq("is_deleted", false).order("shift_name"),
      supabase.from("branches").select("id, branch_name").eq("is_deleted", false),
    ]);
    setRows(s ?? []); setBranches(b ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.shift_name || !form.branch_id) { toast.error("Name and branch required"); return; }
    const { error } = await supabase.from("shifts").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Shift added"); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Shifts</h1>
      <Card><CardHeader><CardTitle className="text-base">Add Shift</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div><Label>Name</Label><Input value={form.shift_name} onChange={e=>setForm({...form, shift_name:e.target.value})} /></div>
          <div><Label>Code</Label><Input value={form.shift_code} onChange={e=>setForm({...form, shift_code:e.target.value.toUpperCase()})} /></div>
          <div><Label>Start</Label><Input type="time" value={form.shift_start_time} onChange={e=>setForm({...form, shift_start_time:e.target.value})} /></div>
          <div><Label>End</Label><Input type="time" value={form.shift_end_time} onChange={e=>setForm({...form, shift_end_time:e.target.value})} /></div>
          <div><Label>Hours</Label><Input type="number" value={form.shift_hours} onChange={e=>setForm({...form, shift_hours:Number(e.target.value)})} /></div>
          <div><Label>Branch</Label>
            <Select value={form.branch_id} onValueChange={v=>setForm({...form, branch_id:v})}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={add} className="md:col-span-6 bg-app-navy"><Plus className="h-4 w-4 mr-1" /> Add Shift</Button>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left"><tr><th className="p-2">Branch</th><th className="p-2">Code</th><th className="p-2">Name</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2">Hours</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.branch?.branch_name}</td>
              <td className="p-2 font-mono">{r.shift_code}</td>
              <td className="p-2">{r.shift_name}</td>
              <td className="p-2">{r.shift_start_time}</td>
              <td className="p-2">{r.shift_end_time}</td>
              <td className="p-2">{r.shift_hours}</td>
            </tr>
          ))}</tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
