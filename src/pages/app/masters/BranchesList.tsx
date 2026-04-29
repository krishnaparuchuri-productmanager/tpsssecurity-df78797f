import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function BranchesList() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [addr, setAddr] = useState("");

  async function load() {
    const { data } = await supabase.from("branches").select("*").eq("is_deleted", false).order("branch_name");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!name || !code) { toast.error("Name and code required"); return; }
    const { error } = await supabase.from("branches").insert({ branch_name: name, branch_code: code.toUpperCase(), branch_address: addr });
    if (error) { toast.error(error.message); return; }
    toast.success("Branch added"); setName(""); setCode(""); setAddr(""); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Branches</h1>
      <Card><CardHeader><CardTitle className="text-base">Add Branch</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>Name</Label><Input value={name} onChange={e=>setName(e.target.value)} /></div>
          <div><Label>Code</Label><Input value={code} onChange={e=>setCode(e.target.value)} maxLength={6} /></div>
          <div><Label>Address</Label><Input value={addr} onChange={e=>setAddr(e.target.value)} /></div>
          <Button onClick={add} className="bg-app-navy"><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardContent>
      </Card>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left"><tr><th className="p-2">Code</th><th className="p-2">Name</th><th className="p-2">Address</th><th className="p-2">Type</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-t">
              <td className="p-2 font-mono">{r.branch_code}</td>
              <td className="p-2">{r.branch_name}</td>
              <td className="p-2">{r.branch_address ?? "—"}</td>
              <td className="p-2">{r.is_head_office ? <Badge>Head Office</Badge> : <Badge variant="outline">Branch</Badge>}</td>
            </tr>
          ))}</tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
