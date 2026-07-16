import type { DailyEntry, FuelType, MonthlyLimit } from './supabase';

export interface FuelTotalRow {
  fuelTypeId: string;
  fuelName: string;
  limit: number;
  actual: number;
  saved: number;
  efficiency: number;
}

export interface FuelTotalsResult {
  perFuel: FuelTotalRow[];
  grand: {
    limit: number;
    actual: number;
    saved: number;
    efficiency: number;
  };
}

/**
 * Compute per-fuel-type and grand totals from a set of (already filtered) entries.
 * Limit is the sum of monthly_limits matching the entries' year/month, divided by
 * days-in-month and multiplied by the number of distinct days in the entry set.
 * All missing/null values default to 0. Efficiency is 0 when limit is 0.
 */
export function computeFuelTotals(
  entries: DailyEntry[],
  fuelTypes: FuelType[],
  limits: MonthlyLimit[],
): FuelTotalsResult {
  if (entries.length === 0) {
    return {
      perFuel: fuelTypes.map((ft) => ({
        fuelTypeId: ft.id,
        fuelName: ft.name_uz,
        limit: 0,
        actual: 0,
        saved: 0,
        efficiency: 0,
      })),
      grand: { limit: 0, actual: 0, saved: 0, efficiency: 0 },
    };
  }

  // Determine the year/month from the first entry (all entries share the same filter window)
  const firstDate = entries[0].entry_date;
  const year = parseInt(firstDate.slice(0, 4));
  const month = parseInt(firstDate.slice(5, 7)); // 1-based

  // Days in that month
  const dim = new Date(year, month, 0).getDate();

  // Distinct days in the filtered entry set
  const distinctDays = new Set(entries.map((e) => e.entry_date)).size;
  const dayCount = Math.min(distinctDays, dim);

  // Build limit lookup: key = fuel_type_id -> monthly limit value
  const limitMap: Record<string, number> = {};
  for (const l of limits) {
    if (l.year === year && l.month === month) {
      limitMap[l.fuel_type_id] = (limitMap[l.fuel_type_id] ?? 0) + (Number(l.limit_value) || 0);
    }
  }

  // Sum actual (consumption) per fuel type
  const actualMap: Record<string, number> = {};
  for (const e of entries) {
    const ftId = e.fuel_type_id;
    actualMap[ftId] = (actualMap[ftId] ?? 0) + (Number(e.consumption) || 0);
  }

  const perFuel: FuelTotalRow[] = fuelTypes.map((ft) => {
    const monthlyLimit = limitMap[ft.id] ?? 0;
    const limit = (monthlyLimit / dim) * dayCount;
    const actual = actualMap[ft.id] ?? 0;
    const saved = limit - actual;
    const efficiency = limit > 0 ? (saved / limit) * 100 : 0;
    return {
      fuelTypeId: ft.id,
      fuelName: ft.name_uz,
      limit,
      actual,
      saved,
      efficiency,
    };
  });

  const grandLimit = perFuel.reduce((s, r) => s + r.limit, 0);
  const grandActual = perFuel.reduce((s, r) => s + r.actual, 0);
  const grandSaved = grandLimit - grandActual;
  const grandEfficiency = grandLimit > 0 ? (grandSaved / grandLimit) * 100 : 0;

  return {
    perFuel,
    grand: { limit: grandLimit, actual: grandActual, saved: grandSaved, efficiency: grandEfficiency },
  };
}
