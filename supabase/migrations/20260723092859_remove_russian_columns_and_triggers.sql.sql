-- Migration: Remove Russian-specific columns and triggers
-- Part of the permanent migration from bilingual (UZ/RU) to Uzbek-only.
-- Uzbek columns (name, name_uz) are preserved on all tables.

-- 1. Drop Russian auto-fill triggers
DROP TRIGGER IF EXISTS trg_auto_fill_ru_departments ON public.departments;
DROP TRIGGER IF EXISTS trg_auto_fill_ru_fuel_types ON public.fuel_types;
DROP TRIGGER IF EXISTS trg_auto_fill_ru_sections ON public.sections;
DROP TRIGGER IF EXISTS trg_auto_fill_ru_vehicles ON public.vehicles;

-- 2. Drop the Russian auto-fill trigger function
DROP FUNCTION IF EXISTS public.auto_fill_ru_from_uz();

-- 3. Remove name_ru columns (Uzbek name and name_uz columns remain)
ALTER TABLE public.departments DROP COLUMN IF EXISTS name_ru;
ALTER TABLE public.fuel_types DROP COLUMN IF EXISTS name_ru;
ALTER TABLE public.sections DROP COLUMN IF EXISTS name_ru;
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS name_ru;
