/*
# Make *_ru Columns Nullable with Auto-Fallback

## Purpose
Transition the system to Uzbek-only operation. All Russian-language
columns (*_ru) are made nullable so the frontend can omit them entirely.
A trigger auto-populates *_ru = *_uz when *_ru is NULL or empty, preserving
backward compatibility for any legacy SQL queries that still read *_ru.

## Changes
1. ALTER columns: DROP NOT NULL on name_ru in departments, sections,
   fuel_types, vehicles.
2. Create a trigger function `auto_fill_ru_from_uz()` that runs BEFORE
   INSERT/UPDATE on each of these tables and sets name_ru = name_uz
   whenever name_ru is NULL or empty string.
3. Attach triggers to all four tables.

## Safety
- No data is deleted or modified.
- Existing name_ru values are preserved.
- The trigger only fills in name_ru when it's missing — it never
  overwrites a non-empty value.
- All CRUD operations continue to work unchanged.
*/

-- ============================================================
-- 1. DROP NOT NULL on name_ru columns
-- ============================================================

ALTER TABLE public.departments ALTER COLUMN name_ru DROP NOT NULL;
ALTER TABLE public.sections ALTER COLUMN name_ru DROP NOT NULL;
ALTER TABLE public.fuel_types ALTER COLUMN name_ru DROP NOT NULL;
ALTER TABLE public.vehicles ALTER COLUMN name_ru DROP NOT NULL;

-- ============================================================
-- 2. Auto-fill trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_fill_ru_from_uz()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name_ru IS NULL OR NEW.name_ru = '' THEN
    NEW.name_ru := NEW.name_uz;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Attach triggers (drop first for idempotency)
-- ============================================================

DROP TRIGGER IF EXISTS trg_auto_fill_ru_departments ON public.departments;
CREATE TRIGGER trg_auto_fill_ru_departments
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_ru_from_uz();

DROP TRIGGER IF EXISTS trg_auto_fill_ru_sections ON public.sections;
CREATE TRIGGER trg_auto_fill_ru_sections
  BEFORE INSERT OR UPDATE ON public.sections
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_ru_from_uz();

DROP TRIGGER IF EXISTS trg_auto_fill_ru_fuel_types ON public.fuel_types;
CREATE TRIGGER trg_auto_fill_ru_fuel_types
  BEFORE INSERT OR UPDATE ON public.fuel_types
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_ru_from_uz();

DROP TRIGGER IF EXISTS trg_auto_fill_ru_vehicles ON public.vehicles;
CREATE TRIGGER trg_auto_fill_ru_vehicles
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_ru_from_uz();
