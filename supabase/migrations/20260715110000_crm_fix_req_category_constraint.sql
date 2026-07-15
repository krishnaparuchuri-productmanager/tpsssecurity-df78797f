-- Fix requirement_category CHECK to match simplified frontend options (security/housekeeping/other)
-- Applied to sandbox 2026-07-15
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_requirement_category_check;
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_requirement_category_check
  CHECK (requirement_category IN ('security','housekeeping','other'));

-- Update trigger to use new normalized values
CREATE OR REPLACE FUNCTION public.fn_website_submission_to_lead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lead_id     UUID;
  _lead_number TEXT;
  _payload     JSONB := NEW.payload;
  _rec         RECORD;
  _cat         TEXT;
BEGIN
  _lead_number := gen_lead_number();
  _cat := CASE LOWER(COALESCE(_payload->>'requirement_category', ''))
    WHEN 'security'      THEN 'security'
    WHEN 'housekeeping'  THEN 'housekeeping'
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
    NEW.id, false
  ) RETURNING id INTO _lead_id;
  INSERT INTO public.crm_lead_activities (lead_id, activity_type, activity_datetime, notes)
  VALUES (_lead_id, 'lead_imported', now(),
    'Lead captured from website. Contact: ' ||
      COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
      CASE WHEN (_payload->>'company_name') IS NOT NULL AND (_payload->>'company_name') <> ''
           THEN ' (' || (_payload->>'company_name') || ')' ELSE '' END ||
      '. Phone: ' || COALESCE(_payload->>'phone', '—') ||
      '. Requirement: ' || COALESCE(_payload->>'requirement_category', 'Not specified'));
  FOR _rec IN SELECT user_id FROM public.user_roles WHERE role = 'ceo_admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (_rec.user_id,
      'New Website Lead: ' || COALESCE(NULLIF(TRIM(_payload->>'company_name'), ''), 'Unknown Company'),
      _lead_number || ' · ' || COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
        ' · ' || COALESCE(_payload->>'phone', '') || ' · ' || COALESCE(_payload->>'requirement_category', '—'),
      'crm_new_lead', false);
  END LOOP;
  RETURN NEW;
END;
$$;
