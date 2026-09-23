import type { DailyEntry, FuelType, MonthlyLimit } from '../types';

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
 * Limits are prorated per month and per stored department/section scope, so
 * entries from different fuel types or months are never mixed.
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

  // Sum actual (consumption) per fuel type
  const actualMap: Record<string, number> = {};
  for (const e of entries) {
    const ftId = e.fuel_type_id;
    actualMap[ftId] = (actualMap[ftId] ?? 0) + (Number(e.consumption) || 0);
  }

  const limitMap: Record<string, number> = {};
  for (const limit of limits) {
    const scopedEntries = entries.filter((entry) => {
      const year = Number(entry.entry_date.slice(0, 4));
      const month = Number(entry.entry_date.slice(5, 7));
      return entry.fuel_type_id === limit.fuel_type_id &&
        entry.department_id === limit.department_id &&
        entry.section_id === limit.section_id &&
        year === limit.year && month === limit.month;
    });
    if (scopedEntries.length === 0) continue;

    const daysInMonth = new Date(limit.year, limit.month, 0).getDate();
    const distinctDays = new Set(scopedEntries.map((entry) => entry.entry_date)).size;
    limitMap[limit.fuel_type_id] = (limitMap[limit.fuel_type_id] ?? 0) +
      ((Number(limit.limit_value) || 0) / daysInMonth) * Math.min(distinctDays, daysInMonth);
  }

  const perFuel: FuelTotalRow[] = fuelTypes.map((ft) => {
    const limit = limitMap[ft.id] ?? 0;
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
