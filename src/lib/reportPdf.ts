import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyHeader {
  company_name: string;
  registered_address?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  phone?: string | null;
  email?: string | null;
  iso_certification?: string | null;
}

export async function getCompanyHeader(): Promise<CompanyHeader> {
  const { data } = await supabase
    .from("company_profile")
    .select("company_name, registered_address, gst_number, pan_number, phone, email, iso_certification")
    .maybeSingle();
  return (data as CompanyHeader) ?? { company_name: "Trinetra Professional Security Services" };
}

export function drawLetterhead(doc: jsPDF, header: CompanyHeader, title: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(10, 22, 40);
  doc.text(header.company_name, 105, 16, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  let y = 22;
  if (header.registered_address) { doc.text(header.registered_address, 105, y, { align: "center" }); y += 4; }
  const meta: string[] = [];
  if (header.gst_number) meta.push(`GSTIN: ${header.gst_number}`);
  if (header.pan_number) meta.push(`PAN: ${header.pan_number}`);
  if (header.iso_certification) meta.push(header.iso_certification);
  if (meta.length) { doc.text(meta.join("  •  "), 105, y, { align: "center" }); y += 4; }
  const contact: string[] = [];
  if (header.phone) contact.push(header.phone);
  if (header.email) contact.push(header.email);
  if (contact.length) { doc.text(contact.join("  •  "), 105, y, { align: "center" }); y += 4; }

  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.6);
  doc.line(14, y + 2, 196, y + 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(10, 22, 40);
  doc.text(title, 105, y + 9, { align: "center" });

  return y + 14;
}

export function drawWatermark(doc: jsPDF, companyName: string, isSandbox: boolean) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(52);
  doc.setTextColor(237, 237, 237);
  doc.text(companyName.toUpperCase(), pw / 2, ph / 2, { align: "center", angle: 45 });
  if (isSandbox) {
    doc.setFontSize(62);
    doc.setTextColor(255, 218, 218);
    doc.text("SANDBOX", pw / 2, ph / 2 + 30, { align: "center", angle: 45 });
  }
}

export { jsPDF, autoTable };
