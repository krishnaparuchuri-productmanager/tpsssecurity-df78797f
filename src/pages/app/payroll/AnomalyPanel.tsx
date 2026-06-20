import { XCircle, CheckCircle2 } from "lucide-react";
import { AnomalyLevel, computeAnomalies, PaysheetEmpRow } from "@/lib/calc";

const ANOMALY_LABEL: Record<string, string> = {
  missing_uan: "Missing UAN number",
  missing_esi: "Missing ESI (ESI applicable)",
  zero_wages: "Zero earned wages",
  duties_exceed: "Duties exceed working days",
  esi_exempt: "ESI wages above ₹21,000 (exempt)",
  new_joiner: "New joiner this month",
};

const ANOMALY_GUIDANCE: Record<string, string> = {
  missing_uan: "Add UAN in employee master before submitting",
  missing_esi: "Add ESI number in employee master",
  zero_wages: "Enter duties or confirm employee was absent / on leave",
  duties_exceed: "Verify duty count — should not exceed working days",
  esi_exempt: "Confirm — employee is ESI-exempt this month (wages > ₹21,000)",
  new_joiner: "No action needed — first paysheet for this employee",
};

const LEVEL_ORDER: Record<AnomalyLevel, number> = { red: 0, yellow: 1, blue: 2 };

interface GroupData { level: AnomalyLevel; code: string; rowIndices: number[] }

function GroupColumn({ title, dotCls, countCls, pillCls, groups }: {
  title: string; dotCls: string; countCls: string; pillCls: string; groups: GroupData[];
}) {
  const count = groups.reduce((s, g) => s + g.rowIndices.length, 0);
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
        <span className="text-xs font-medium text-app-muted">{title}</span>
      </div>
      <div className={`text-2xl font-semibold mb-2 tabular-nums ${countCls}`}>{count}</div>
      {groups.length === 0 ? (
        <div className="flex items-center gap-1 text-xs text-app-muted">
          <CheckCircle2 className="h-3 w-3 text-green-500" /> None
        </div>
      ) : groups.map(g => (
        <div key={g.code} className="flex items-center justify-between mb-1 gap-2">
          <span className="text-xs text-app-muted truncate">{ANOMALY_LABEL[g.code] ?? g.code}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${pillCls}`}>{g.rowIndices.length}</span>
        </div>
      ))}
    </div>
  );
}

export function AnomalyPanel({ rows }: { rows: PaysheetEmpRow[] }) {
  const allFlags = rows.map((r, idx) => ({ idx, row: r, flags: computeAnomalies(r) }));
  const rowsWithFlags = allFlags.filter(x => x.flags.length > 0);

  const groupMap = new Map<string, GroupData>();
  allFlags.forEach(({ idx, flags }) => {
    flags.forEach((a) => {
      if (!groupMap.has(a.code)) groupMap.set(a.code, { level: a.level, code: a.code, rowIndices: [] });
      groupMap.get(a.code)!.rowIndices.push(idx);
    });
  });

  const groups = Array.from(groupMap.values()).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  const redGroups = groups.filter(g => g.level === "red");
  const yellowGroups = groups.filter(g => g.level === "yellow");
  const blueGroups = groups.filter(g => g.level === "blue");
  const redCount = redGroups.reduce((s, g) => s + g.rowIndices.length, 0);
  const totalCount = groups.reduce((s, g) => s + g.rowIndices.length, 0);

  const drillDown = rowsWithFlags
    .map(({ idx, row, flags }) => {
      const sorted = [...flags].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
      return { idx, row, sorted, worstLevel: sorted[0]?.level ?? "blue" as AnomalyLevel };
    })
    .sort((a, b) => LEVEL_ORDER[a.worstLevel] - LEVEL_ORDER[b.worstLevel]);

  if (totalCount === 0) return null;

  return (
    <div className="border border-app-border rounded-lg overflow-hidden text-sm">
      <div className="bg-app-surface px-4 py-2.5 flex items-center gap-2 border-b border-app-border">
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="font-medium">
          {totalCount} anomal{totalCount === 1 ? "y" : "ies"} across {rowsWithFlags.length} employee{rowsWithFlags.length !== 1 ? "s" : ""} — review before submitting
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-app-border border-b border-app-border">
        <GroupColumn title="Blockers — must fix" dotCls="bg-red-500" countCls="text-red-500" pillCls="bg-red-50 text-red-800" groups={redGroups} />
        <GroupColumn title="Warnings — review & confirm" dotCls="bg-amber-500" countCls="text-amber-500" pillCls="bg-amber-50 text-amber-800" groups={yellowGroups} />
        <GroupColumn title="Info — no action needed" dotCls="bg-blue-500" countCls="text-blue-500" pillCls="bg-blue-50 text-blue-800" groups={blueGroups} />
      </div>

      {redCount > 0 && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center gap-2">
          <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-xs text-red-800">
            Submit is blocked until {redCount} blocker{redCount !== 1 ? "s are" : " is"} resolved. Warnings can be acknowledged and submitted.
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-app-surface text-left border-b border-app-border text-app-muted">
              <th className="px-3 py-2 font-medium w-8">#</th>
              <th className="px-3 py-2 font-medium">Employee</th>
              <th className="px-3 py-2 font-medium">Issues</th>
              <th className="px-3 py-2 font-medium">What to do</th>
            </tr>
          </thead>
          <tbody>
            {drillDown.map(({ idx, row, sorted, worstLevel }) => {
              const borderCls = worstLevel === "red"
                ? "border-l-4 border-l-red-500 bg-red-50/40"
                : worstLevel === "yellow"
                  ? "border-l-4 border-l-amber-400 bg-amber-50/40"
                  : "border-l-4 border-l-blue-400";
              const guidance = sorted.map(f => ANOMALY_GUIDANCE[f.code]).filter(Boolean).join(" • ");
              return (
                <tr key={idx} className={`border-b border-app-border last:border-0 ${borderCls}`}>
                  <td className="px-3 py-2 text-app-muted">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">{row.employee_name || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {sorted.map(f => (
                        <span key={f.code} className={`inline-flex px-2 py-0.5 rounded-full font-medium ${
                          f.level === "red" ? "bg-red-50 text-red-800" : f.level === "yellow" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"
                        }`}>
                          {ANOMALY_LABEL[f.code] ?? f.message}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-app-muted">{guidance}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
