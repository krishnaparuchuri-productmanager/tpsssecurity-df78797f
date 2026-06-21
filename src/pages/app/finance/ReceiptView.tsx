import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import tpssLogo from "@/assets/tpss-logo-portal.jpg";
import { formatDate, formatINR } from "@/lib/format";

export default function ReceiptView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [r, setR] = useState<{
    receipt_number: string; payment_date: string; amount: number; payment_mode: string;
    reference_number: string | null; bank_name: string | null;
    clients: { client_name: string } | null;
    invoices: { invoice_number: string; outstanding_amount: number } | null;
  } | null>(null);
  const [company, setCompany] = useState<{ company_name: string; registered_address: string | null;
    phone: string | null; email: string | null; logo_url: string | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from("payments")
          .select("receipt_number, payment_date, amount, payment_mode, reference_number, bank_name, clients(client_name), invoices(invoice_number, outstanding_amount)")
          .eq("id", id).maybeSingle(),
        supabase.from("company_profile").select("company_name, registered_address, phone, email, logo_url").maybeSingle(),
      ]);
      setR(p as unknown as typeof r);
      setCompany(c as unknown as typeof company);
    })();
  }, [id]);

  if (!r || !company) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold text-app-navy">{r.receipt_number}</h1>
        <Button className="ml-auto" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
      </div>

      <div className="bg-white border-2 border-app-navy rounded-lg p-6">
        <div className="border-b-2 pb-2 flex items-center gap-3">
          {company.logo_url ? (
            <img src={company.logo_url} alt="company logo" className="h-12 w-auto object-contain flex-shrink-0" />
          ) : (
            <img src={tpssLogo} alt="company logo" className="h-12 w-auto object-contain flex-shrink-0" />
          )}
          <div className="text-center flex-1">
            <div className="text-xl font-bold text-app-navy">{company.company_name}</div>
            <div className="text-xs">{company.registered_address}</div>
            <div className="text-xs">{company.phone} | {company.email}</div>
          </div>
        </div>
        <h2 className="text-center text-lg font-bold mt-4">PAYMENT RECEIPT</h2>
        <hr className="my-2" />
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><strong>Receipt No:</strong> {r.receipt_number}</div>
          <div><strong>Date:</strong> {formatDate(r.payment_date)}</div>
        </div>
        <hr className="my-2" />
        <div className="space-y-1 text-sm">
          <div><strong>Received From:</strong> {r.clients?.client_name}</div>
          <div><strong>Against Invoice:</strong> {r.invoices?.invoice_number}</div>
          <div><strong>Payment Mode:</strong> {r.payment_mode}</div>
          <div><strong>Reference:</strong> {r.reference_number ?? "—"}</div>
          {r.bank_name && <div><strong>Bank:</strong> {r.bank_name}</div>}
        </div>
        <hr className="my-2" />
        <div className="text-lg font-bold">Amount Received: {formatINR(Number(r.amount))}</div>
        <hr className="my-2" />
        <div className="text-sm">Outstanding Balance: {formatINR(Number(r.invoices?.outstanding_amount ?? 0))}</div>
        <div className="mt-8 text-right text-xs">
          <div>For {company.company_name}</div>
          <div className="mt-6 text-app-muted">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}
