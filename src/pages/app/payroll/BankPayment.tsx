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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatINR, formatDate } from "@/lib/format";
import { Download, RefreshCw, AlertCircle, Clock, History } from "lucide-react";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

// ── Shared types ──────────────────────────────────────────────────────────────

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

// ── Utilities ─────────────────────────────────────────────────────────────────

function inferPayId(ifsc: string | null): "N" | "I" {
  return (ifsc ?? "").toUpperCase().startsWith("UTIB") ? "I" : "N";
}

function draftKey(isSandbox: boolean, monthDate: string) {
  return `bpay_draft_${isSandbox ? "sb" : "prod"}_${monthDate}`;
}

function buildPaymentExcel(
  rows: Record<string, string | number>[],
  monthTag: string,
  isSandbox: boolean,
  ts: string
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 30 },
    { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 16 },
  ];
  if (isSandbox) {
    XLSX.utils.sheet_add_aoa(ws, [["*** SANDBOX — NOT FOR REAL PAYMENT ***"]], {
      origin: { r: rows.length + 2, c: 0 },
    });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payment");
  XLSX.writeFile(wb, `TPSS_BankPayment_${monthTag}_${ts}.xlsx`);
}

// ── Status badge helper ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "border-green-400 text-green-700 bg-green-50"
      : status === "partial"
      ? "border-amber-400 text-amber-700 bg-amber-50"
      : "border-gray-300 text-gray-500";
  const label =
    status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Unpaid";
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {label}
    </Badge>
  );
}

// ── NEW PAYMENT TAB ───────────────────────────────────────────────────────────

function NewPaymentTab({ tpssAccounts }: { tpssAccounts: TpssAccount[] }) {
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
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    supabase
      .from("paysheets")
      .select("id, client_id, month, month_date, clients(client_name)")
      .eq("status", "approved")
      .eq("is_sandbox", isSandbox)
      .eq("is_deleted", false)
      .lte("month_date", today)
      .order("month_date", { ascending: false })
      .then(({ data }) => setPaysheetMeta((data ?? []) as PsMeta[]));
  }, [isSandbox]);

  const availableMonths: Array<[string, string]> = [
    ...new Map(paysheetMeta.map((p) => [p.month_date, p.month])).entries(),
  ].sort((a, b) => b[0].localeCompare(a[0]));

  const availableClients = paysheetMeta
    .filter((p) => p.month_date === selectedMonthDate)
    .map((p) => ({ id: p.client_id, name: p.clients?.client_name ?? "" }))
    .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i);

  function handleMonthChange(md: string) {
    setSelectedMonthDate(md);
    setSelectedClientIds([]);
    setClientGroups([]);
    setLoaded(false);
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

  useEffect(() => {
    if (!selectedMonthDate || Object.keys(selections).length === 0) return;
    localStorage.setItem(draftKey(isSandbox, selectedMonthDate), JSON.stringify(selections));
  }, [selections, selectedMonthDate, isSandbox]);

  async function loadEmployees() {
    if (!selectedMonthDate || selectedClientIds.length === 0) {
      toast.error("Select a month and at least one client");
      return;
    }
    setLoading(true);
    const paysheetIds = paysheetMeta
      .filter((p) => p.month_date === selectedMonthDate && selectedClientIds.includes(p.client_id))
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
    amount?: number
  ) {
    const balance = emp.final_net_salary - emp.amount_paid;
    const amt = mode === "full" ? balance : Math.min(amount ?? 0, balance);
    const pId = selections[peId]?.paymentId ?? inferPayId(emp.bank_ifsc);
    setSelections((prev) => ({
      ...prev,
      [peId]: { mode, amount: Math.max(0, amt), paymentId: pId },
    }));
  }

  function clearSel(peId: string) {
    setSelections((prev) => { const n = { ...prev }; delete n[peId]; return n; });
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

  const totalSelected = Object.values(selections).reduce((s, sel) => s + (sel.amount || 0), 0);
  const selectedCount = Object.values(selections).filter((s) => s.amount > 0).length;
  const selectedAccount = tpssAccounts.find((a) => a.id === selectedAccountId);

  async function finaliseAndGenerate() {
    if (!selectedAccountId) { toast.error("Select a TPSS debit account"); return; }
    if (selectedCount === 0) { toast.error("Select at least one employee for payment"); return; }
    setGenerating(true);
    try {
      const selectedMonth =
        availableMonths.find(([md]) => md === selectedMonthDate)?.[1] ?? selectedMonthDate;

      const empMap: Record<string, { emp: PayEmployee; group: ClientGroup }> = {};
      for (const g of clientGroups) {
        for (const e of g.employees) empMap[e.paysheet_employee_id] = { emp: e, group: g };
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

      const ts = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
      const monthTag = selectedMonth.replace(/\s+/g, "_");
      buildPaymentExcel(payRows, monthTag, isSandbox, ts);

      const clientNames = [...new Set(dbRecords.map((r: any) => r.client_name))].join(", ");
      const batchNum = `${isSandbox ? "SB-" : ""}BATCH-${now
        .toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

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

      const recordsWithBatch = dbRecords.map((r: any) => ({ ...r, batch_id: batch.id }));
      const { error: recErr } = await (supabase as any)
        .from("bank_payment_records")
        .insert(recordsWithBatch);
      if (recErr) throw recErr;

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

      localStorage.removeItem(draftKey(isSandbox, selectedMonthDate));
      setSelections({});
      toast.success(`Batch ${batchNum} recorded. Excel downloaded.`);
      await loadEmployees();
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4 pt-4">
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
                  <SelectItem key={md} value={md}>{m}</SelectItem>
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
                  <label key={c.id} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
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
            {loading && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
            Load Employees
          </Button>
          {loaded && (
            <>
              <Button variant="outline" size="sm" onClick={selectAllFull}>Select All (Full Pay)</Button>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">Clear All</Button>
            </>
          )}
        </div>
      </div>

      {/* Employee tables by client */}
      {loaded && clientGroups.map((g) => {
        const groupTotal = g.employees.reduce(
          (s, e) => s + (selections[e.paysheet_employee_id]?.amount ?? 0), 0
        );
        return (
          <div key={g.paysheet_id} className="bg-white border border-app-border rounded-lg overflow-hidden">
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
                      <tr key={e.paysheet_employee_id} className={`border-t border-app-border ${isPaid ? "opacity-40" : ""}`}>
                        <td className="px-3 py-2">
                          <div className="font-medium text-xs leading-tight">{e.employee_name}</div>
                          {!e.bank_account_number && (
                            <div className="text-[10px] text-red-500 mt-0.5">No bank account</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{e.designation}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{formatINR(e.final_net_salary)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">
                          {e.amount_paid > 0 ? formatINR(e.amount_paid) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{formatINR(balance)}</td>
                        <td className="px-3 py-2">
                          {isPaid ? (
                            <span className="text-xs text-muted-foreground">Fully paid</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                                <Checkbox
                                  checked={sel?.mode === "full"}
                                  onCheckedChange={(v) =>
                                    v ? setSel(e.paysheet_employee_id, e, "full") : clearSel(e.paysheet_employee_id)
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
                                value={sel?.mode === "partial" && sel.amount > 0 ? sel.amount : ""}
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
                          <StatusBadge status={e.payment_status} />
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
            <div className="text-xl font-bold text-app-navy tabular-nums">{formatINR(totalSelected)}</div>
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

// ── PENDING PAYMENTS TAB ──────────────────────────────────────────────────────

interface PendingRow {
  paysheet_employee_id: string;
  paysheet_id: string;
  employee_name: string;
  designation: string;
  final_net_salary: number;
  amount_paid: number;
  payment_status: string;
  client_id: string;
  client_name: string;
  month: string;
  month_date: string;
  bank_account_number: string | null;
}

function PendingTab() {
  const { isSandbox } = useEnvironment();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: sheets } = await supabase
        .from("paysheets")
        .select("id, client_id, month, month_date, clients(client_name)")
        .eq("status", "approved")
        .eq("is_sandbox", isSandbox)
        .eq("is_deleted", false);

      if (!sheets || sheets.length === 0) { setLoading(false); return; }

      const sheetIds = sheets.map((s: any) => s.id);
      const sheetMap = Object.fromEntries(sheets.map((s: any) => [s.id, s]));

      const { data: emps } = await (supabase as any)
        .from("paysheet_employees")
        .select(
          "id, paysheet_id, employee_name, designation, final_net_salary, amount_paid, payment_status, employee:employees(bank_account_number)"
        )
        .in("paysheet_id", sheetIds)
        .neq("payment_status", "paid")
        .not("employee_id", "is", null)
        .order("employee_name");

      const pending: PendingRow[] = (emps ?? [])
        .filter((e: any) => Number(e.final_net_salary) > Number(e.amount_paid ?? 0))
        .map((e: any) => {
          const ps = sheetMap[e.paysheet_id];
          return {
            paysheet_employee_id: e.id,
            paysheet_id: e.paysheet_id,
            employee_name: e.employee_name,
            designation: e.designation,
            final_net_salary: Number(e.final_net_salary),
            amount_paid: Number(e.amount_paid ?? 0),
            payment_status: e.payment_status ?? "unpaid",
            client_id: ps.client_id,
            client_name: ps.clients?.client_name ?? "",
            month: ps.month,
            month_date: ps.month_date,
            bank_account_number: e.employee?.bank_account_number ?? null,
          };
        });

      setRows(pending);
      setLoading(false);
    })();
  }, [isSandbox]);

  // Distinct months in pending data
  const months = [
    ...new Map(rows.map((r) => [r.month_date, r.month])).entries(),
  ].sort((a, b) => b[0].localeCompare(a[0]));

  const filtered = monthFilter === "all" ? rows : rows.filter((r) => r.month_date === monthFilter);

  // Group by client_name
  const byClient: Record<string, PendingRow[]> = {};
  for (const r of filtered) {
    if (!byClient[r.client_name]) byClient[r.client_name] = [];
    byClient[r.client_name].push(r);
  }

  const totalOutstanding = filtered.reduce(
    (s, r) => s + r.final_net_salary - r.amount_paid, 0
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-semibold text-app-navy">
            {filtered.length} employee{filtered.length !== 1 ? "s" : ""} with outstanding balance
          </div>
          {filtered.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Total outstanding: <span className="font-semibold text-app-navy">{formatINR(totalOutstanding)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">Filter by month:</div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {months.map(([md, m]) => (
                <SelectItem key={md} value={md}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setLoading(true)} className="text-muted-foreground"
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            // Force re-fetch via effect when isSandbox changes; this just shows spinner
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div className="bg-white border border-app-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No outstanding payments
          {monthFilter !== "all" ? " for the selected month" : ""}.
        </div>
      )}

      {!loading && Object.entries(byClient).sort(([a], [b]) => a.localeCompare(b)).map(([clientName, emps]) => {
        const clientOutstanding = emps.reduce((s, e) => s + e.final_net_salary - e.amount_paid, 0);
        return (
          <div key={clientName} className="bg-white border border-app-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-app-border flex items-center justify-between bg-app-surface">
              <div className="font-semibold text-app-navy text-sm">{clientName}</div>
              <div className="text-xs text-muted-foreground">
                {emps.length} pending · Outstanding: {" "}
                <span className="font-medium text-amber-700">{formatINR(clientOutstanding)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-app-surface/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2 text-right">Net Payable</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emps.map((e) => (
                    <tr key={e.paysheet_employee_id} className="border-t border-app-border">
                      <td className="px-3 py-2">
                        <div className="font-medium text-xs">{e.employee_name}</div>
                        <div className="text-[10px] text-muted-foreground">{e.designation}</div>
                        {!e.bank_account_number && (
                          <div className="text-[10px] text-red-500">No bank account</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{e.month}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">{formatINR(e.final_net_salary)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs">
                        {e.amount_paid > 0 ? formatINR(e.amount_paid) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold text-amber-700">
                        {formatINR(e.final_net_salary - e.amount_paid)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={e.payment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PAYMENT HISTORY TAB ───────────────────────────────────────────────────────

interface Batch {
  id: string;
  batch_number: string;
  month: string;
  month_date: string;
  client_names: string | null;
  debit_account_number: string | null;
  total_employees: number;
  total_amount: number;
  is_sandbox: boolean;
  created_at: string;
}

function HistoryTab() {
  const { isSandbox } = useEnvironment();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bank_payment_batches")
      .select("id, batch_number, month, month_date, client_names, debit_account_number, total_employees, total_amount, is_sandbox, created_at")
      .eq("is_sandbox", isSandbox)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setBatches(data ?? []);
  }

  useEffect(() => { load(); }, [isSandbox]);

  const months = [
    ...new Map(batches.map((b) => [b.month_date, b.month])).entries(),
  ].sort((a, b) => b[0].localeCompare(a[0]));

  const filtered = monthFilter === "all" ? batches : batches.filter((b) => b.month_date === monthFilter);

  async function reDownload(batch: Batch) {
    setDownloading(batch.id);
    try {
      const { data: records, error } = await (supabase as any)
        .from("bank_payment_records")
        .select("payment_identifier, amount_in_batch, employee_name, bank_account_number, bank_ifsc, employee:employees!employee_id(mobile)")
        .eq("batch_id", batch.id)
        .order("employee_name");

      if (error) throw error;

      const rows: Record<string, string | number>[] = (records ?? []).map((r: any) => ({
        "Payment Identifier": r.payment_identifier,
        Salary: Number(r.amount_in_batch),
        "Salary Credit Date": new Date(batch.created_at).toLocaleDateString("en-IN"),
        "Beneficiary Name": r.employee_name,
        "Account Number": r.bank_account_number ?? "",
        "Debit Account Number": batch.debit_account_number ?? "",
        "Transaction Serial Number": "",
        "IFSC Code": r.bank_ifsc ?? "",
        "Account Type": "10",
        "Contact Number": r.employee?.mobile ?? "",
      }));

      const ts = new Date(batch.created_at).toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
      const monthTag = batch.month.replace(/\s+/g, "_");
      buildPaymentExcel(rows, monthTag, batch.is_sandbox, ts);
      toast.success(`Downloaded ${batch.batch_number}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="font-semibold text-app-navy">{filtered.length} batch{filtered.length !== 1 ? "es" : ""}</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">Filter by month:</div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {months.map(([md, m]) => (
                <SelectItem key={md} value={md}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={load} className="text-muted-foreground">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div className="bg-white border border-app-border rounded-lg p-8 text-center text-muted-foreground text-sm">
          No payment batches found.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white border border-app-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-app-surface text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Batch #</th>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">Clients</th>
                <th className="px-3 py-2 text-center">Emps</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Debit Acct</th>
                <th className="px-3 py-2">Generated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-app-border hover:bg-app-surface/40 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs font-medium">{b.batch_number}</td>
                  <td className="px-3 py-2 text-xs">{b.month}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate">
                    {b.client_names ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">{b.total_employees}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">
                    {formatINR(b.total_amount)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {b.debit_account_number ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(b.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={downloading === b.id}
                      onClick={() => reDownload(b)}
                    >
                      {downloading === b.id ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      Excel
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── MAIN WRAPPER ──────────────────────────────────────────────────────────────

export default function BankPayment() {
  const { isSandbox } = useEnvironment();
  const [tpssAccounts, setTpssAccounts] = useState<TpssAccount[]>([]);

  useEffect(() => {
    (supabase as any)
      .from("tpss_bank_accounts")
      .select("id, account_name, account_number, ifsc_code, bank_name")
      .eq("is_active", true)
      .order("account_name")
      .then(({ data }: { data: TpssAccount[] | null }) =>
        setTpssAccounts(data ?? [])
      );
  }, [isSandbox]);

  return (
    <div className="space-y-3">
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

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new" className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> New Payment
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Pending
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <NewPaymentTab tpssAccounts={tpssAccounts} />
        </TabsContent>
        <TabsContent value="pending">
          <PendingTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
