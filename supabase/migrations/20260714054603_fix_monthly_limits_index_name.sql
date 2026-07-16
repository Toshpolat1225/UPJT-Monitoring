/*
# Fix monthly_limits index name to match original schema

The original system uses `monthly_limits_unique_idx` as the index name.
Our initial migration created it as `idx_monthly_limits_unique`.
This renames it to match the original schema exactly.
*/

DROP INDEX IF EXISTS public.idx_monthly_limits_unique;
CREATE UNIQUE INDEX IF NOT EXISTS monthly_limits_unique_idx
  ON public.monthly_limits (department_id, COALESCE(section_id, '00000000-0000-0000-0000-000000000000'), fuel_type_id, year, month);