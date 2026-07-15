-- ============================================================================
-- CRM: Lead Capture + Pipeline
-- Applied: 2026-07-15 to both sandbox and production
-- ============================================================================

-- ============================================================================
-- 1. website_lead_submissions — raw audit table (public anon INSERT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.website_lead_submissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  payload           JSONB       NOT NULL DEFAULT '{}',
  validation_status TEXT        NOT NULL DEFAULT 'received',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.website_lead_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_website_leads"  ON public.website_lead_submissions;
DROP POLICY IF EXISTS "auth_read_website_leads"    ON public.website_lead_submissions;

CREATE POLICY "anon_insert_website_leads"
  ON public.website_lead_submissions FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_read_website_leads"
  ON public.website_lead_submissions FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 2. crm_closure_reasons — master data
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_closure_reasons (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_type TEXT    NOT NULL CHECK (closure_type IN ('positive', 'negative')),
  reason_name  TEXT    NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_closure_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_closure_reasons"   ON public.crm_closure_reasons;
DROP POLICY IF EXISTS "ceo_manage_closure_reasons"  ON public.crm_closure_reasons;

CREATE POLICY "auth_read_closure_reasons"
  ON public.crm_closure_reasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "ceo_manage_closure_reasons"
  ON public.crm_closure_reasons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'ceo_admin'));

-- ============================================================================
-- 3. crm_leads — core lead entity
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number            TEXT        NOT NULL UNIQUE,
  source                 TEXT        NOT NULL DEFAULT 'manual'
                           CHECK (source IN ('website','manual','referral','call','walk_in','existing_client','other')),
  status                 TEXT        NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','contacted','qualified','site_visit_planned',
                                             'proposal_pending','quotation_submitted','negotiation',
                                             'on_hold','won','lost','closed')),
  priority               TEXT        NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low','medium','high','urgent')),

  -- Contact
  company_name           TEXT        NOT NULL DEFAULT '',
  contact_person_name    TEXT        NOT NULL DEFAULT '',
  contact_designation    TEXT,
  phone                  TEXT        NOT NULL DEFAULT '',
  alternate_phone        TEXT,
  email                  TEXT,
  location               TEXT,
  address                TEXT,
  preferred_contact_mode TEXT        CHECK (preferred_contact_mode IN ('call','email','whatsapp','visit')),

  -- Requirement
  requirement_category   TEXT        CHECK (requirement_category IN ('security_guards','aso','housekeeping','other')),
  no_of_guards           INTEGER,
  requirement_notes      TEXT,
  expected_business_value NUMERIC(12,2),

  -- Ownership
  assigned_to_user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timelines
  first_response_due_at  TIMESTAMPTZ,
  next_followup_at       TIMESTAMPTZ,
  expected_closure_date  DATE,

  -- Closure
  closure_type           TEXT        CHECK (closure_type IN ('positive','negative')),
  closure_reason_id      UUID        REFERENCES public.crm_closure_reasons(id),
  closure_summary        TEXT,
  closure_date           DATE,
  lost_to_competitor     TEXT,
  closure_price_issue    BOOLEAN,
  closure_no_response    BOOLEAN,
  closure_client_dropped BOOLEAN,
  closure_scope_mismatch BOOLEAN,

  -- Source linkage
  website_submission_id  UUID        REFERENCES public.website_lead_submissions(id),

  -- Standard flags
  is_sandbox             BOOLEAN     NOT NULL DEFAULT false,
  is_deleted             BOOLEAN     NOT NULL DEFAULT false,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_leads_sandbox    ON public.crm_leads (is_sandbox, is_deleted);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status     ON public.crm_leads (status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned   ON public.crm_leads (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created    ON public.crm_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_followup   ON public.crm_leads (next_followup_at);

DROP POLICY IF EXISTS "auth_read_crm_leads"   ON public.crm_leads;
DROP POLICY IF EXISTS "auth_insert_crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "auth_update_crm_leads" ON public.crm_leads;

CREATE POLICY "auth_read_crm_leads"
  ON public.crm_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_crm_leads"
  ON public.crm_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_crm_leads"
  ON public.crm_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. crm_lead_activities — immutable timeline
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_activities (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID        NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  activity_type     TEXT        NOT NULL
                      CHECK (activity_type IN (
                        'lead_created','lead_imported','status_changed','assignment_changed',
                        'call_made','email_sent','whatsapp','meeting','site_visit',
                        'quotation_added','quotation_submitted','followup_scheduled',
                        'note','reminder','closure'
                      )),
  activity_datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes             TEXT,
  outcome           TEXT,
  next_action       TEXT,
  next_followup_at  TIMESTAMPTZ,
  contact_mode      TEXT,
  is_internal       BOOLEAN     NOT NULL DEFAULT false,
  created_by_user_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
  is_deleted        BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON public.crm_lead_activities (lead_id, created_at DESC);

DROP POLICY IF EXISTS "auth_read_crm_activities"   ON public.crm_lead_activities;
DROP POLICY IF EXISTS "auth_insert_crm_activities" ON public.crm_lead_activities;
DROP POLICY IF EXISTS "auth_update_crm_activities" ON public.crm_lead_activities;

CREATE POLICY "auth_read_crm_activities"
  ON public.crm_lead_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_crm_activities"
  ON public.crm_lead_activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_crm_activities"
  ON public.crm_lead_activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. crm_lead_quotations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_lead_quotations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID        NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  quotation_number  TEXT,
  quotation_date    DATE        NOT NULL DEFAULT CURRENT_DATE,
  value             NUMERIC(12,2),
  summary           TEXT,
  status            TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','submitted','revised','approved','rejected')),
  remarks           TEXT,
  created_by_user_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
  is_deleted        BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_lead_quotations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_crm_quotations_lead ON public.crm_lead_quotations (lead_id);

DROP POLICY IF EXISTS "auth_read_crm_quotations"   ON public.crm_lead_quotations;
DROP POLICY IF EXISTS "auth_insert_crm_quotations" ON public.crm_lead_quotations;
DROP POLICY IF EXISTS "auth_update_crm_quotations" ON public.crm_lead_quotations;

CREATE POLICY "auth_read_crm_quotations"
  ON public.crm_lead_quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_crm_quotations"
  ON public.crm_lead_quotations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_crm_quotations"
  ON public.crm_lead_quotations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. Lead number generation
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.crm_lead_seq START 1;

CREATE OR REPLACE FUNCTION public.gen_lead_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year TEXT := to_char(now(), 'YYYY');
  _seq  BIGINT := nextval('public.crm_lead_seq');
BEGIN
  RETURN 'LEAD-' || _year || '-' || lpad(_seq::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.gen_lead_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_lead_number() TO anon;

-- ============================================================================
-- 7. updated_at trigger (create function only if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_crm_leads_updated_at      ON public.crm_leads;
DROP TRIGGER IF EXISTS trg_crm_quotations_updated_at ON public.crm_lead_quotations;

CREATE TRIGGER trg_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_crm_quotations_updated_at
  BEFORE UPDATE ON public.crm_lead_quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. Website submission → lead (SECURITY DEFINER trigger)
-- ============================================================================
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

  -- Normalize category value
  _cat := CASE _payload->>'requirement_category'
    WHEN 'Security Guards' THEN 'security_guards'
    WHEN 'ASO'             THEN 'aso'
    WHEN 'Housekeeping'    THEN 'housekeeping'
    ELSE LOWER(REPLACE(COALESCE(_payload->>'requirement_category', 'other'), ' ', '_'))
  END;

  INSERT INTO public.crm_leads (
    lead_number, source, status, priority,
    company_name, contact_person_name, phone, email, location,
    requirement_category, no_of_guards, requirement_notes, preferred_contact_mode,
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
    CASE WHEN (_payload->>'no_of_guards') ~ '^\d+$' THEN (_payload->>'no_of_guards')::INTEGER ELSE NULL END,
    NULLIF(TRIM(COALESCE(_payload->>'requirement_notes', '')), ''),
    NULLIF(LOWER(_payload->>'preferred_contact_mode'), ''),
    now() + interval '4 hours',
    now() + interval '4 hours',
    NEW.id, false
  ) RETURNING id INTO _lead_id;

  INSERT INTO public.crm_lead_activities (
    lead_id, activity_type, activity_datetime, notes
  ) VALUES (
    _lead_id, 'lead_imported', now(),
    'Lead captured from website. Contact: ' ||
      COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
      CASE WHEN (_payload->>'company_name') IS NOT NULL AND (_payload->>'company_name') <> ''
           THEN ' (' || (_payload->>'company_name') || ')' ELSE '' END ||
      '. Phone: ' || COALESCE(_payload->>'phone', '—') ||
      '. Requirement: ' || COALESCE(_payload->>'requirement_category', 'Not specified')
  );

  -- Notify all ceo_admin users
  FOR _rec IN SELECT user_id FROM public.user_roles WHERE role = 'ceo_admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
      _rec.user_id,
      'New Website Lead: ' || COALESCE(NULLIF(TRIM(_payload->>'company_name'), ''), 'Unknown Company'),
      _lead_number || ' · ' ||
        COALESCE(NULLIF(TRIM(_payload->>'contact_person_name'), ''), 'Unknown') ||
        ' · ' || COALESCE(_payload->>'phone', '') ||
        ' · ' || COALESCE(_payload->>'requirement_category', '—'),
      'crm_new_lead',
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_website_submission_to_lead ON public.website_lead_submissions;

CREATE TRIGGER trg_website_submission_to_lead
  AFTER INSERT ON public.website_lead_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_website_submission_to_lead();

-- ============================================================================
-- 9. Seed: crm_closure_reasons (skip if already seeded)
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_closure_reasons LIMIT 1) THEN
    INSERT INTO public.crm_closure_reasons (closure_type, reason_name, sort_order) VALUES
      ('positive', 'Full requirement confirmed',        1),
      ('positive', 'Partial win - reduced scope',       2),
      ('positive', 'Trial deployment to be expanded',   3),
      ('negative', 'Price too high',                    1),
      ('negative', 'Chose competitor',                  2),
      ('negative', 'Requirement cancelled by client',   3),
      ('negative', 'No response from client',           4),
      ('negative', 'Out of service area',               5),
      ('negative', 'Scope mismatch',                    6),
      ('negative', 'Budget not approved',               7),
      ('negative', 'Delay in decision making',          8),
      ('negative', 'Client went in-house',              9),
      ('negative', 'Other',                            10);
  END IF;
END $$;

-- ============================================================================
-- 10. role_permissions for CRM screens
-- ============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'ceo_admin'  AND screen_name = 'crm_leads') THEN
    INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export)
    VALUES ('ceo_admin', 'crm_leads', true, true, true, true, true, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'ceo_admin'  AND screen_name = 'crm_dashboard') THEN
    INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export)
    VALUES ('ceo_admin', 'crm_dashboard', true, false, false, false, false, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'coo_ops'    AND screen_name = 'crm_leads') THEN
    INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export)
    VALUES ('coo_ops', 'crm_leads', true, true, true, false, false, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'coo_ops'    AND screen_name = 'crm_dashboard') THEN
    INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export)
    VALUES ('coo_ops', 'crm_dashboard', true, false, false, false, false, false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'accountant' AND screen_name = 'crm_leads') THEN
    INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export)
    VALUES ('accountant', 'crm_leads', true, false, false, false, false, false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = 'accountant' AND screen_name = 'crm_dashboard') THEN
    INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export)
    VALUES ('accountant', 'crm_dashboard', true, false, false, false, false, false);
  END IF;
END $$;
