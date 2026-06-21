import * as XLSX from "xlsx";

export interface BrandingInfo {
  company_name: string;
  registered_address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export function addExcelBranding(ws: XLSX.WorkSheet, company: BrandingInfo): void {
  const headerRows = [
    [company.company_name ?? ""],
    [company.registered_address ?? ""],
    [`Tel: ${company.phone ?? ""} | Email: ${company.email ?? ""}`],
    [""],
  ];
  const shift = headerRows.length;

  // Shift existing cells down
  const shifted: Record<string, unknown> = {};
  for (const addr in ws) {
    if (addr.startsWith("!")) continue;
    const cell = XLSX.utils.decode_cell(addr);
    shifted[XLSX.utils.encode_cell({ r: cell.r + shift, c: cell.c })] = ws[addr as keyof XLSX.WorkSheet];
  }

  // Write branding rows
  headerRows.forEach((row, ri) => {
    row.forEach((val, ci) => {
      shifted[XLSX.utils.encode_cell({ r: ri, c: ci })] = { t: "s", v: String(val) };
    });
  });

  // Extend !ref
  const oldRange = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  shifted["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: oldRange.e.r + shift, c: oldRange.e.c },
  });

  if (ws["!cols"]) shifted["!cols"] = ws["!cols"];
  if (ws["!merges"]) {
    shifted["!merges"] = (ws["!merges"] as XLSX.Range[]).map((m) => ({
      s: { r: m.s.r + shift, c: m.s.c },
      e: { r: m.e.r + shift, c: m.e.c },
    }));
  }

  // Replace sheet contents in-place
  for (const key in ws) delete (ws as Record<string, unknown>)[key];
  Object.assign(ws, shifted);
}
