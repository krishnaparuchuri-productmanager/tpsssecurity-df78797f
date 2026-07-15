-- Website form submissions now create two leads per enquiry:
--   is_sandbox = false  → live production pipeline
--   is_sandbox = true   → sandbox mirror for testing
-- Applied to production only (sandbox uses its own DB).

CREATE OR REPLACE FUNCTION public.fn_website_submission_to_lead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lead_id_prod UUID;
  _lead_id_sb   UUID;
  _lead_num_prod TEXT;
  _lead_num_sb   TEXT;
  _payload       JSONB := NEW.payload;
  _rec           RECORD;
  _cat           TEXT;
BEGIN
  _cat := CASE LOWER(COALESCE(_payload->>'requirement_category', ''))
    WHEN 'security'     THEN 'security'
    WHEN 'housekeeping' THEN 'housekeeping'
    ELSE 'other'
  END;

  _lead_num_prod := gen_lead_number();
  INSERT INTO public.crm_leads (
    lead_number, source, status, priority,
    company_name, contact_person_name, phone, email, location,
    requirement_category, requirement_notes, preferred_contact_mode,
    first_response_due_at, next_followup_at, website_submission_id, is_sandbox
  ) VALUES (
    _lead_num_prod, 'website', 'new', 'medium',
    COALESCE(NULLIF(TRIM(_payload->>'company_name'), ''), ''),
    COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), ''),
    COALESCE(NULLIF(TRIM(_payload->>'phone'), ''), ''),
    NULLIF(TRIM(COALESCE(_payload->>'email', '')), ''),
    NULLIF(TRIM(COALESCE(_payload->>'location', '')), ''),
    _cat, NULLIF(TRIM(COALESCE(_payload->>'requirement_notes', '')), ''),
    NULLIF(LOWER(_payload->>'preferred_contact_mode'), ''),
    now() + interval '4 hours', now() + interval '4 hours', NEW.id, false
  ) RETURNING id INTO _lead_id_prod;

  INSERT INTO public.crm_lead_activities (lead_id, activity_type, activity_datetime, notes)
  VALUES (_lead_id_prod, 'lead_imported', now(),
    'Lead captured from website. Contact: ' ||
    COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
    CASE WHEN (_payload->>'company_name') IS NOT NULL AND (_payload->>'company_name') <> ''
         THEN ' (' || (_payload->>'company_name') || ')' ELSE '' END ||
    '. Phone: ' || COALESCE(_payload->>'phone', '—') ||
    '. Requirement: ' || COALESCE(_payload->>'requirement_category', 'Not specified'));

  _lead_num_sb := gen_lead_number();
  INSERT INTO public.crm_leads (
    lead_number, source, status, priority,
    company_name, contact_person_name, phone, email, location,
    requirement_category, requirement_notes, preferred_contact_mode,
    first_response_due_at, next_followup_at, website_submission_id, is_sandbox
  ) VALUES (
    _lead_num_sb, 'website', 'new', 'medium',
    COALESCE(NULLIF(TRIM(_payload->>'company_name'), ''), ''),
    COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), ''),
    COALESCE(NULLIF(TRIM(_payload->>'phone'), ''), ''),
    NULLIF(TRIM(COALESCE(_payload->>'email', '')), ''),
    NULLIF(TRIM(COALESCE(_payload->>'location', '')), ''),
    _cat, NULLIF(TRIM(COALESCE(_payload->>'requirement_notes', '')), ''),
    NULLIF(LOWER(_payload->>'preferred_contact_mode'), ''),
    now() + interval '4 hours', now() + interval '4 hours', NEW.id, true
  ) RETURNING id INTO _lead_id_sb;

  INSERT INTO public.crm_lead_activities (lead_id, activity_type, activity_datetime, notes)
  VALUES (_lead_id_sb, 'lead_imported', now(),
    '[SANDBOX] Lead captured from website. Contact: ' ||
    COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
    CASE WHEN (_payload->>'company_name') IS NOT NULL AND (_payload->>'company_name') <> ''
         THEN ' (' || (_payload->>'company_name') || ')' ELSE '' END ||
    '. Phone: ' || COALESCE(_payload->>'phone', '—') ||
    '. Requirement: ' || COALESCE(_payload->>'requirement_category', 'Not specified'));

  FOR _rec IN SELECT user_id FROM public.user_roles WHERE role = 'ceo_admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (_rec.user_id,
      'New Website Lead: ' || COALESCE(NULLIF(TRIM(_payload->>'company_name'), ''), 'Unknown Company'),
      _lead_num_prod || ' · ' ||
        COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
        ' · ' || COALESCE(_payload->>'phone', '') ||
        ' · ' || COALESCE(_payload->>'requirement_category', '—'),
      'crm_new_lead', false);
  END LOOP;

  RETURN NEW;
END;
$$;
