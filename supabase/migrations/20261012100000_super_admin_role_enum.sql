-- Super Admin role (1/2): add the enum value.
-- Kept in its own migration because a new enum value cannot be used in the
-- same transaction that adds it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
