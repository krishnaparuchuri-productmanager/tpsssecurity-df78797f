-- Website enquiry -> CRM lead: one lead per submission, in the current environment only.
-- Before: production also inserted a second, sandbox-flagged copy of every lead, and
-- the "New Website Lead" alert went to ceo_admin only (production has no ceo_admin,
-- so nobody was alerted). Same function body in both projects now.

CREATE OR REPLACE FUNCTION public.fn_website_submission_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _lead_id     UUID;
  _lead_number TEXT;
  _payload     JSONB := NEW.payload;
  _sandbox     BOOLEAN := public.is_sandbox_env();
  _rec         RECORD;
  _cat         TEXT;
BEGIN
  _lead_number := gen_lead_number();

  _cat := CASE LOWER(COALESCE(_payload->>'requirement_category', ''))
    WHEN 'security'     THEN 'security'
    WHEN 'housekeeping' THEN 'housekeeping'
    ELSE 'other'
  END;

  INSERT INTO public.crm_leads (
    lead_number, source, status, priority,
    company_name, contact_person_name, phone, email, location,
    requirement_category, requirement_notes, preferred_contact_mode,
    first_response_due_at, next_followup_at,
    website_submission_id, is_sandbox
  ) VALUES (
    _lead_number, 'website', 'new', 'medium',
    COALESCE(NULLIF(TRIM(_payload->>'company_name'), ''), ''),
    COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), ''),
    COALESCE(NULLIF(TRIM(_payload->>'phone'), ''), ''),
    NULLIF(TRIM(COALESCE(_payload->>'email', '')), ''),
    NULLIF(TRIM(COALESCE(_payload->>'location', '')), ''),
    _cat,
    NULLIF(TRIM(COALESCE(_payload->>'requirement_notes', '')), ''),
    NULLIF(LOWER(_payload->>'preferred_contact_mode'), ''),
    now() + interval '4 hours', now() + interval '4 hours',
    NEW.id, _sandbox
  ) RETURNING id INTO _lead_id;

  INSERT INTO public.crm_lead_activities (lead_id, activity_type, activity_datetime, notes)
  VALUES (_lead_id, 'lead_imported', now(),
    CASE WHEN _sandbox THEN '[SANDBOX] ' ELSE '' END ||
    'Lead captured from website. Contact: ' ||
    COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
    CASE WHEN (_payload->>'company_name') IS NOT NULL AND (_payload->>'company_name') <> ''
         THEN ' (' || (_payload->>'company_name') || ')' ELSE '' END ||
    '. Phone: ' || COALESCE(_payload->>'phone', '—') ||
    '. Requirement: ' || COALESCE(_payload->>'requirement_category', 'Not specified'));

  -- Alert every active Super Admin and CEO once (same audience as a manually created lead)
  FOR _rec IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role IN ('super_admin', 'ceo_admin') AND public.is_active_user(ur.user_id)
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read, related_record_id, is_sandbox)
    VALUES (
      _rec.user_id,
      'New Website Lead: ' || COALESCE(NULLIF(TRIM(_payload->>'company_name'), ''), 'Unknown Company'),
      _lead_number || ' · ' ||
        COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
        ' · ' || COALESCE(_payload->>'phone', '') ||
        ' · ' || COALESCE(_payload->>'requirement_category', '—'),
      'crm_new_lead', false, _lead_id, _sandbox
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Trigger function: never callable directly through the API
REVOKE EXECUTE ON FUNCTION public.fn_website_submission_to_lead() FROM PUBLIC, anon, authenticated;
