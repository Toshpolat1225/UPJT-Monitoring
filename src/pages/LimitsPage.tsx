import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Filter, Save, Table2, AlertCircle } from 'lucide-react';
import { supabase, type Department, type FuelType, type MonthlyLimit, type Section, fetchEnabledFuelKeys } from '../lib/supabase';
import { useI18n, formatUnit } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** A row in the editor grid: either a department (aggregated) or a single section. */
interface GridRow {
  /** Stable key used for React reconciliation. */
  key: string;
  /** Display label for the row. */
  label: string;
  /** Department this row belongs to. */
  departmentId: string;
  /** Section id, or null when the row represents a department directly. */
  sectionId: string | null;
  /**
   * When true the row is an aggregated department total (computed from its
   * sections) and the cells are read-only.
   */
  readonly: boolean;
}

/** Key into the values map: `${departmentId}__${sectionId || '_'}__${fuelTypeId}` */
type ValueKey = string;

/** Human-readable month names in the active language. */
const MONTH_NAMES_UZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const MONTH_NAMES_RU = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/** Build the canonical value-map key for a cell. */
function cellKey(departmentId: string, sectionId: string | null, fuelTypeId: string): ValueKey {
  return `${departmentId}__${sectionId || '_'}__${fuelTypeId}`;
}

/** Parse a numeric input value into a finite number, defaulting to 0. */
function parseNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function LimitsPage() {
  const { t, ln, lang } = useI18n();
  const { hasAny } = useAuth();

  const canEdit = hasAny(['admin', 'gsm']);

  // --- Reference data -----------------------------------------------------
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [enabledFuels, setEnabledFuels] = useState<Set<string>>(new Set());

  // --- Filters -----------------------------------------------------------
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all'); // 'all' | departmentId

  // --- Editor state ------------------------------------------------------
  const [values, setValues] = useState<Record<ValueKey, string>>({});
  const [initialValues, setInitialValues] = useState<Record<ValueKey, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const monthNames = lang === 'uz' ? MONTH_NAMES_UZ : MONTH_NAMES_RU;

  // --- Load reference data once -----------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [deptsRes, secsRes, fuelsRes, fuelKeys] = await Promise.all([
          supabase.from('departments').select('*').order('code'),
          supabase.from('sections').select('*').order('name_uz'),
          supabase.from('fuel_types').select('*').order('code'),
          fetchEnabledFuelKeys(),
        ]);

        if (cancelled) return;

        const depts = ((deptsRes.data as Department[]) ?? []).filter((d) => !d.is_total);
        setDepartments(depts);
        setSections((secsRes.data as Section[]) ?? []);
        setFuelTypes((fuelsRes.data as FuelType[]) ?? []);
        setEnabledFuels(fuelKeys);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error(t('error'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sections grouped by department (top-level memo so hooks stay unconditional).
  const sectionsByDept = useMemo(() => {
    const map = new Map<string, Section[]>();
    for (const s of sections) {
      const arr = map.get(s.department_id) ?? [];
      arr.push(s);
      map.set(s.department_id, arr);
    }
    return map;
  }, [sections]);

  // --- Rows visible in the grid (depends on the department filter) ------
  const rows: GridRow[] = useMemo(() => {
    if (departmentFilter === 'all') {
      // One aggregated (read-only) row per department that has sections,
      // plus an editable row per department that has no sections.
      const result: GridRow[] = [];
      for (const d of departments) {
        const deptSections = sectionsByDept.get(d.id) ?? [];
        result.push({
          key: `dept-${d.id}`,
          label: ln(d),
          departmentId: d.id,
          sectionId: null,
          readonly: deptSections.length > 0,
        });
      }
      return result;
    }

    // A specific department is selected.
    const dept = departments.find((d) => d.id === departmentFilter);
    if (!dept) return [];
    const deptSections = sectionsByDept.get(dept.id) ?? [];
    if (deptSections.length > 0) {
      return deptSections.map((s): GridRow => ({
        key: `sec-${s.id}`,
        label: ln(s),
        departmentId: dept.id,
        sectionId: s.id,
        readonly: false,
      }));
    }
    return [{
      key: `dept-${dept.id}`,
      label: ln(dept),
      departmentId: dept.id,
      sectionId: null,
      readonly: false,
    }];
  }, [departments, sectionsByDept, departmentFilter, ln]);

  // --- Load existing limits for the selected year/month -----------------
  const loadLimits = useCallback(async () => {
    if (loading) return; // wait for reference data to be ready
    try {
      const { data, error } = await supabase
        .from('monthly_limits')
        .select('*')
        .eq('year', year)
        .eq('month', month);

      if (error) throw error;

      const next: Record<ValueKey, string> = {};
      for (const row of (data as MonthlyLimit[]) ?? []) {
        next[cellKey(row.department_id, row.section_id, row.fuel_type_id)] = String(row.limit_value ?? 0);
      }
      setValues(next);
      setInitialValues(next);
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
    }
  }, [year, month, loading, t]);

  useEffect(() => {
    void loadLimits();
  }, [loadLimits]);

  // --- Cell helpers ------------------------------------------------------
  const setCell = (departmentId: string, sectionId: string | null, fuelTypeId: string, raw: string) => {
    const key = cellKey(departmentId, sectionId, fuelTypeId);
    setValues((prev) => ({ ...prev, [key]: raw }));
  };

  /** Sum of section-level values for a department + fuel type. */
  const sectionSum = useCallback(
    (departmentId: string, fuelTypeId: string): number => {
      let sum = 0;
      for (const s of sections) {
        if (s.department_id !== departmentId) continue;
        const v = Number(values[cellKey(departmentId, s.id, fuelTypeId)]);
        if (Number.isFinite(v)) sum += v;
      }
      return sum;
    },
    [sections, values],
  );

  const hasChanges = useMemo(() => {
    const keys = new Set([...Object.keys(values), ...Object.keys(initialValues)]);
    for (const k of keys) {
      if ((values[k] ?? '') !== (initialValues[k] ?? '')) return true;
    }
    return false;
  }, [values, initialValues]);

  // --- Save --------------------------------------------------------------
  const handleSave = async () => {
    if (!canEdit || saving) return;

    // Build the payload from the current grid state, restricted to the
    // rows actually visible/editable so we never write aggregated totals.
    const payload: Array<{
      department_id: string;
      section_id: string | null;
      fuel_type_id: string;
      limit_value: number;
    }> = [];

    for (const row of rows) {
      if (row.readonly) continue; // aggregated totals are derived, not stored
      for (const ft of fuelTypes) {
        if (!enabledFuels.has(`${row.departmentId}|${ft.id}`)) continue;
        const key = cellKey(row.departmentId, row.sectionId, ft.id);
        const raw = values[key];
        if (raw === undefined || raw === '') continue; // skip untouched cells
        const num = parseNumber(raw);
        payload.push({
          department_id: row.departmentId,
          section_id: row.sectionId,
          fuel_type_id: ft.id,
          limit_value: num,
        });
      }
    }

    if (payload.length === 0) {
      toast.warning('Saqlash uchun ma\u0027lumot yo\u0027q');
      return;
    }

    setSaving(true);
    try {
      // Fetch existing limits for the period to decide UPDATE vs INSERT.
      const { data: existing, error: fetchError } = await supabase
        .from('monthly_limits')
        .select('id, department_id, section_id, fuel_type_id')
        .eq('year', year)
        .eq('month', month);

      if (fetchError) throw fetchError;

      const existingMap = new Map<string, string>();
      for (const row of (existing ?? []) as Array<{
        id: string;
        department_id: string;
        section_id: string | null;
        fuel_type_id: string;
      }>) {
        existingMap.set(cellKey(row.department_id, row.section_id, row.fuel_type_id), row.id);
      }

      const toUpdate: Array<{ id: string; limit_value: number }> = [];
      const toInsert: Array<{
        department_id: string;
        section_id: string | null;
        fuel_type_id: string;
        year: number;
        month: number;
        limit_value: number;
      }> = [];

      for (const item of payload) {
        const key = cellKey(item.department_id, item.section_id, item.fuel_type_id);
        const existingId = existingMap.get(key);
        if (existingId) {
          toUpdate.push({ id: existingId, limit_value: item.limit_value });
        } else {
          toInsert.push({
            department_id: item.department_id,
            section_id: item.section_id,
            fuel_type_id: item.fuel_type_id,
            year,
            month,
            limit_value: item.limit_value,
          });
        }
      }

      // Run updates and inserts. Supabase-js filters are stateless per call,
      // so we issue one update per id (safe and simple for modest grids).
      let firstError: string | null = null;

      for (const u of toUpdate) {
        const { error } = await supabase
          .from('monthly_limits')
          .update({ limit_value: u.limit_value })
          .eq('id', u.id);
        if (error && !firstError) firstError = error.message;
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('monthly_limits').insert(toInsert);
        if (insertError && !firstError) firstError = insertError.message;
      }

      if (firstError) throw new Error(firstError);

      toast.success(t('saved'));
      await loadLimits(); // refresh baseline so hasChanges resets
    } catch (err) {
      console.error(err);
      toast.error(`${t('error')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // --- Render ------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  const yearOptions = (() => {
    const years: number[] = [];
    for (let y = 2024; y <= 2040; y++) years.push(y);
    return years;
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Table2 className="h-6 w-6 text-primary" />
            {t('limits')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('monthlyLimit')}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? t('loading') : t('save')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('year')}
          </label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-border bg-background py-2.5 pl-10 pr-8 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('month')}
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full appearance-none rounded-xl border border-border bg-background py-2.5 px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
          >
            {monthNames.map((label, idx) => (
              <option key={idx + 1} value={idx + 1}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('department')}
          </label>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-background py-2.5 pl-10 pr-8 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
            >
              <option value="all">{t('all')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{ln(d)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {rows.length === 0 || fuelTypes.length === 0 || enabledFuels.size === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center shadow-sm">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">{t('noData')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="sticky left-0 z-10 min-w-[180px] border-r border-border bg-muted/30 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {departmentFilter === 'all' ? t('department') : t('section')}
                </th>
                {fuelTypes.map((ft) =>
                  rows.some((r) => enabledFuels.has(`${r.departmentId}|${ft.id}`)) ? (
                    <th
                      key={ft.id}
                      className="min-w-[140px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{ln(ft)}</span>
                        {ft.unit && (
                          <span className="text-[10px] font-normal normal-case text-muted-foreground/70">
                            {formatUnit(ft.unit, lang)}
                          </span>
                        )}
                      </div>
                    </th>
                  ) : null,
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.key} className="transition hover:bg-muted/30">
                  <td className="sticky left-0 z-10 border-r border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{row.label}</span>
                      {row.readonly && (
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          {t('total')}
                        </span>
                      )}
                    </div>
                  </td>
                  {fuelTypes.map((ft) => {
                    if (!enabledFuels.has(`${row.departmentId}|${ft.id}`)) return null;
                    const key = cellKey(row.departmentId, row.sectionId, ft.id);
                    const value = values[key] ?? '';

                    if (row.readonly) {
                      const sum = sectionSum(row.departmentId, ft.id);
                      return (
                        <td
                          key={ft.id}
                          className="px-3 py-2.5 text-center text-sm tabular-nums text-muted-foreground"
                        >
                          {sum || '—'}
                        </td>
                      );
                    }

                    return (
                      <td key={ft.id} className="px-2 py-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min={0}
                          disabled={!canEdit || saving}
                          value={value}
                          onChange={(e) => setCell(row.departmentId, row.sectionId, ft.id, e.target.value)}
                          placeholder="—"
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-center text-sm tabular-nums text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        {value && Number(value) > 0 && (
                          <div className="mt-1 text-center text-[10px] text-muted-foreground">
                            {'Kunlik:'}{' '}
                            {(Number(value) / daysInMonth(year, month)).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Helper note */}
      <p className="text-xs text-muted-foreground">
        {departmentFilter === 'all'
          ? "Bo'limlarga ega sexlar bo'yicha jami qiymatlar avtomatik hisoblanadi."
          : 'Har bir bo\u2018lim uchun limitni kiriting va "Saqlash" tugmasini bosing.'}
      </p>
    </div>
  );
}