/**
 * jspdf-autotable hook: right-align amounts in a table's total (foot) row.
 * columnStyles only apply to body cells, so totals otherwise sit left-aligned
 * under right-aligned columns. Usage: autoTable(doc, { ..., didParseCell: alignFootAmounts }).
 */
export function alignFootAmounts(data: { section: string; cell: { raw: unknown; styles: { halign?: string } } }) {
  if (data.section !== "foot") return;
  const text = String(data.cell.raw ?? "").trim();
  if (/^(Rs\.?\s*|₹\s*)?-?[\d,]+(\.\d+)?$/.test(text)) data.cell.styles.halign = "right";
}
