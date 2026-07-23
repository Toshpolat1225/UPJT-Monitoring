/*
# Fuel & Transport Monitoring System Schema

## Overview
Replaces the old STTB railway maintenance schema with a complete fuel consumption
monitoring system for railway enterprises. Tracks daily fuel entries (diesel,
petrol, SPG) by department/section/vehicle against monthly limits, with full
audit logging and role-based access control.

## Enums
- `app_role`: admin, gsm, operator, master, management
- `fuel_unit`: litr, m3

## New Tables
1. `departments` — organisational units. `is_total` flags the
   roll-up "UPJT" row. Uzbek-only: name_uz.
2. `sections` — subdivisions within a department.
3. `fuel_types` — diesel, petrol, SPG. Has a unit (litr or m3).
4. `vehicles` — transport units assigned to a department + fuel type.
5. `profiles` — one-to-one with auth.users. Stores full_name, email, department.
6. `user_roles` — many-to-many: a user can hold multiple roles.
7. `monthly_limits` — limit per department × (optional section) × fuel type × year/month.
8. `daily_entries` — daily fuel record per vehicle: opening_balance, received_azs,
   transfer_in, transfer_out, consumption, closing_balance. Unique per
   (entry_date, vehicle_id, fuel_type_id).
9. `audit_log` — server-side audit trail of all changes.
10. `role_permissions` — granular permission matrix: role × module × action.

## Functions
- `has_role(uid, role)` — RLS helper to check if a user has a given role.
- `current_user_department()` — returns the department_id of the current user.
- `handle_new_user()` — auto-creates a profile row on signup (no default role).
- `set_updated_at()` — trigger function for updated_at columns.
- `log_daily_entry_changes()` — server-side audit trigger for daily_entries.

## Security (RLS)
- All tables have RLS enabled.
- Master data: all authenticated read; admin writes.
- Profiles: users read/update own; admin all.
- User roles: users read own; admin manages all.
- Monthly limits: all read; admin/gsm write; admin delete.
- Daily entries: all read; admin/gsm/operator insert/update; master own dept only; admin delete.
- Audit log: admin/gsm/operator read; INSERT via trigger only.
- Role permissions: all read; admin write.
*/

-- ============================================================
-- DROP OLD TABLES
-- ============================================================
DROP TABLE IF EXISTS public.daily_entries CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_profile() CASCADE;

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','gsm','operator','master','management');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fuel_unit') THEN
    CREATE TYPE public.fuel_unit AS ENUM ('litr','m3');
  END IF;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_uz TEXT NOT NULL DEFAULT '',
  is_total BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_uz TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fuel_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_uz TEXT NOT NULL DEFAULT '',
  unit public.fuel_unit NOT NULL DEFAULT 'litr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_uz TEXT NOT NULL DEFAULT '',
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  fuel_type_id UUID NOT NULL REFERENCES public.fuel_types(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.monthly_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  fuel_type_id UUID NOT NULL REFERENCES public.fuel_types(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  limit_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_limits_unique
  ON public.monthly_limits (department_id, COALESCE(section_id, '00000000-0000-0000-0000-000000000000'), fuel_type_id, year, month);

CREATE TABLE IF NOT EXISTS public.daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  fuel_type_id UUID NOT NULL REFERENCES public.fuel_types(id) ON DELETE RESTRICT,
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  received_azs NUMERIC(14,2) NOT NULL DEFAULT 0,
  transfer_in NUMERIC(14,2) NOT NULL DEFAULT 0,
  transfer_out NUMERIC(14,2) NOT NULL DEFAULT 0,
  consumption NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_date, vehicle_id, fuel_type_id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module TEXT NOT NULL,
  permission TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (role, module, permission)
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.log_daily_entry_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log(user_id, action, table_name, row_id, details)
    VALUES (v_uid, 'INSERT', 'daily_entries', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log(user_id, action, table_name, row_id, details)
    VALUES (v_uid, 'UPDATE', 'daily_entries', NEW.id, jsonb_build_object('_before', to_jsonb(OLD), '_after', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log(user_id, action, table_name, row_id, details)
    VALUES (v_uid, 'DELETE', 'daily_entries', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_daily_entries_updated ON public.daily_entries;
CREATE TRIGGER trg_daily_entries_updated
BEFORE UPDATE ON public.daily_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_monthly_limits_updated ON public.monthly_limits;
CREATE TRIGGER trg_monthly_limits_updated
BEFORE UPDATE ON public.monthly_limits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_daily_entries ON public.daily_entries;
CREATE TRIGGER trg_audit_daily_entries
AFTER INSERT OR UPDATE OR DELETE ON public.daily_entries
FOR EACH ROW EXECUTE FUNCTION public.log_daily_entry_changes();

-- ============================================================
-- RLS ENABLE
-- ============================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admin insert profile" ON public.profiles;
CREATE POLICY "Admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());

-- user_roles
DROP POLICY IF EXISTS "View own roles" ON public.user_roles;
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admin manage roles" ON public.user_roles;
CREATE POLICY "Admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Departments
DROP POLICY IF EXISTS "Auth read departments" ON public.departments;
CREATE POLICY "Auth read departments" ON public.departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write departments" ON public.departments;
CREATE POLICY "Admin write departments" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Sections
DROP POLICY IF EXISTS "Auth read sections" ON public.sections;
CREATE POLICY "Auth read sections" ON public.sections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write sections" ON public.sections;
CREATE POLICY "Admin write sections" ON public.sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Fuel types
DROP POLICY IF EXISTS "Auth read fuel_types" ON public.fuel_types;
CREATE POLICY "Auth read fuel_types" ON public.fuel_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write fuel_types" ON public.fuel_types;
CREATE POLICY "Admin write fuel_types" ON public.fuel_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Vehicles
DROP POLICY IF EXISTS "Auth read vehicles" ON public.vehicles;
CREATE POLICY "Auth read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write vehicles" ON public.vehicles;
CREATE POLICY "Admin write vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Monthly limits
DROP POLICY IF EXISTS "Auth read limits" ON public.monthly_limits;
CREATE POLICY "Auth read limits" ON public.monthly_limits FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "GSM/Admin insert limits" ON public.monthly_limits;
CREATE POLICY "GSM/Admin insert limits" ON public.monthly_limits FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm'));
DROP POLICY IF EXISTS "GSM/Admin update limits" ON public.monthly_limits;
CREATE POLICY "GSM/Admin update limits" ON public.monthly_limits FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm'));
DROP POLICY IF EXISTS "Admin delete limits" ON public.monthly_limits;
CREATE POLICY "Admin delete limits" ON public.monthly_limits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Daily entries
DROP POLICY IF EXISTS "Auth read entries" ON public.daily_entries;
CREATE POLICY "Auth read entries" ON public.daily_entries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Insert entries" ON public.daily_entries;
CREATE POLICY "Insert entries" ON public.daily_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm') OR public.has_role(auth.uid(),'operator')
    OR (public.has_role(auth.uid(),'master') AND department_id = public.current_user_department())
  );
DROP POLICY IF EXISTS "Update entries" ON public.daily_entries;
CREATE POLICY "Update entries" ON public.daily_entries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm') OR public.has_role(auth.uid(),'operator')
    OR (public.has_role(auth.uid(),'master') AND department_id = public.current_user_department() AND created_by = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm') OR public.has_role(auth.uid(),'operator')
    OR (public.has_role(auth.uid(),'master') AND department_id = public.current_user_department() AND created_by = auth.uid())
  );
DROP POLICY IF EXISTS "Admin delete entries" ON public.daily_entries;
CREATE POLICY "Admin delete entries" ON public.daily_entries FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Audit log
DROP POLICY IF EXISTS "Admin/GSM/Operator read audit" ON public.audit_log;
CREATE POLICY "Admin/GSM/Operator read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gsm')
    OR public.has_role(auth.uid(),'operator')
  );

-- Role permissions
DROP POLICY IF EXISTS "Auth read role_permissions" ON public.role_permissions;
CREATE POLICY "Auth read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin write role_permissions" ON public.role_permissions;
CREATE POLICY "Admin write role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- FUNCTION PERMISSIONS
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_department() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_department() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_daily_entry_changes() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO public.departments (code, name, name_uz, is_total) VALUES
('JDC-2','JDTs-2','JDTs-2',false),
('JDC-3','JDTs-3','JDTs-3',false),
('JDC-4','JDTs-4','JDTs-4',false),
('SCB','SCB va aloqa','SCB va aloqa',false),
('KS','K/X xizmati','K/X xizmati',false),
('SPTO','SPTO','SPTO',false),
('SE','SE','SE',false),
('UPJT','UPJT (JAMI)','UPJT (JAMI)',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fuel_types (code, name, name_uz, unit) VALUES
('DIESEL','Dizel yoqilg\'isi','Dizel yoqilg\'isi','litr'),
('PETROL','Benzin','Benzin','litr'),
('SPG','SPG','SPG','m3')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role, module, permission, allowed) VALUES
  ('admin','entries','view',true),('admin','entries','create',true),('admin','entries','edit',true),('admin','entries','delete',true),
  ('admin','limits','view',true),('admin','limits','create',true),('admin','limits','edit',true),('admin','limits','delete',true),
  ('admin','master_data','view',true),('admin','master_data','create',true),('admin','master_data','edit',true),('admin','master_data','delete',true),
  ('admin','users','view',true),('admin','users','create',true),('admin','users','edit',true),('admin','users','delete',true),
  ('admin','audit','view',true),('admin','audit','create',false),('admin','audit','edit',false),('admin','audit','delete',false),
  ('gsm','entries','view',true),('gsm','entries','create',true),('gsm','entries','edit',true),('gsm','entries','delete',false),
  ('gsm','limits','view',true),('gsm','limits','create',true),('gsm','limits','edit',true),('gsm','limits','delete',false),
  ('gsm','master_data','view',true),('gsm','master_data','create',false),('gsm','master_data','edit',false),('gsm','master_data','delete',false),
  ('gsm','users','view',false),('gsm','users','create',false),('gsm','users','edit',false),('gsm','users','delete',false),
  ('gsm','audit','view',false),('gsm','audit','create',false),('gsm','audit','edit',false),('gsm','audit','delete',false),
  ('operator','entries','view',true),('operator','entries','create',true),('operator','entries','edit',true),('operator','entries','delete',false),
  ('operator','limits','view',true),('operator','limits','create',false),('operator','limits','edit',false),('operator','limits','delete',false),
  ('operator','master_data','view',true),('operator','master_data','create',true),('operator','master_data','edit',true),('operator','master_data','delete',false),
  ('operator','users','view',false),('operator','users','create',false),('operator','users','edit',false),('operator','users','delete',false),
  ('operator','audit','view',true),('operator','audit','create',false),('operator','audit','edit',false),('operator','audit','delete',false),
  ('master','entries','view',true),('master','entries','create',true),('master','entries','edit',true),('master','entries','delete',false),
  ('master','limits','view',true),('master','limits','create',false),('master','limits','edit',false),('master','limits','delete',false),
  ('master','master_data','view',false),('master','master_data','create',false),('master','master_data','edit',false),('master','master_data','delete',false),
  ('master','users','view',false),('master','users','create',false),('master','users','edit',false),('master','users','delete',false),
  ('master','audit','view',false),('master','audit','create',false),('master','audit','edit',false),('master','audit','delete',false),
  ('management','entries','view',true),('management','entries','create',false),('management','entries','edit',false),('management','entries','delete',false),
  ('management','limits','view',true),('management','limits','create',false),('management','limits','edit',false),('management','limits','delete',false),
  ('management','master_data','view',true),('management','master_data','create',false),('management','master_data','edit',false),('management','master_data','delete',false),
  ('management','users','view',false),('management','users','create',false),('management','users','edit',false),('management','users','delete',false),
  ('management','audit','view',false),('management','audit','create',false),('management','audit','edit',false),('management','audit','delete',false)
ON CONFLICT (role, module, permission) DO NOTHING;
