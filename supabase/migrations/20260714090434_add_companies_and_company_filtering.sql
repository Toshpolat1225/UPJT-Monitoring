/*
# Add Companies directory and company-level data isolation

## Overview
Adds a new `companies` master-data table. Every department is linked to a
company, and every non-admin user is linked to a company via their profile.
Non-admin users can only see data belonging to their company.

## New Tables
1. `companies` — Company directory (short_name, full_name).

## Modified Tables
1. `departments` — added `company_id UUID` FK to `companies`.
2. `profiles` — added `company_id UUID` FK to `companies`.

## New Functions
1. `current_user_company()` — returns the company_id of the current user.

## Security (RLS)
- Company-level filtering on departments, sections, vehicles, monthly_limits,
  daily_entries, and profiles for non-admin users.
- Admin sees all companies.
*/

-- ============================================================
-- 1. COMPANIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read companies" ON public.companies;
CREATE POLICY "Auth read companies" ON public.companies FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin write companies" ON public.companies;
CREATE POLICY "Admin write companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 2. ADD company_id TO DEPARTMENTS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 3. ADD company_id TO PROFILES
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. current_user_company() FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_company()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_company() TO authenticated;

-- ============================================================
-- 5. SEED DEFAULT COMPANY + ASSIGN EXISTING DEPARTMENTS
-- ============================================================

INSERT INTO public.companies (short_name, full_name)
VALUES ('GENERAL', 'General Company')
ON CONFLICT DO NOTHING;

UPDATE public.departments
SET company_id = (SELECT id FROM public.companies WHERE short_name = 'GENERAL' LIMIT 1)
WHERE company_id IS NULL;

-- ============================================================
-- 6. UPDATE RLS POLICIES FOR COMPANY-LEVEL FILTERING
-- ============================================================

-- DEPARTMENTS
DROP POLICY IF EXISTS "Auth read departments" ON public.departments;
CREATE POLICY "Auth read departments" ON public.departments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR company_id = public.current_user_company()
  );

DROP POLICY IF EXISTS "Admin write departments" ON public.departments;
CREATE POLICY "Admin write departments" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SECTIONS
DROP POLICY IF EXISTS "Auth read sections" ON public.sections;
CREATE POLICY "Auth read sections" ON public.sections FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = sections.department_id
      AND d.company_id = public.current_user_company()
    )
  );

DROP POLICY IF EXISTS "Admin write sections" ON public.sections;
CREATE POLICY "Admin write sections" ON public.sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- VEHICLES
DROP POLICY IF EXISTS "Auth read vehicles" ON public.vehicles;
CREATE POLICY "Auth read vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = vehicles.department_id
      AND d.company_id = public.current_user_company()
    )
  );

DROP POLICY IF EXISTS "Admin write vehicles" ON public.vehicles;
CREATE POLICY "Admin write vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- MONTHLY_LIMITS
DROP POLICY IF EXISTS "Auth read limits" ON public.monthly_limits;
CREATE POLICY "Auth read limits" ON public.monthly_limits FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = monthly_limits.department_id
      AND d.company_id = public.current_user_company()
    )
  );

-- DAILY_ENTRIES
DROP POLICY IF EXISTS "Auth read entries" ON public.daily_entries;
CREATE POLICY "Auth read entries" ON public.daily_entries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = daily_entries.department_id
      AND d.company_id = public.current_user_company()
    )
  );

-- PROFILES
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR company_id = public.current_user_company()
  );