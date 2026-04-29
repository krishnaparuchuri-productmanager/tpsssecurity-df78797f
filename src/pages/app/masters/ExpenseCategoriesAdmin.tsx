import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";

interface Cat { id: string; category_name: string; is_active: boolean; sort_order: number; ledger_category: string; }

const LEDGER_CATS = [
  "epf_payment", "esi_payment", "gst_payment", "pt_payment",
  "staff_salary", "salary_advance", "admin_expense", "vehicle_expense", "other_expense",
];

export default function ExpenseCategoriesAdmin() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const [ledger, setLedger] = useState("other_expense");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    supabase.from("expense_categories")
      .select("id, category_name, is_active, sort_order, ledger_category")
      .order("sort_order")
      .then(({ data }) => setRows((data ?? []) as Cat[]));
  }, [refresh]);

  async function add() {
    if (!name.trim()) return toast.error("Name required");
    const { error } = await supabase.rpc("manage_expense_category", {
      _payload: { category_name: name, ledger_category: ledger, is_active: true, sort_order: rows.length + 1 } as never,
    });
    if (error) return toast.error(error.message);
    setName(""); setRefresh((k) => k + 1);
    toast.success("Category added");
  }

  async function update(c: Cat, patch: Partial<Cat>) {
    const { error } = await supabase.rpc("manage_expense_category", {
      _payload: { id: c.id, ...patch } as never,
    });
    if (error) return toast.error(error.message);
    setRefresh((k) => k + 1);
  }

  async function reorder(c: Cat, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.id === c.id);
    const swap = rows[idx + dir];
    if (!swap) return;
    const orders = [
      { id: c.id, sort_order: swap.sort_order },
      { id: swap.id, sort_order: c.sort_order },
    ];
    const { error } = await supabase.rpc("reorder_expense_categories", { _orders: orders as never });
    if (error) return toast.error(error.message);
    setRefresh((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-app-navy">Expense Categories</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]"><Label>New category name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="min-w-[180px]">
              <Label>Ledger Category</Label>
              <Select value={ledger} onValueChange={setLedger}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEDGER_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="bg-app-navy text-white" onClick={add}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>

          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-16">Order</TableHead><TableHead>Name</TableHead>
              <TableHead>Ledger Category</TableHead><TableHead>Active</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => reorder(c, -1)}>↑</Button>
                      <Button size="sm" variant="ghost" onClick={() => reorder(c, 1)}>↓</Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input defaultValue={c.category_name} onBlur={(e) => e.target.value !== c.category_name && update(c, { category_name: e.target.value } as Partial<Cat>)} />
                  </TableCell>
                  <TableCell>
                    <Select value={c.ledger_category} onValueChange={(v) => update(c, { ledger_category: v } as Partial<Cat>)}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{LEDGER_CATS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch checked={c.is_active} onCheckedChange={(v) => update(c, { is_active: v } as Partial<Cat>)} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => update(c, {})}><Save className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
