import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, TrendingUp, Fuel, Gauge } from 'lucide-react';
import { supabase, type Department, type Section, type FuelType, type MonthlyLimit, type DailyEntry } from '../lib/supabase';
import { useI18n, formatUnit } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';

// ============================================================
// Types
// ============================================================

interface FuelStyle {
  limit: string;
  fact: string;
}

// ============================================================
// Constants
// ============================================================

const FUEL_ORDER = ['DIESEL', 'PETROL', 'SPG'] as const;
type FuelCode = (typeof FUEL_ORDER)[number];

const FUEL_STYLES: Record<string, FuelStyle> = {
  DIESEL: { limit: 'hsl(220 25% 70%)', fact: 'hsl(220 80% 55%)' },
  PETROL: { limit: 'hsl(30 25% 70%)', fact: 'hsl(30 90% 55%)' },
  SPG: { limit: 'hsl(160 25% 70%)', fact: 'hsl(160 60% 45%)' },
};



const PAGE_SIZE = 1000;

// ============================================================
// Helpers
// ============================================================

/** Percentage of fact vs limit; 0 if limit <= 0. */
const safePct = (fact: number, lim: number): number => (lim > 0 ? (fact / lim) * 100 : 0);

/** Format a number with ru-RU grouping (rounded). */
const fmt = (n: number): string => (Number.isFinite(n) ? Math.round(n).toLocaleString('ru-RU') : '0');

/** Format a percentage, or em-dash if not finite / non-positive. */
const fmtPct = (n: number): string => (Number.isFinite(n) && n > 0 ? `${Math.round(n)}%` : '—');

/** Number of days in a given (year, month) where month is 0-indexed. */
const daysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

/** YYYY-MM-DD for a (year, month, day). */
const dateStr = (year: number, month: number, day: number): string => {
  const d = String(day).padStart(2, '0');
  const m = String(month + 1).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

/** Yesterday's date string (YYYY-MM-DD). */
const yesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Today's date string (YYYY-MM-DD). */
const todayStr = (): string => new Date().toISOString().slice(0, 10);

// ============================================================
// Component
// ============================================================

export function DashboardPage() {
  const { t, ln, lang } = useI18n();

  // --------------------------------------------------------
  // State
  // --------------------------------------------------------
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Derive year/month from dateTo for monthly limits lookup
  const year = useMemo(() => new Date(dateTo + 'T00:00:00').getFullYear(), [dateTo]);
  const month = useMemo(() => new Date(dateTo + 'T00:00:00').getMonth(), [dateTo]);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [limits, setLimits] = useState<MonthlyLimit[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --------------------------------------------------------
  // Load reference data once
  // --------------------------------------------------------
  useEffect(() => {
    (async () => {
      const [{ data: depts }, { data: secs }, { data: fuels }] = await Promise.all([
        supabase.from('departments').select('*').order('code'),
        supabase.from('sections').select('*').order('name_ru'),
        supabase.from('fuel_types').select('*').order('code'),
      ]);
      setDepartments((depts as Department[]) ?? []);
      setSections((secs as Section[]) ?? []);
      setFuelTypes((fuels as FuelType[]) ?? []);
    })();
  }, []);

  // --------------------------------------------------------
  // Load limits + entries (depends on year/month + refreshTrigger)
  // --------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Monthly limits for the period derived from dateTo
      const { data: limData } = await supabase
        .from('monthly_limits')
        .select('*')
        .eq('year', year)
        .eq('month', month + 1);
      setLimits((limData as MonthlyLimit[]) ?? []);

      // Daily entries — paginated, filtered to the selected date range
      const all: DailyEntry[] = [];
      let page = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('daily_entries')
          .select('*')
          .gte('entry_date', dateFrom)
          .lte('entry_date', dateTo)
          .order('entry_date', { ascending: true })
          .range(from, to);
        if (error) break;
        const rows = (data as DailyEntry[]) ?? [];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        page += 1;
      }
      setEntries(all);
    } finally {
      setLoading(false);
    }
  }, [year, month, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // --------------------------------------------------------
  // Realtime subscriptions — bump refreshTrigger on any change
  // --------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' }, () =>
        setRefreshTrigger((n) => n + 1),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_limits' }, () =>
        setRefreshTrigger((n) => n + 1),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --------------------------------------------------------
  // Derived: date window
  // --------------------------------------------------------
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth();
  }, [year, month]);

  /** The "yesterday" cutoff for MTD aggregation. For the current month it's
   *  yesterday; for past months it's the last day of that month. */
  const mtdCutoff = useMemo(() => {
    if (isCurrentMonth) return yesterdayStr();
    return dateStr(year, month, daysInMonth(year, month));
  }, [isCurrentMonth, year, month]);

  /** The yesterday date string for the selected period (for the "Yesterday" column). */
  const yesterdayDate = useMemo(() => {
    if (isCurrentMonth) return yesterdayStr();
    return dateStr(year, month, daysInMonth(year, month));
  }, [isCurrentMonth, year, month]);

  /** Number of selected calendar days in the date range. */
  const selectedDays = useMemo(() => {
    const start = new Date(dateFrom + 'T00:00:00');
    const end = new Date(dateTo + 'T00:00:00');
    if (end < start) return 0;
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [dateFrom, dateTo]);

  const dim = useMemo(() => daysInMonth(year, month), [year, month]);

  // --------------------------------------------------------
  // Derived: fuel type lookup (ordered DIESEL, PETROL, SPG)
  // --------------------------------------------------------
  const orderedFuels = useMemo(() => {
    const byCode: Record<string, FuelType> = {};
    for (const f of fuelTypes) byCode[f.code] = f;
    const result: FuelType[] = [];
    for (const code of FUEL_ORDER) {
      const ft = byCode[code];
      if (ft) result.push(ft);
    }
    // Include any fuel types not in FUEL_ORDER, appended after
    for (const f of fuelTypes) {
      if (!FUEL_ORDER.includes(f.code as FuelCode)) result.push(f);
    }
    return result;
  }, [fuelTypes]);

  const fuelById = useMemo(() => {
    const m: Record<string, FuelType> = {};
    for (const f of fuelTypes) m[f.id] = f;
    return m;
  }, [fuelTypes]);

  // --------------------------------------------------------
  // Derived: departments (non-total) + sections grouped
  // --------------------------------------------------------
  const realDepartments = useMemo(() => departments.filter((d) => !d.is_total), [departments]);

  const sectionsByDept = useMemo(() => {
    const m: Record<string, Section[]> = {};
    for (const s of sections) {
      (m[s.department_id] ??= []).push(s);
    }
    return m;
  }, [sections]);

  // --------------------------------------------------------
  // Derived: limit lookup keyed by `${deptId}|${sectionId ?? ''}|${fuelTypeId}`
  // --------------------------------------------------------
  const limitMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of limits) {
      const key = `${l.department_id}|${l.section_id ?? ''}|${l.fuel_type_id}`;
      m[key] = Number(l.limit_value) || 0;
    }
    return m;
  }, [limits]);

  const getLimit = useCallback(
    (deptId: string, sectionId: string | null, fuelTypeId: string): number =>
      limitMap[`${deptId}|${sectionId ?? ''}|${fuelTypeId}`] ?? 0,
    [limitMap],
  );

  // --------------------------------------------------------
  // Derived: consumption aggregates
  // --------------------------------------------------------
  /** Key: `${deptId}|${sectionId ?? ''}|${fuelTypeId}` -> consumption sum for a date range. */
  const consumptionByDay = useMemo(() => {
    // Map: key -> Map<dateStr, consumption>
    const m: Record<string, Record<string, number>> = {};
    for (const e of entries) {
      const key = `${e.department_id}|${e.section_id ?? ''}|${e.fuel_type_id}`;
      (m[key] ??= {})[e.entry_date] = (m[key]?.[e.entry_date] ?? 0) + (Number(e.consumption) || 0);
    }
    return m;
  }, [entries]);

  /** Yesterday's consumption for a key. */
  const getYesterday = useCallback(
    (deptId: string, sectionId: string | null, fuelTypeId: string): number =>
      consumptionByDay[`${deptId}|${sectionId ?? ''}|${fuelTypeId}`]?.[yesterdayDate] ?? 0,
    [consumptionByDay, yesterdayDate],
  );

  /** MTD consumption (up to and including mtdCutoff) for a key. */
  const getMtd = useCallback(
    (deptId: string, sectionId: string | null, fuelTypeId: string): number => {
      const dayMap = consumptionByDay[`${deptId}|${sectionId ?? ''}|${fuelTypeId}`];
      if (!dayMap) return 0;
      let sum = 0;
      for (const [d, v] of Object.entries(dayMap)) {
        if (d <= mtdCutoff) sum += v;
      }
      return sum;
    },
    [consumptionByDay, mtdCutoff],
  );

  // Fix 4: selectedLimit = (monthlyLimit / dim) * selectedDays
  const getSelectedLimit = useCallback(
    (deptId: string, sectionId: string | null, fuelTypeId: string): number =>
      (getLimit(deptId, sectionId, fuelTypeId) / dim) * selectedDays,
    [getLimit, dim, selectedDays],
  );

  // --------------------------------------------------------
  // Derived: bar chart data per fuel type — Limit vs Fact by department
  // --------------------------------------------------------
  const barDataByFuel = useMemo(() => {
    const map: Record<string, { name: string; limit: number; fact: number }[]> = {};
    for (const ft of orderedFuels) {
      map[ft.id] = realDepartments.map((d) => {
        const lim = getSelectedLimit(d.id, null, ft.id);
        const fact = getMtd(d.id, null, ft.id);
        return { name: ln(d), limit: Math.round(lim), fact: Math.round(fact) };
      });
    }
    return map;
  }, [realDepartments, orderedFuels, getSelectedLimit, getMtd, ln]);

  // --------------------------------------------------------
  // Derived: fuel type summary — per fuel independent data (own scale)
  // --------------------------------------------------------
  const fuelSummary = useMemo(() => {
    return orderedFuels.map((ft) => {
      let lim = 0;
      let fact = 0;
      for (const d of realDepartments) {
        lim += getSelectedLimit(d.id, null, ft.id);
        fact += getMtd(d.id, null, ft.id);
      }
      return { fuel: ft, lim, fact, pct: safePct(fact, lim) };
    });
  }, [orderedFuels, realDepartments, getSelectedLimit, getMtd]);

  // --------------------------------------------------------
  // Derived: daily trend data per fuel type — limit + fact for each day
  // --------------------------------------------------------
  const dailyByFuel = useMemo(() => {
    const map: Record<string, { day: string; limit: number; fact: number }[]> = {};
    const start = new Date(dateFrom + 'T00:00:00');
    const end = new Date(Math.min(new Date(dateTo + 'T00:00:00').getTime(), new Date(mtdCutoff + 'T00:00:00').getTime()));
    for (const ft of orderedFuels) {
      // Sum monthly limits across all departments/sections for this fuel
      let totalMonthlyLimit = 0;
      for (const d of realDepartments) {
        totalMonthlyLimit += getLimit(d.id, null, ft.id);
      }
      const dailyLimit = totalMonthlyLimit / dim;
      // Build day-by-day fact consumption for this fuel
      const factByDay: Record<string, number> = {};
      for (const e of entries) {
        if (e.fuel_type_id !== ft.id) continue;
        if (e.entry_date <= mtdCutoff) {
          factByDay[e.entry_date] = (factByDay[e.entry_date] ?? 0) + (Number(e.consumption) || 0);
        }
      }
      const arr: { day: string; limit: number; fact: number }[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().slice(0, 10);
        arr.push({ day: ds.slice(8), limit: Math.round(dailyLimit), fact: Math.round(factByDay[ds] ?? 0) });
      }
      map[ft.id] = arr;
    }
    return map;
  }, [orderedFuels, realDepartments, entries, getLimit, dim, mtdCutoff, dateFrom, dateTo]);

  // --------------------------------------------------------
  // Derived: breakdown table rows — per fuel type per department/section
  // --------------------------------------------------------
  interface BreakdownRow {
    id: string;
    label: string;
    fuelCode: string;
    unit: string;
    type: 'dept-header' | 'data' | 'total';
    monthlyLimit: number;
    yesterday: number;
    dailyLimit: number;
    dailyFact: number;
    selectedLimit: number;
    mtdFact: number;
  }

  const breakdownRows = useMemo<BreakdownRow[]>(() => {
    const rows: BreakdownRow[] = [];
    const totalByFuel: Record<string, { monthly: number; yesterday: number; mtdFact: number }> = {};
    for (const ft of orderedFuels) {
      totalByFuel[ft.id] = { monthly: 0, yesterday: 0, mtdFact: 0 };
    }

    for (const d of realDepartments) {
      rows.push({
        id: `dept-${d.id}`, label: ln(d), fuelCode: '', unit: '',
        type: 'dept-header',
        monthlyLimit: 0, yesterday: 0, dailyLimit: 0, dailyFact: 0, selectedLimit: 0, mtdFact: 0,
      });

      for (const ft of orderedFuels) {
        const ml = getLimit(d.id, null, ft.id);
        const yest = getYesterday(d.id, null, ft.id);
        const dl = ml / dim;
        const sl = dl * selectedDays;
        const mtdF = getMtd(d.id, null, ft.id);
        rows.push({
          id: `dept-${d.id}-${ft.id}`, label: ln(ft), fuelCode: ft.code, unit: ft.unit,
          type: 'data',
          monthlyLimit: ml, yesterday: yest, dailyLimit: dl, dailyFact: yest, selectedLimit: sl, mtdFact: mtdF,
        });
        totalByFuel[ft.id].monthly += ml;
        totalByFuel[ft.id].yesterday += yest;
        totalByFuel[ft.id].mtdFact += mtdF;
      }
    }

    for (const ft of orderedFuels) {
      const tot = totalByFuel[ft.id];
      const dl = tot.monthly / dim;
      rows.push({
        id: `total-${ft.id}`, label: `${ln(ft)} (${t('total')})`, fuelCode: ft.code, unit: ft.unit,
        type: 'total',
        monthlyLimit: tot.monthly, yesterday: tot.yesterday, dailyLimit: dl, dailyFact: tot.yesterday,
        selectedLimit: dl * selectedDays, mtdFact: tot.mtdFact,
      });
    }

    return rows;
  }, [realDepartments, orderedFuels, getLimit, getYesterday, getMtd, dim, selectedDays, ln, t]);

  // --------------------------------------------------------
  // Derived: warnings — departments at >=80% of their MTD limit
  // --------------------------------------------------------
  interface Warning {
    id: string;
    label: string;
    pct: number;
    mtdFact: number;
    mtdLimit: number;
  }

  const warnings = useMemo<Warning[]>(() => {
    const list: Warning[] = [];
    for (const d of realDepartments) {
      let lim = 0;
      let fact = 0;
      for (const ft of orderedFuels) {
        lim += getSelectedLimit(d.id, null, ft.id);
        fact += getMtd(d.id, null, ft.id);
      }
      const pct = safePct(fact, lim);
      if (pct >= 80) {
        list.push({ id: d.id, label: ln(d), pct, mtdFact: fact, mtdLimit: lim });
      }
    }
    return list.sort((a, b) => b.pct - a.pct);
  }, [realDepartments, orderedFuels, getSelectedLimit, getMtd, ln]);

  // --------------------------------------------------------
  // Render helpers
  // --------------------------------------------------------
  const selectCls =
    'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring';

  const devCls = (dev: number): string => {
    if (dev > 0) return 'text-destructive';
    if (dev < 0) return 'text-emerald-600';
    return 'text-muted-foreground';
  };

  const pctCls = (pct: number): string => {
    if (pct >= 100) return 'text-destructive';
    if (pct >= 80) return 'text-orange-600';
    return 'text-foreground';
  };

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header + selectors */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('reportingPeriod')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('dateFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={selectCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('dateTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={selectCls}
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12 shadow-sm">
          <div className="inline-flex items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            {t('loading')}
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Limit vs Fact — one bar chart per fuel type */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {orderedFuels.map((ft) => {
              const style = FUEL_STYLES[ft.code] ?? { limit: 'hsl(220 25% 70%)', fact: 'hsl(220 80% 55%)' };
              const chartData = (barDataByFuel[ft.id] ?? []).map((r) => ({
                ...r,
                saved: Math.max(0, r.limit - r.fact),
              }));
              return (
                <div key={ft.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Gauge className="h-5 w-5" style={{ color: style.fact }} />
                    <h2 className="text-base font-semibold text-foreground">
                      {t('limitVsFact')} — {ln(ft)}
                    </h2>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="limit" name={t('limit')} fill={style.limit} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="fact" name={t('fact')} fill={style.fact} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="saved" name={t('economy')} fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="border-r border-border px-3 py-2 text-left font-semibold text-foreground">
                            {t('department')}
                          </th>
                          <th className="border-r border-border px-3 py-2 text-right font-semibold text-foreground">
                            {t('fact')}
                          </th>
                          <th className="border-r border-border px-3 py-2 text-right font-semibold text-foreground">
                            {t('limit')}
                          </th>
                          <th className="px-3 py-2 text-right font-semibold text-foreground">
                            {t('economy')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                              {t('noData')}
                            </td>
                          </tr>
                        )}
                        {chartData.map((row) => {
                          const saved = row.limit - row.fact;
                          return (
                            <tr key={row.name} className="border-b border-border transition hover:bg-muted/30">
                              <td className="border-r border-border px-3 py-2 text-foreground">{row.name}</td>
                              <td className="border-r border-border px-3 py-2 text-right text-foreground">{fmt(row.fact)}</td>
                              <td className="border-r border-border px-3 py-2 text-right text-foreground">{fmt(row.limit)}</td>
                              <td className={`px-3 py-2 text-right ${devCls(saved)}`}>
                                {saved > 0 ? '+' : ''}{fmt(saved)}
                              </td>
                            </tr>
                          );
                        })}
                        {chartData.length > 0 && (() => {
                          const totalFact = chartData.reduce((s, r) => s + r.fact, 0);
                          const totalLimit = chartData.reduce((s, r) => s + r.limit, 0);
                          const totalSaved = totalLimit - totalFact;
                          return (
                            <tr className="bg-muted/60 font-bold">
                              <td className="border-r border-border px-3 py-2 text-foreground">{t('total')}</td>
                              <td className="border-r border-border px-3 py-2 text-right text-foreground">{fmt(totalFact)}</td>
                              <td className="border-r border-border px-3 py-2 text-right text-foreground">{fmt(totalLimit)}</td>
                              <td className={`px-3 py-2 text-right ${devCls(totalSaved)}`}>
                                {totalSaved > 0 ? '+' : ''}{fmt(totalSaved)}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fuel Type Summary — independent cards, each with own scale */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {fuelSummary.map((fs) => {
              const style = FUEL_STYLES[fs.fuel.code] ?? { limit: 'hsl(220 25% 70%)', fact: 'hsl(220 80% 55%)' };
              const barWidth = Math.min(fs.pct, 100);
              return (
                <div
                  key={fs.fuel.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm"
                  style={{ borderTop: `3px solid ${style.fact}` }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Fuel className="h-5 w-5" style={{ color: style.fact }} />
                    <h2 className="text-base font-semibold text-foreground">{ln(fs.fuel)}</h2>
                    <span className="text-xs text-muted-foreground">({formatUnit(fs.fuel.unit, lang)})</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('fact')}</p>
                      <p className="text-xl font-bold text-foreground">{fmt(fs.fact)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t('limit')}</p>
                      <p className="text-xl font-semibold text-muted-foreground">{fmt(fs.lim)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('percent')}</span>
                    <span
                      className={`text-sm font-bold ${
                        fs.pct >= 100 ? 'text-destructive' : fs.pct >= 80 ? 'text-orange-600' : 'text-primary'
                      }`}
                    >
                      {fmtPct(fs.pct)}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: fs.pct >= 100 ? 'hsl(0 70% 60%)' : style.fact,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daily Trend — one line chart per fuel type with Limit + Fact */}
          <div className="grid grid-cols-1 gap-4">
            {orderedFuels.map((ft) => {
              const style = FUEL_STYLES[ft.code] ?? { limit: 'hsl(220 25% 70%)', fact: 'hsl(220 80% 55%)' };
              const chartData = dailyByFuel[ft.id] ?? [];
              return (
                <div key={ft.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" style={{ color: style.fact }} />
                    <h2 className="text-base font-semibold text-foreground">
                      {t('dailyTrend')} — {ln(ft)}
                    </h2>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="limit" name={t('limit')} stroke={style.limit} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="fact" name={t('fact')} stroke={style.fact} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>

          {/* Breakdown table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th
                      rowSpan={2}
                      className="border-r border-border px-3 py-2.5 text-left font-semibold text-foreground"
                    >
                      {t('department')} / {t('fuelType')}
                    </th>
                    <th
                      rowSpan={2}
                      className="border-r border-border px-3 py-2.5 text-right font-semibold text-foreground"
                    >
                      {t('monthlyLimit')}
                    </th>
                    <th
                      rowSpan={2}
                      className="border-r border-border px-3 py-2.5 text-right font-semibold text-foreground"
                    >
                      {t('yesterday')}
                    </th>
                    <th
                      colSpan={4}
                      className="border-r border-border px-3 py-2.5 text-center font-semibold text-foreground"
                    >
                      {t('yesterday')}
                    </th>
                    <th colSpan={4} className="px-3 py-2.5 text-center font-semibold text-foreground">
                      {t('monthToDate')}
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="border-l border-border px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('dailyLimit')}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('dailyFact')}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('deviation')}
                    </th>
                    <th className="border-r border-border px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('percent')}
                    </th>
                    <th className="border-l border-border px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('mtdLimit')}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('mtdFact')}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('deviation')}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      {t('percent')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                        {t('noData')}
                      </td>
                    </tr>
                  )}
                  {breakdownRows.map((row) => {
                    if (row.type === 'dept-header') {
                      return (
                        <tr key={row.id} className="border-b border-border bg-muted/30">
                          <td colSpan={11} className="px-3 py-2.5 font-semibold text-foreground">
                            {row.label}
                          </td>
                        </tr>
                      );
                    }

                    const mtdDev = row.mtdFact - row.selectedLimit;
                    const mtdPct = safePct(row.mtdFact, row.selectedLimit);
                    const isTotal = row.type === 'total';
                    const style = FUEL_STYLES[row.fuelCode] ?? { limit: 'hsl(220 25% 70%)', fact: 'hsl(220 80% 55%)' };

                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-border transition hover:bg-muted/30 ${
                          isTotal ? 'bg-muted/60 font-bold' : ''
                        }`}
                      >
                        <td className="border-r border-border px-3 py-2.5 text-foreground">
                          <span className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: style.fact }} />
                            <span>
                              {row.label}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">({formatUnit(row.unit, lang)})</span>
                          </span>
                        </td>
                        <td className="border-r border-border px-3 py-2.5 text-right text-foreground">
                          {fmt(row.monthlyLimit)}
                        </td>
                        <td className="border-r border-border px-3 py-2.5 text-right text-foreground">
                          {fmt(row.yesterday)}
                        </td>
                        <td className="border-l border-border px-3 py-2.5 text-right text-foreground">
                          {fmt(row.dailyLimit)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-foreground">{fmt(row.dailyFact)}</td>
                        <td className={`px-3 py-2.5 text-right ${devCls(row.dailyFact - row.dailyLimit)}`}>
                          {row.dailyFact - row.dailyLimit > 0 ? '+' : ''}
                          {fmt(row.dailyFact - row.dailyLimit)}
                        </td>
                        <td className={`border-r border-border px-3 py-2.5 text-right ${pctCls(safePct(row.dailyFact, row.dailyLimit))}`}>
                          {fmtPct(safePct(row.dailyFact, row.dailyLimit))}
                        </td>
                        <td className="border-l border-border px-3 py-2.5 text-right text-foreground">
                          {fmt(row.selectedLimit)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-foreground">{fmt(row.mtdFact)}</td>
                        <td className={`px-3 py-2.5 text-right ${devCls(mtdDev)}`}>
                          {mtdDev > 0 ? '+' : ''}
                          {fmt(mtdDev)}
                        </td>
                        <td className={`px-3 py-2.5 text-right ${pctCls(mtdPct)}`}>{fmtPct(mtdPct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warnings section */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <h2 className="text-base font-semibold text-foreground">{t('alerts')}</h2>
            </div>
            {warnings.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('noAlerts')}</p>
            ) : (
              <div className="space-y-2">
                {warnings.map((w) => {
                  const over = w.pct >= 100;
                  return (
                    <div
                      key={w.id}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                        over
                          ? 'border-destructive/30 bg-destructive/5'
                          : 'border-orange-600/30 bg-orange-600/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle
                          className={`h-4 w-4 ${over ? 'text-destructive' : 'text-orange-600'}`}
                        />
                        <span className="text-sm font-medium text-foreground">{w.label}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {fmt(w.mtdFact)} / {fmt(w.mtdLimit)}
                        </span>
                        <span
                          className={`text-sm font-bold ${over ? 'text-destructive' : 'text-orange-600'}`}
                        >
                          {fmtPct(w.pct)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
