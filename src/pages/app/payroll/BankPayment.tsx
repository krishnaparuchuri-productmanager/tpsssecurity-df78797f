import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { Download, RefreshCw, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

interface TpssAccount {
  id: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string | null;
}

interface PayEmployee {
  paysheet_employee_id: string;
  employee_id: string;
  employee_name: string;
  designation: string;
  final_net_salary: number;
  amount_paid: number;
  payment_status: string;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  mobile: string | null;
}

interface ClientGroup {
  paysheet_id: string;
  client_id: string;
  client_name: string;
  employees: PayEmployee[];
}

interface Selection {
  mode: "full" | "partial";
  amount: number;
  paymentId: "N" | "R" | "I";
}

function inferPayId(ifsc: string | null): "N" | "I" {
  return (ifsc ?? "").toUpperCase().startsWith("UTIB") ? "I" : "N";
}

function draftKey(isSandbox: boolean, monthDate: string) {
  return `bpay_draft_${isSandbox ? "sb" : "prod"}_${monthDate}`;
}

export default function BankPayment() {
  const { isSandbox } = useEnvironment();
  const { user } = useAuth();

  type PsMeta = {
    id: string;
    client_id: string;
    month: string;
    month_date: string;
    clients: { client_name: string } | null;
  };

  const [paysheetMeta, setPaysheetMeta] = useState<PsMeta[]>([]);
  const [selectedMonthDate, setSelectedMonthDate] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [tpssAccounts, setTpssAccounts] = useState<TpssAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: accounts }] = await Promise.all([
        supabase
          .from("paysheets")
          .select("id, client_id, month, month_date, clients(client_name)")
          .eq("status", "approved")
          .eq("is_sandbox", isSandbox)
          .eq("is_deleted", false)
          .lte("month_date", today)
          .order("month_date", { ascending: false }),
        (supabase as any)
          .from("tpss_bank_accounts")
          .select("id, account_name, account_number, ifsc_code, bank_name")
          .eq("is_active", true)
          .order("account_name"),
      ]);
      setPaysheetMeta((ps ?? []) as PsMeta[]);
      setTpssAccounts((accounts ?? []) as TpssAccount[]);
    })();
  }, [isSandbox]);

  // Distinct months, most-recent first
  const availableMonths: Array<[string, string]> = [
    ...new Map(paysheetMeta.map((p) => [p.month_date, p.month])).entries(),
  ].sort((a, b) => b[0].localeCompare(a[0]));

  // Distinct clients for selected month
  const availableClients = paysheetMeta
    .filter((p) => p.month_date === selectedMonthDate)
    .map((p) => ({ id: p.client_id, name: p.clients?.client_name ?? "" }))
    .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i);

  function handleMonthChange(md: string) {
    setSelectedMonthDate(md);
    setSelectedClientIds([]);
    setClientGroups([]);
    setLoaded(false);
    // Restore draft if any
    try {
      const raw = localStorage.getItem(draftKey(isSandbox, md));
      setSelections(raw ? JSON.parse(raw) : {});
    } catch {
      setSelections({});
    }
  }

  function toggleClient(id: string) {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Persist draft whenever selections change
  useEffect(() => {
    if (!selectedMonthDate) return;
    if (Object.keys(selections).length > 0) {
      localStorage.setItem(draftKey(isSandbox, selectedMonthDate), JSON.stringify(selections));
    }
  }, [selections, selectedMonthDate, isSandbox]);

  async function loadEmployees() {
    if (!selectedMonthDate || selectedClientIds.length === 0) {
      toast.error("Select a month and at least one client");
      return;
    }
    setLoading(true);
    const paysheetIds = paysheetMeta
      .filter(
        (p) =>
          p.month_date === selectedMonthDate && selectedClientIds.includes(p.client_id)
      )
      .map((p) => p.id);

    const { data: empData, error } = await (supabase as any)
      .from("paysheet_employees")
      .select(
        "id, paysheet_id, employee_id, employee_name, designation, final_net_salary, amount_paid, payment_status, employee:employees(bank_account_number, bank_ifsc, mobile)"
      )
      .in("paysheet_id", paysheetIds)
      .not("employee_id", "is", null)
      .order("employee_name");

    setLoading(false);
    if (error) { toast.error(error.message); return; }

    const psMap = Object.fromEntries(paysheetMeta.map((p) => [p.id, p]));
    const groups: ClientGroup[] = [];

    for (const pe of empData ?? []) {
      const ps = psMap[pe.paysheet_id];
      if (!ps) continue;
      let group = groups.find((g) => g.paysheet_id === pe.paysheet_id);
      if (!group) {
        group = {
          paysheet_id: pe.paysheet_id,
          client_id: ps.client_id,
          client_name: ps.clients?.client_name ?? "",
          employees: [],
        };
        groups.push(group);
      }
      group.employees.push({
        paysheet_employee_id: pe.id,
        employee_id: pe.employee_id,
        employee_name: pe.employee_name,
        designation: pe.designation,
        final_net_salary: Number(pe.final_net_salary ?? 0),
        amount_paid: Number(pe.amount_paid ?? 0),
        payment_status: pe.payment_status ?? "unpaid",
        bank_account_number: pe.employee?.bank_account_number ?? null,
        bank_ifsc: pe.employee?.bank_ifsc ?? null,
        mobile: pe.employee?.mobile ?? null,
      });
    }
    setClientGroups(groups);
    setLoaded(true);
  }

  function setSel(
    peId: string,
    emp: PayEmployee,
    mode: "full" | "partial",
    amount?: number,
    pid?: "N" | "R" | "I"
  ) {
    const balance = emp.final_net_salary - emp.amount_paid;
    const amt = mode === "full" ? balance : Math.min(amount ?? 0, balance);
    const pId = pid ?? selections[peId]?.paymentId ?? inferPayId(emp.bank_ifsc);
    setSelections((prev) => ({
      ...prev,
      [peId]: { mode, amount: Math.max(0, amt), paymentId: pId },
    }));
  }

  function clearSel(peId: string) {
    setSelections((prev) => {
      const n = { ...prev };
      delete n[peId];
      return n;
    });
  }

  function selectAllFull() {
    const next: Record<string, Selection> = {};
    for (const g of clientGroups) {
      for (const e of g.employees) {
        if (e.payment_status === "paid") continue;
        const balance = e.final_net_salary - e.amount_paid;
        if (balance <= 0) continue;
        next[e.paysheet_employee_id] = {
          mode: "full",
          amount: balance,
          paymentId: inferPayId(e.bank_ifsc),
        };
      }
    }
    setSelections(next);
  }

  function clearAll() {
    setSelections({});
    localStorage.removeItem(draftKey(isSandbox, selectedMonthDate));
  }

  const totalSelected = Object.values(selections).reduce(
    (s, sel) => s + (sel.amount || 0),
    0
  );
  const selectedCount = Object.values(selections).filter((s) => s.amount > 0).length;
  const selectedAccount = tpssAccounts.find((a) => a.id === selectedAccountId);

  async function finaliseAndGenerate() {
    if (!selectedAccountId) { toast.error("Select a TPSS debit account"); return; }
    if (selectedCount === 0) { toast.error("Select at least one employee for payment"); return; }

    setGenerating(true);
    try {
      const selectedMonth =
        availableMonths.find(([md]) => md === selectedMonthDate)?.[1] ?? selectedMonthDate;

      // Build lookup map
      const empMap: Record<string, { emp: PayEmployee; group: ClientGroup }> = {};
      for (const g of clientGroups) {
        for (const e of g.employees) {
          empMap[e.paysheet_employee_id] = { emp: e, group: g };
        }
      }

      const payRows: Record<string, string | number>[] = [];
      const dbRecords: Record<string, unknown>[] = [];
      const now = new Date();

      for (const [peId, sel] of Object.entries(selections)) {
        if (!sel.amount) continue;
        const entry = empMap[peId];
        if (!entry) continue;
        const { emp, group } = entry;

        payRows.push({
          "Payment Identifier": sel.paymentId,
          Salary: sel.amount,
          "Salary Credit Date": now.toLocaleDateString("en-IN"),
          "Beneficiary Name": emp.employee_name,
          "Account Number": emp.bank_account_number ?? "",
          "Debit Account Number": selectedAccount!.account_number,
          "Transaction Serial Number": "",
          "IFSC Code": emp.bank_ifsc ?? "",
          "Account Type": "10",
          "Contact Number": emp.mobile ?? "",
        });

        dbRecords.push({
          paysheet_id: group.paysheet_id,
          paysheet_employee_id: peId,
          employee_id: emp.employee_id,
          employee_name: emp.employee_name,
          client_id: group.client_id,
          client_name: group.client_name,
          month: selectedMonth,
          net_payable: emp.final_net_salary,
          amount_paid_prior: emp.amount_paid,
          amount_in_batch: sel.amount,
          payment_identifier: sel.paymentId,
          bank_account_number: emp.bank_account_number,
          bank_ifsc: emp.bank_ifsc,
          is_sandbox: isSandbox,
        });
      }

      // Download Excel
      const ts = now
        .toISOString()
        .replace(/[-:.TZ]/g, "")
        .slice(0, 15);
      const ws = XLSX.utils.json_to_sheet(payRows);

      // Set column widths
      ws["!cols"] = [
        { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 30 },
        { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 16 },
      ];

      // Sandbox watermark row
      if (isSandbox) {
        XLSX.utils.sheet_add_aoa(ws, [["*** SANDBOX — NOT FOR REAL PAYMENT ***"]], {
          origin: { r: payRows.length + 2, c: 0 },
        });
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Payment");
      const monthTag = selectedMonth.replace(/\s+/g, "_");
      XLSX.writeFile(wb, `TPSS_BankPayment_${monthTag}_${ts}.xlsx`);

      // Insert batch record
      const clientNames = [...new Set(dbRecords.map((r: any) => r.client_name))].join(", ");
      const batchNum = `${isSandbox ? "SB-" : ""}BATCH-${now
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

      const { data: batch, error: batchErr } = await (supabase as any)
        .from("bank_payment_batches")
        .insert({
          batch_number: batchNum,
          month: selectedMonth,
          month_date: selectedMonthDate,
          client_names: clientNames,
          debit_account_id: selectedAccountId,
          debit_account_number: selectedAccount!.account_number,
          total_employees: selectedCount,
          total_amount: totalSelected,
          generated_by: user?.id,
          is_sandbox: isSandbox,
        })
        .select("id")
        .single();

      if (batchErr) throw batchErr;

      // Insert per-employee records
      const recordsWithBatch = dbRecords.map((r: any) => ({ ...r, batch_id: batch.id }));
      const { error: recErr } = await (supabase as any)
        .from("bank_payment_records")
        .insert(recordsWithBatch);
      if (recErr) throw recErr;

      // Update paysheet_employees payment status
      for (const [peId, sel] of Object.entries(selections)) {
        if (!sel.amount) continue;
        const entry = empMap[peId];
        if (!entry) continue;
        const { emp } = entry;
        const newPaid = emp.amount_paid + sel.amount;
        const newStatus = newPaid >= emp.final_net_salary ? "paid" : "partial";
        await (supabase as any)
          .from("paysheet_employees")
          .update({ amount_paid: newPaid, payment_status: newStatus })
          .eq("id", peId);
      }

      // Clear draft
      localStorage.removeItem(draftKey(isSandbox, selectedMonthDate));
      setSelections({});
      toast.success(`Batch ${batchNum} recorded. Excel downloaded.`);
      // Reload to reflect updated statuses
      await loadEmployees();
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-app-navy">Bank Payment</h1>
        {tpssAccounts.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No TPSS bank accounts configured.{" "}
            <Link to="/app/admin/tpss-accounts" className="underline font-medium">
              Add one here →
            </Link>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white border border-app-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Month</div>
            <Select value={selectedMonthDate} onValueChange={handleMonthChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an approved month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(([md, m]) => (
                  <SelectItem key={md} value={md}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMonthDate && availableClients.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Clients ({availableClients.length} with approved paysheets)
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                {availableClients.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
                  >
                    <Checkbox
                      checked={selectedClientIds.includes(c.id)}
                      onCheckedChange={() => toggleClient(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={loadEmployees}
            disabled={loading || !selectedMonthDate || selectedClientIds.length === 0}
            className="bg-app-navy text-white"
          >
            {loading ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : null}
            Load Employees
          </Button>
          {loaded && (
            <>
              <Button variant="outline" size="sm" onClick={selectAllFull}>
                Select All (Full Pay)
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Employee table by client group */}
      {loaded &&
        clientGroups.map((g) => {
          const groupTotal = g.employees.reduce(
            (s, e) => s + (selections[e.paysheet_employee_id]?.amount ?? 0),
            0
          );
          return (
            <div
              key={g.paysheet_id}
              className="bg-white border border-app-border rounded-lg overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-app-border flex items-center justify-between bg-app-surface">
                <div className="font-semibold text-app-navy text-sm">{g.client_name}</div>
                <div className="text-xs text-muted-foreground">
                  {g.employees.length} employees
                  {groupTotal > 0 && (
                    <span className="ml-2 text-app-navy font-medium">
                      Selected: {formatINR(groupTotal)}
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-app-surface/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Designation</th>
                      <th className="px-3 py-2 text-right">Net Payable</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Payment</th>
                      <th className="px-3 py-2 text-center w-20">Type</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.employees.map((e) => {
                      const balance = e.final_net_salary - e.amount_paid;
                      const isPaid = e.payment_status === "paid" || balance <= 0;
                      const sel = selections[e.paysheet_employee_id];

                      return (
                        <tr
                          key={e.paysheet_employee_id}
                          className={`border-t border-app-border ${isPaid ? "opacity-40" : ""}`}
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium text-xs leading-tight">
                              {e.employee_name}
                            </div>
                            {!e.bank_account_number && (
                              <div className="text-[10px] text-red-500 mt-0.5">
                                No bank account
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {e.designation}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">
                            {formatINR(e.final_net_salary)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">
                            {e.amount_paid > 0 ? formatINR(e.amount_paid) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">
                            {formatINR(balance)}
                          </td>
                          <td className="px-3 py-2">
                            {isPaid ? (
                              <span className="text-xs text-muted-foreground">Fully paid</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                                  <Checkbox
                                    checked={sel?.mode === "full"}
                                    onCheckedChange={(v) =>
                                      v
                                        ? setSel(e.paysheet_employee_id, e, "full")
                                        : clearSel(e.paysheet_employee_id)
                                    }
                                  />
                                  Full
                                </label>
                                <Input
                                  type="number"
                                  className="h-7 text-xs w-24 px-2"
                                  placeholder="Partial ₹"
                                  min={1}
                                  max={balance}
                                  value={
                                    sel?.mode === "partial" && sel.amount > 0
                                      ? sel.amount
                                      : ""
                                  }
                                  onChange={(ev) => {
                                    const v = Number(ev.target.value);
                                    if (v > 0) setSel(e.paysheet_employee_id, e, "partial", v);
                                    else clearSel(e.paysheet_employee_id);
                                  }}
                                />
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {!isPaid && sel && sel.amount > 0 ? (
                              <Select
                                value={sel.paymentId}
                                onValueChange={(v) =>
                                  setSelections((prev) => ({
                                    ...prev,
                                    [e.paysheet_employee_id]: {
                                      ...prev[e.paysheet_employee_id],
                                      paymentId: v as "N" | "R" | "I",
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="h-7 w-16 text-xs px-2">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="N">N — NEFT</SelectItem>
                                  <SelectItem value="R">R — RTGS</SelectItem>
                                  <SelectItem value="I">I — Intra</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                e.payment_status === "paid"
                                  ? "border-green-400 text-green-700 bg-green-50"
                                  : e.payment_status === "partial"
                                  ? "border-amber-400 text-amber-700 bg-amber-50"
                                  : "border-gray-300 text-gray-500"
                              }`}
                            >
                              {e.payment_status === "unpaid"
                                ? "Unpaid"
                                : e.payment_status === "partial"
                                ? "Partial"
                                : "Paid"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

      {/* Finalise bar */}
      {loaded && (
        <div className="bg-white border border-app-border rounded-lg p-4 flex items-center justify-between flex-wrap gap-4 sticky bottom-4 shadow-lg">
          <div>
            <div className="text-xs text-muted-foreground">
              {selectedCount} employee{selectedCount !== 1 ? "s" : ""} selected
            </div>
            <div className="text-xl font-bold text-app-navy tabular-nums">
              {formatINR(totalSelected)}
            </div>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Debit Account (TPSS)</div>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="min-w-[220px]">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {tpssAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} · {a.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={finaliseAndGenerate}
              disabled={generating || selectedCount === 0 || !selectedAccountId}
              className="bg-app-navy text-white"
            >
              {generating ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              Finalise & Generate Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
