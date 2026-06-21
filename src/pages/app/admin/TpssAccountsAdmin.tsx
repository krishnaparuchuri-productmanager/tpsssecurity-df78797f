import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Account {
  id: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string | null;
  is_active: boolean;
}

const emptyForm = { account_name: "", account_number: "", ifsc_code: "", bank_name: "" };

export default function TpssAccountsAdmin() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data, error } = await (supabase as any)
      .from("tpss_bank_accounts")
      .select("*")
      .order("account_name");
    if (error) toast.error(error.message);
    else setAccounts(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.account_name.trim() || !form.account_number.trim() || !form.ifsc_code.trim()) {
      toast.error("Account name, number, and IFSC are required");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("tpss_bank_accounts").insert({
      account_name: form.account_name.trim(),
      account_number: form.account_number.trim(),
      ifsc_code: form.ifsc_code.trim().toUpperCase(),
      bank_name: form.bank_name.trim() || null,
      is_active: true,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account added");
    setForm(emptyForm);
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await (supabase as any)
      .from("tpss_bank_accounts")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  function f(field: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-app-navy">TPSS Bank Accounts</h1>
      <p className="text-sm text-muted-foreground">
        These accounts appear as debit (source) account options on the Bank Payment screen.
        Add the real Axis Bank (or other) accounts from which salary is disbursed.
      </p>

      {/* Add form */}
      <div className="bg-white border border-app-border rounded-lg p-4 space-y-3">
        <div className="font-medium text-sm">Add New Account</div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Account label *  (e.g. Axis SB – Ops)"
            value={form.account_name}
            onChange={f("account_name")}
          />
          <Input
            placeholder="Account number *"
            value={form.account_number}
            onChange={f("account_number")}
          />
          <Input
            placeholder="IFSC code *"
            value={form.ifsc_code}
            onChange={(e) =>
              setForm((p) => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))
            }
          />
          <Input
            placeholder="Bank name  (optional)"
            value={form.bank_name}
            onChange={f("bank_name")}
          />
        </div>
        <Button onClick={save} disabled={saving} className="bg-app-navy text-white">
          <Plus className="h-4 w-4 mr-1" /> Add Account
        </Button>
      </div>

      {/* Accounts table */}
      <div className="bg-white border border-app-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-app-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Account No</th>
              <th className="px-3 py-2">IFSC</th>
              <th className="px-3 py-2">Bank</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground text-sm">
                  No accounts added yet
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id} className="border-t border-app-border">
                <td className="px-3 py-2 font-medium">{a.account_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.account_number}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.ifsc_code}</td>
                <td className="px-3 py-2 text-muted-foreground">{a.bank_name ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => toggleActive(a.id, a.is_active)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant="outline"
                      className={
                        a.is_active
                          ? "border-green-400 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                          : "border-gray-300 text-gray-500 cursor-pointer hover:bg-gray-50"
                      }
                    >
                      {a.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
