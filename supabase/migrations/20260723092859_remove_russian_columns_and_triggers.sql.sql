DROP TRIGGER IF EXISTS autofill_name_ru_departments ON public.departments;
DROP TRIGGER IF EXISTS autofill_name_ru_fuel_types ON public.fuel_types;
DROP TRIGGER IF EXISTS autofill_name_ru_sections ON public.sections;
DROP TRIGGER IF EXISTS autofill_name_ru_vehicles ON public.vehicles;
DROP FUNCTION IF EXISTS public.autofill_name_ru();

ALTER TABLE public.departments DROP COLUMN IF EXISTS name_ru;
ALTER TABLE public.fuel_types DROP COLUMN IF EXISTS name_ru;
ALTER TABLE public.sections DROP COLUMN IF EXISTS name_ru;
ALTER TABLE public.vehicles DROP COLUMN IF EXISTS name_ru;
