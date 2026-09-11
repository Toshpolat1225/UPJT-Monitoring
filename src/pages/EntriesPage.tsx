import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, FileDown, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import apiClient from '../lib/client';
import {
  type Department,
  type Section,
  type Vehicle,
  type FuelType,
  type DailyEntry,
  type MonthlyLimit,
} from '../types';
import { useI18n, formatUnit } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';
import { computeFuelTotals } from '../lib/fuelTotals';
import { getErrorMessage } from '../lib/errorMessage';

// ============================================================
// Types
// ============================================================

interface EntryRow extends DailyEntry {
  department?: (Pick<Department, 'name_uz' | 'code'> & { company?: { short_name: string } | null }) | null;
  section?: Pick<Section, 'name_uz' | 'name_uz'> | null;
  vehicle?: Pick<Vehicle, 'code' | 'name_uz' | 'name_uz'> | null;
  fuel_type?: Pick<FuelType, 'name_uz' | 'name_uz' | 'unit'> | null;
}

interface FormState {
  id?: string;
  entry_date: string;
  department_id: string;
  section_id: string;
  vehicle_id: string;
  fuel_type_id: string;
  opening_balance: string;
  received_azs: string;
  transfer_in: string;
  transfer_out: string;
  consumption: string;
}

// ============================================================
// Helpers
// ============================================================

const todayStr = (): string => new Date().toISOString().slice(0, 10);

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtNum = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('uz-UZ', { maximumFractionDigits: 2 });

const exportNumber = (n: number | null | undefined): number | string =>
  n == null || !Number.isFinite(n) ? '—' : n;

const fmtPct = (n: number): string =>
  Number.isFinite(n) ? `${Math.ceil(n)}%` : '0%';

const emptyForm = (): FormState => ({
  entry_date: todayStr(),
  department_id: '',
  section_id: '',
  vehicle_id: '',
  fuel_type_id: '',
  opening_balance: '',
  received_azs: '',
  transfer_in: '',
  transfer_out: '',
  consumption: '',
});

const calcClosing = (f: FormState): number =>
  num(f.opening_balance) +
  num(f.received_azs) +
  num(f.transfer_in) -
  num(f.transfer_out) -
  num(f.consumption);

// ============================================================
// Component
// ============================================================

export function EntriesPage() {
  const { t, ln, lang } = useI18n();
  const { user, hasAny } = useAuth();
  const isAdmin = hasAny(['admin']);

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [filterDateTo, setFilterDateTo] = useState<string>(todayStr());
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterVehicle, setFilterVehicle] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterFuel, setFilterFuel] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<keyof DailyEntry | 'company' | 'vehicle_name' | 'section_name' | 'fuel_name'>('entry_date');
  const [sortAsc, setSortAsc] = useState(false);

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [enabledFuels, setEnabledFuels] = useState<Set<string>>(new Set());

  // Entries
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [limits, setLimits] = useState<MonthlyLimit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingDisabledFuel, setEditingDisabledFuel] = useState(false);

  // --------------------------------------------------------
  // Load reference data once
  // --------------------------------------------------------
  useEffect(() => {
    (async () => {
      const [deptsRes, secsRes, vehsRes, fuelsRes, matrixRes] = await Promise.all([
        apiClient.get('/master-data/departments'),
        apiClient.get('/master-data/sections'),
        apiClient.get('/master-data/vehicles'),
        apiClient.get('/master-data/fuel-types'),
        apiClient.get('/fuel-matrix'),
      ]);

      setDepartments((deptsRes.data as Department[]) ?? []);
      setSections((secsRes.data as Section[]) ?? []);
      setVehicles((vehsRes.data as Vehicle[]) ?? []);
      setFuelTypes((fuelsRes.data as FuelType[]) ?? []);

      const matrix = (matrixRes.data as Array<{ department_id: string; fuel_type_id: string; is_active: boolean }>) ?? [];
      setEnabledFuels(
        new Set(matrix.filter((row) => row.is_active).map((row) => `${row.department_id}|${row.fuel_type_id}`)),
      );
    })();
  }, []);

  // --------------------------------------------------------
  // Load entries for current filter
  // --------------------------------------------------------
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, limitsRes] = await Promise.all([
        apiClient.get('/entries', {
          params: {
            date_from: filterDateFrom,
            date_to: filterDateTo,
            department_id: filterDept || undefined,
            vehicle_id: filterVehicle || undefined,
          },
        }),
        apiClient.get('/limits', {
          params: {
            year: parseInt(filterDateFrom.slice(0, 4)),
            month: parseInt(filterDateFrom.slice(5, 7)),
          },
        }),
      ]);

      setEntries((entriesRes.data as EntryRow[]) ?? []);
      setLimits((limitsRes.data as MonthlyLimit[]) ?? []);
    } catch (error: unknown) {
      toast.error(`${t('error')}: ${getErrorMessage(error, 'Failed to load entries')}`);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filterDateFrom, filterDateTo, filterDept, filterVehicle, t]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // --------------------------------------------------------
  // Derived data for the form
  // --------------------------------------------------------
  const formSections = useMemo(
    () => sections.filter((s) => s.department_id === form.department_id),
    [sections, form.department_id],
  );

  const formVehicles = useMemo(
    () => vehicles.filter((v) =>
      v.department_id === form.department_id &&
      enabledFuels.has(`${v.department_id}|${v.fuel_type_id}`),
    ),
    [vehicles, form.department_id, enabledFuels],
  );

  const selectedFuelType = useMemo(
    () => fuelTypes.find((f) => f.id === form.fuel_type_id) ?? null,
    [fuelTypes, form.fuel_type_id],
  );

  const closingBalance = useMemo(() => calcClosing(form), [form]);

  // The server is authoritative for the balance chain. Fetch the derived
  // opening value only for display; it is never editable or trusted on save.
  useEffect(() => {
    if (!modalOpen || form.id || !form.vehicle_id || !form.fuel_type_id || !form.entry_date) return;
    let active = true;
    void apiClient.get('/entries/opening-balance', {
      params: { vehicle_id: form.vehicle_id, fuel_type_id: form.fuel_type_id, entry_date: form.entry_date },
    }).then(({ data }) => {
      const opening = data?.opening_balance;
      if (active && typeof opening === 'number') {
        setForm((prev) => ({ ...prev, opening_balance: String(opening) }));
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [modalOpen, form.id, form.vehicle_id, form.fuel_type_id, form.entry_date]);

  // --------------------------------------------------------
  // Modal handlers
  // --------------------------------------------------------
  const openCreate = () => {
    setForm(emptyForm());
    setEditingDisabledFuel(false);
    setModalOpen(true);
  };

  const openEdit = (row: EntryRow) => {
    const isFuelEnabled = enabledFuels.has(`${row.department_id}|${row.fuel_type_id}`);
    setForm({
      id: row.id,
      entry_date: row.entry_date,
      department_id: row.department_id,
      section_id: row.section_id ?? '',
      vehicle_id: row.vehicle_id,
      fuel_type_id: row.fuel_type_id,
      opening_balance: String(row.opening_balance ?? ''),
      received_azs: String(row.received_azs ?? ''),
      transfer_in: String(row.transfer_in ?? ''),
      transfer_out: String(row.transfer_out ?? ''),
      consumption: String(row.consumption ?? ''),
    });
    // If the existing entry references a disabled fuel, keep it viewable but
    // mark it so the dropdown shows it as a locked selection.
    setEditingDisabledFuel(!isFuelEnabled);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm());
    setEditingDisabledFuel(false);
  };

  const handleField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // When department changes, reset section + vehicle
  const handleDeptChange = (deptId: string) => {
    setForm((prev) => ({
      ...prev,
      department_id: deptId,
      section_id: '',
      vehicle_id: '',
      fuel_type_id: '',
    }));
  };

  // When vehicle changes, auto-fill fuel type from vehicle (only if enabled)
  const handleVehicleChange = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    const fuelId = v?.fuel_type_id ?? '';
    const isAllowed = fuelId && enabledFuels.has(`${v?.department_id}|${fuelId}`);
    setForm((prev) => ({
      ...prev,
      vehicle_id: vehicleId,
      fuel_type_id: isAllowed ? fuelId : '',
    }));
  };

  // --------------------------------------------------------
  // Save (create or update)
  // --------------------------------------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t('noPermission'));
      return;
    }

    if (!form.department_id || !form.vehicle_id || !form.fuel_type_id || !form.entry_date) {
      toast.error(t('error'));
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(form.id);

      // This is display-only. The API resolves opening and closing balances
      // from the persisted chain, so client state cannot alter them.
      const opening = num(form.opening_balance);
      const closing = calcClosing({ ...form, opening_balance: String(opening) });

      const payload = {
        entry_date: form.entry_date,
        department_id: form.department_id,
        section_id: form.section_id || null,
        vehicle_id: form.vehicle_id,
        fuel_type_id: form.fuel_type_id,
        opening_balance: opening,
        received_azs: num(form.received_azs),
        transfer_in: num(form.transfer_in),
        transfer_out: num(form.transfer_out),
        consumption: num(form.consumption),
        closing_balance: closing,
      };

      if (isEdit) {
        await apiClient.put(`/entries/${form.id}`, payload);
      } else {
        await apiClient.post('/entries', { ...payload, created_by: user.id });
      }

      toast.success(t('saved'));
      closeModal();
      await loadEntries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('error')}: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------
  // Delete
  // --------------------------------------------------------
  const handleDelete = async (row: EntryRow) => {
    if (!isAdmin) return;
    const ok = window.confirm(t('confirmDelete'));
    if (!ok) return;

    setDeletingId(row.id);
    try {
      await apiClient.delete(`/entries/${row.id}`);

      toast.success(t('delete'));
      await loadEntries();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('error')}: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  };

  // --------------------------------------------------------
  // Totals (computed from filtered entries only)
  // --------------------------------------------------------
  const displayedEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const value = (entry: EntryRow, key: typeof sortKey): string | number => {
      if (key === 'company') return entry.department?.company?.short_name ?? '';
      if (key === 'vehicle_name') return entry.vehicle?.name_uz ?? '';
      if (key === 'section_name') return entry.section?.name_uz ?? '';
      if (key === 'fuel_name') return entry.fuel_type?.name_uz ?? '';
      return entry[key] ?? '';
    };
    return entries.filter((e) =>
      (!filterSection || e.section_id === filterSection) &&
      (!filterFuel || e.fuel_type_id === filterFuel) &&
      (!term || [e.entry_date, e.vehicle?.name_uz, e.vehicle?.code, e.department?.name_uz, e.department?.company?.short_name, e.section?.name_uz, e.fuel_type?.name_uz].some((v) => v?.toLocaleLowerCase().includes(term))),
    ).sort((a, b) => {
      const av = value(a, sortKey); const bv = value(b, sortKey);
      const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'uz');
      return sortAsc ? result : -result;
    });
  }, [entries, filterSection, filterFuel, search, sortKey, sortAsc]);

  const numericTotals = useMemo(() => displayedEntries.reduce((total, row) => ({
    opening_balance: total.opening_balance + (row.opening_balance ?? 0), received_azs: total.received_azs + (row.received_azs ?? 0),
    transfer_in: total.transfer_in + (row.transfer_in ?? 0), transfer_out: total.transfer_out + (row.transfer_out ?? 0),
    consumption: total.consumption + (row.consumption ?? 0), closing_balance: total.closing_balance + (row.closing_balance ?? 0),
  }), { opening_balance: 0, received_azs: 0, transfer_in: 0, transfer_out: 0, consumption: 0, closing_balance: 0 }), [displayedEntries]);
  const deviation = fuelTotals.grand.actual - fuelTotals.grand.limit;
  const deviationPct = fuelTotals.grand.limit > 0 ? (deviation / fuelTotals.grand.limit) * 100 : null;
  const toggleSort = (key: typeof sortKey) => { if (sortKey === key) setSortAsc((v) => !v); else { setSortKey(key); setSortAsc(true); } };

  const fuelTotals = useMemo(
    () => computeFuelTotals(displayedEntries, fuelTypes, limits),
    [displayedEntries, fuelTypes, limits],
  );

  const entryToExportRow = (e: EntryRow): (string | number)[] => [
    e.entry_date,
    e.vehicle ? ln(e.vehicle) : '—',
    e.vehicle?.code ?? '—',
    e.section ? ln(e.section) : '—',
    e.fuel_type
      ? `${ln(e.fuel_type)}${e.fuel_type.unit ? ` ${formatUnit(e.fuel_type.unit, lang)}` : ''}`
      : '—',
    exportNumber(e.opening_balance),
    exportNumber(e.received_azs),
    exportNumber(e.transfer_in),
    exportNumber(e.transfer_out),
    exportNumber(e.consumption),
    exportNumber(e.closing_balance),
  ];

  // --------------------------------------------------------
  // Excel export (filtered data + Jami block with SUMIF formulas)
  // --------------------------------------------------------
  const handleExport = () => {
    if (loading || displayedEntries.length === 0) {
      toast.error(t('noData'));
      return;
    }

    // Header row — matches visible table columns (excluding actions)
    const headers = [
      t('date'),
      t('vehicle'),
      t('code'),
      t('section'),
      t('fuelType'),
      t('opening'),
      t('receivedAzs'),
      t('transferIn'),
      t('transferOut'),
      t('consumption'),
      t('closing'),
    ];

    const dataRows = displayedEntries.map(entryToExportRow);

    // Build sheet manually with formulas
    const aoa: (string | number)[][] = [headers, ...dataRows];

    // Summary is calculated from exactly the rows being exported. Using values
    // rather than spreadsheet formulas keeps it consistent in every viewer.
    aoa.push([]);
    aoa.push([t('total'), t('fuelType'), t('consumption')]);
    for (const ft of fuelTotals.perFuel) {
      aoa.push([`${t('total')} ${ft.fuelName}`, ft.fuelName, ft.actual]);
    }
    aoa.push([t('grandTotal'), '', fuelTotals.grand.actual]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto column widths
    const colWidths = headers.map((h, i) => {
      let maxLen = String(h).length;
      for (const row of dataRows) {
        const val = String(row[i] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      }
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kunlik kiritish');
    const fileName = `entries_${filterDateFrom}_to_${filterDateTo}${filterDept ? `_${filterDept.slice(0, 8)}` : ''}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success(t('exportExcel'));
  };

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------
  const inputCls =
    'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring disabled:opacity-60';
  const labelCls = 'mb-1.5 block text-xs font-medium text-muted-foreground';

  // --------------------------------------------------------
  // Print
  // --------------------------------------------------------
  const activeFilters = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (filterDateFrom) items.push({ label: t('dateFrom'), value: filterDateFrom });
    if (filterDateTo) items.push({ label: t('dateTo'), value: filterDateTo });
    if (filterDept) {
      const dept = departments.find((d) => d.id === filterDept);
      items.push({ label: t('department'), value: dept ? ln(dept) : filterDept });
    }
    if (filterVehicle) {
      const veh = vehicles.find((v) => v.id === filterVehicle);
      items.push({ label: t('vehicle'), value: veh ? `${veh.code} — ${ln(veh)}` : filterVehicle });
    }
    return items;
  }, [filterDateFrom, filterDateTo, filterDept, filterVehicle, departments, vehicles, t, ln]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-only report header */}
      <div className="print-only hidden">
        <h1 className="text-xl font-bold text-black">{t('printReportTitle')}</h1>
        <p className="mt-1 text-sm text-black">
          {t('printDate')}: {new Date().toLocaleDateString('uz-UZ')} {new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
        </p>
        {activeFilters.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-black">
            {activeFilters.map((f) => (
              <span key={f.label}><strong>{f.label}:</strong> {f.value}</span>
            ))}
          </div>
        )}
        <hr className="mt-3 mb-4 border-black" />
      </div>

      {/* Header */}
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('entries')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('reportingPeriod')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {t('add')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/30"
          >
            <FileDown className="h-4 w-4" />
            {t('exportExcel')}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/30"
          >
            <Printer className="h-4 w-4" />
            {t('print')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <label className={labelCls}>{t('dateFrom')}</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('dateTo')}</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('department')}</label>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className={inputCls}
          >
            <option value="">{t('all')}</option>
            {departments
              .filter((d) => !d.is_total)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {ln(d)}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('vehicle')}</label>
          <select
            value={filterVehicle}
            onChange={(e) => setFilterVehicle(e.target.value)}
            className={inputCls}
          >
            <option value="">{t('all')}</option>
            {vehicles
              .filter((v) => !filterDept || v.department_id === filterDept)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.code} — {ln(v)}
                </option>
              ))}
          </select>
        </div>
        <div><label className={labelCls}>{t('section')}</label><select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className={inputCls}><option value="">{t('all')}</option>{sections.map((x) => <option key={x.id} value={x.id}>{ln(x)}</option>)}</select></div>
        <div><label className={labelCls}>{t('fuelType')}</label><select value={filterFuel} onChange={(e) => setFilterFuel(e.target.value)} className={inputCls}><option value="">{t('all')}</option>{fuelTypes.map((x) => <option key={x.id} value={x.id}>{ln(x)}</option>)}</select></div>
        <div><label className={labelCls}>Qidirish</label><input value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} placeholder="Texnika, kompaniya..." /></div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-sm"><span className="font-semibold">{t('total')} limit: {fmtNum(fuelTotals.grand.limit)}</span><span className="ml-4">Fakt: {fmtNum(fuelTotals.grand.actual)}</span><span className="ml-4">Og‘ish: {fmtNum(deviation)}</span><span className="ml-4">Og‘ish %: {deviationPct == null ? '—' : fmtPct(deviationPct)}</span></div>

      {/* Table */}
      <div className="print-table-wrapper overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th onClick={() => toggleSort('entry_date')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('date')}</th>
                <th onClick={() => toggleSort('vehicle_name')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('vehicle')}</th>
                <th onClick={() => toggleSort('company')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">Kompaniya</th>
                <th onClick={() => toggleSort('department_id')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">Sex</th>
                <th onClick={() => toggleSort('section_name')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('section')}</th>
                <th onClick={() => toggleSort('fuel_name')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('fuelType')}</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">{t('opening')}</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">{t('receivedAzs')}</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">{t('transferIn')}</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">{t('transferOut')}</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">{t('consumption')}</th>
                <th className="px-3 py-2.5 text-right font-semibold text-foreground">{t('closing')}</th>
                <th className="no-print px-3 py-2.5 text-center font-semibold text-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      {t('loading')}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && displayedEntries.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                    {t('noData')}
                  </td>
                </tr>
              )}
              {!loading &&
                displayedEntries.map((e) => (
                  <tr key={e.id} className="border-b border-border transition hover:bg-muted/30">
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">{e.entry_date}</td>
                    <td className="px-3 py-2 text-foreground">{e.vehicle ? `${e.vehicle.code} — ${ln(e.vehicle)}` : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.department?.company?.short_name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.department ? ln(e.department) : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.section ? ln(e.section) : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.fuel_type ? `${ln(e.fuel_type)}` : '—'}{e.fuel_type?.unit ? <span className="ml-1 text-xs text-muted-foreground/70">{formatUnit(e.fuel_type.unit, lang)}</span> : null}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtNum(e.opening_balance)}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtNum(e.received_azs)}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtNum(e.transfer_in)}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtNum(e.transfer_out)}</td>
                    <td className="px-3 py-2 text-right text-foreground">{fmtNum(e.consumption)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{fmtNum(e.closing_balance)}</td>
                    <td className="no-print px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          title={t('edit')}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(e)}
                            disabled={deletingId === e.id}
                            title={t('delete')}
                            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
            {displayedEntries.length > 0 && (
              <tfoot className="border-t-2 border-border bg-muted/40">
                <tr className="font-semibold">
                  <td className="px-3 py-2.5" colSpan={6}>{t('total')}</td>
                  <td className="px-3 py-2.5 text-right">{fmtNum(numericTotals.opening_balance)}</td><td className="px-3 py-2.5 text-right">{fmtNum(numericTotals.received_azs)}</td><td className="px-3 py-2.5 text-right">{fmtNum(numericTotals.transfer_in)}</td><td className="px-3 py-2.5 text-right">{fmtNum(numericTotals.transfer_out)}</td><td className="px-3 py-2.5 text-right">{fmtNum(numericTotals.consumption)}</td><td className="px-3 py-2.5 text-right">{fmtNum(numericTotals.closing_balance)}</td><td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {form.id ? t('edit') : t('newEntry')}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Date */}
                <div>
                  <label className={labelCls}>{t('date')}</label>
                  <input
                    type="date"
                    value={form.entry_date}
                    onChange={(e) => handleField('entry_date', e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>

                {/* Department */}
                <div>
                  <label className={labelCls}>{t('department')} *</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    required
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {departments
                      .filter((d) => !d.is_total)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {ln(d)}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Section */}
                <div>
                  <label className={labelCls}>{t('section')}</label>
                  <select
                    value={form.section_id}
                    onChange={(e) => handleField('section_id', e.target.value)}
                    disabled={!form.department_id}
                    className={inputCls}
                  >
                    <option value="">{form.department_id ? t('all') : t('selectDepartmentFirst')}</option>
                    {formSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {ln(s)}
                      </option>
                    ))}
                  </select>
                  {form.department_id && formSections.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{t('noSectionsForDept')}</p>
                  )}
                </div>

                {/* Vehicle */}
                <div>
                  <label className={labelCls}>{t('vehicle')} *</label>
                  <select
                    value={form.vehicle_id}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    required
                    disabled={!form.department_id}
                    className={inputCls}
                  >
                    <option value="">{form.department_id ? '—' : t('selectDepartmentFirst')}</option>
                    {formVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {ln(v)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fuel type (read-only, auto-filled) */}
                <div>
                  <label className={labelCls}>{t('fuelType')}</label>
                  {editingDisabledFuel ? (
                    <div className={`${inputCls} flex items-center gap-2 border-orange-300 bg-orange-50/50`}>
                      <span className="text-foreground">{selectedFuelType ? ln(selectedFuelType) : '—'}</span>
                      <span className="text-xs text-orange-600">({t('disabled')})</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={selectedFuelType ? ln(selectedFuelType) : ''}
                      readOnly
                      placeholder="—"
                      className={`${inputCls} cursor-not-allowed`}
                    />
                  )}
                  {/* hidden field to keep fuel_type_id in form state */}
                  <input type="hidden" value={form.fuel_type_id} />
                </div>

                {/* Numeric inputs */}
                <div>
                  <label className={labelCls}>{t('opening')}</label>
                  <input
                    type="number"
                    step="any"
                    value={form.opening_balance}
                    readOnly
                    aria-readonly="true"
                    className={`${inputCls} cursor-not-allowed`}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t('receivedAzs')}</label>
                  <input
                    type="number"
                    step="any"
                    value={form.received_azs}
                    onChange={(e) => handleField('received_azs', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t('transferIn')}</label>
                  <input
                    type="number"
                    step="any"
                    value={form.transfer_in}
                    onChange={(e) => handleField('transfer_in', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t('transferOut')}</label>
                  <input
                    type="number"
                    step="any"
                    value={form.transfer_out}
                    onChange={(e) => handleField('transfer_out', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t('consumption')}</label>
                  <input
                    type="number"
                    step="any"
                    value={form.consumption}
                    onChange={(e) => handleField('consumption', e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Closing balance (auto-calc, read-only display) */}
                <div>
                  <label className={labelCls}>{t('closing')}</label>
                  <input
                    type="text"
                    value={fmtNum(closingBalance)}
                    readOnly
                    className={`${inputCls} cursor-not-allowed font-semibold`}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/30 disabled:opacity-60"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.vehicle_id || !form.fuel_type_id}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {saving ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
