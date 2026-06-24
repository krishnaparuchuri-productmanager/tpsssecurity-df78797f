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
  logo_url?: string | null;
  logoBase64?: string | null;
}

export async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function getCompanyHeader(): Promise<CompanyHeader> {
  const { data } = await supabase
    .from("company_profile")
    .select("company_name, registered_address, gst_number, pan_number, phone, email, iso_certification, logo_url")
    .maybeSingle();
  const header: CompanyHeader = (data as CompanyHeader) ?? { company_name: "Trinetra Professional Security Services" };
  if (header.logo_url) {
    header.logoBase64 = await fetchImageBase64(header.logo_url);
  }
  return header;
}

export function drawLetterhead(doc: jsPDF, header: CompanyHeader, title: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const hasLogo = !!header.logoBase64;

  if (hasLogo) {
    try { doc.addImage(header.logoBase64!, "PNG", 14, 4, 18, 18); } catch { /* skip logo on error */ }
  }

  const textX = hasLogo ? 38 : pageW / 2;
  const align: "left" | "center" = hasLogo ? "left" : "center";
  const maxWidth = hasLogo ? pageW - 38 - 14 : undefined;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(10, 22, 40);
  doc.text(header.company_name, textX, 12, { align });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  let y = hasLogo ? 18 : 22;
  if (header.registered_address) {
    doc.text(header.registered_address, textX, y, { align, maxWidth });
    y += 4;
  }
  const meta: string[] = [];
  if (header.gst_number) meta.push(`GSTIN: ${header.gst_number}`);
  if (header.pan_number) meta.push(`PAN: ${header.pan_number}`);
  if (header.iso_certification) meta.push(header.iso_certification);
  if (meta.length) { doc.text(meta.join("  •  "), textX, y, { align, maxWidth }); y += 4; }
  const contact: string[] = [];
  if (header.phone) contact.push(header.phone);
  if (header.email) contact.push(header.email);
  if (contact.length) { doc.text(contact.join("  •  "), textX, y, { align, maxWidth }); y += 4; }

  if (hasLogo) y = Math.max(y, 24);

  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.6);
  doc.line(14, y + 2, 196, y + 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(10, 22, 40);
  doc.text(title, pageW / 2, y + 9, { align: "center" });

  return y + 14;
}

export function drawWatermark(doc: jsPDF, _companyName: string, isSandbox: boolean) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.setTextColor(90, 90, 90);
  doc.text("TPSSSECURITY", pw / 2, ph / 2, { align: "center", angle: 45 });
  if (isSandbox) {
    doc.setFontSize(40);
    doc.setTextColor(200, 0, 0);
    doc.text("SANDBOX", pw / 2, ph / 2 + 25, { align: "center", angle: 45 });
  }

  doc.restoreGraphicsState();
}

export { jsPDF, autoTable };
