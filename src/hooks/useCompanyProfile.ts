import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyProfile {
  company_name: string;
  registered_address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  gst_number: string | null;
  pan_number: string | null;
  pf_code: string | null;
  esi_code: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  iso_certification: string | null;
  invoice_location_code: string | null;
  jurisdiction: string | null;
}

// Module-level cache — one DB call per browser session
let _cache: Promise<CompanyProfile | null> | null = null;

function fetchProfile() {
  if (!_cache) {
    _cache = supabase
      .from("company_profile")
      .select("*")
      .maybeSingle()
      .then(({ data }) => data as CompanyProfile | null);
  }
  return _cache;
}

export function useCompanyProfile(): CompanyProfile | null {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  useEffect(() => { fetchProfile().then(setProfile); }, []);
  return profile;
}

export function invalidateCompanyProfileCache() {
  _cache = null;
}
