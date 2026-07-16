/*
# Department Fuel Matrix

## Overview
Adds a new configuration table `department_fuel_matrix` that defines which fuel
types are allowed for each department. This is a pure configuration entity —
no business logic or existing calculations are changed.

## New Table
- `department_fuel_matrix`
  - `id` (uuid, primary key)
  - `department_id` (uuid, FK → departments, ON DELETE CASCADE)
  - `fuel_type_id` (uuid, FK → fuel_types, ON DELETE CASCADE)
  - `enabled` (boolean, default true)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - UNIQUE constraint on (department_id, fuel_type_id) — one record per
    department + fuel type pair.

## Auto-creation Triggers
1. `trg_matrix_on_new_department` — AFTER INSERT on `departments`: creates a
   matrix row for every existing fuel type with `enabled = true`.
2. `trg_matrix_on_new_fuel_type` — AFTER INSERT on `fuel_types`: creates a
   matrix row for every existing department with `enabled = true`.

## Security (RLS)
- SELECT: all authenticated users can read (view access for everyone).
- INSERT/UPDATE: only `admin` and `gsm` roles can write.
- DELETE: only `admin` role can delete.

## Important Notes
1. Existing departments and fuel types are backfilled immediately after the
   table is created — every existing department × fuel type pair gets a row
   with `enabled = true`.
2. The `set_updated_at()` trigger is reused for the `updated_at` column.
3. No existing tables, columns, or policies are modified.
*/

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.department_fuel_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  fuel_type_id UUID NOT NULL REFERENCES public.fuel_types(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, fuel_type_id)
);

-- ============================================================
-- BACKFILL EXISTING DATA
-- ============================================================

INSERT INTO public.department_fuel_matrix (department_id, fuel_type_id, enabled)
SELECT d.id, f.id, true
FROM public.departments d
CROSS JOIN public.fuel_types f
WHERE NOT EXISTS (
  SELECT 1 FROM public.department_fuel_matrix m
  WHERE m.department_id = d.id AND m.fuel_type_id = f.id
)
ON CONFLICT (department_id, fuel_type_id) DO NOTHING;

-- ============================================================
-- TRIGGERS — auto-create matrix rows
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_matrix_on_new_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.department_fuel_matrix (department_id, fuel_type_id, enabled)
  SELECT NEW.id, f.id, true
  FROM public.fuel_types f
  WHERE NOT EXISTS (
    SELECT 1 FROM public.department_fuel_matrix m
    WHERE m.department_id = NEW.id AND m.fuel_type_id = f.id
  )
  ON CONFLICT (department_id, fuel_type_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_matrix_on_new_fuel_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.department_fuel_matrix (department_id, fuel_type_id, enabled)
  SELECT d.id, NEW.id, true
  FROM public.departments d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.department_fuel_matrix m
    WHERE m.department_id = d.id AND m.fuel_type_id = NEW.id
  )
  ON CONFLICT (department_id, fuel_type_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_matrix_on_new_department ON public.departments;
CREATE TRIGGER trg_matrix_on_new_department
AFTER INSERT ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.auto_matrix_on_new_department();

DROP TRIGGER IF EXISTS trg_matrix_on_new_fuel_type ON public.fuel_types;
CREATE TRIGGER trg_matrix_on_new_fuel_type
AFTER INSERT ON public.fuel_types
FOR EACH ROW EXECUTE FUNCTION public.auto_matrix_on_new_fuel_type();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_department_fuel_matrix_updated ON public.department_fuel_matrix;
CREATE TRIGGER trg_department_fuel_matrix_updated
BEFORE UPDATE ON public.department_fuel_matrix
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.department_fuel_matrix ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated can read
DROP POLICY IF EXISTS "Auth read department_fuel_matrix" ON public.department_fuel_matrix;
CREATE POLICY "Auth read department_fuel_matrix" ON public.department_fuel_matrix
  FOR SELECT TO authenticated USING (true);

-- INSERT: admin + gsm only
DROP POLICY IF EXISTS "Admin/GSM insert department_fuel_matrix" ON public.department_fuel_matrix;
CREATE POLICY "Admin/GSM insert department_fuel_matrix" ON public.department_fuel_matrix
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm'));

-- UPDATE: admin + gsm only
DROP POLICY IF EXISTS "Admin/GSM update department_fuel_matrix" ON public.department_fuel_matrix;
CREATE POLICY "Admin/GSM update department_fuel_matrix" ON public.department_fuel_matrix
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gsm'));

-- DELETE: admin only
DROP POLICY IF EXISTS "Admin delete department_fuel_matrix" ON public.department_fuel_matrix;
CREATE POLICY "Admin delete department_fuel_matrix" ON public.department_fuel_matrix
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- FUNCTION PERMISSIONS
-- ============================================================

REVOKE ALL ON FUNCTION public.auto_matrix_on_new_department() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_matrix_on_new_fuel_type() FROM PUBLIC, anon, authenticated;
