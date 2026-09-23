import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileDown, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react';
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
  vehicle?: Pick<Vehicle, 'code' | 'name_uz' | 'name_uz' | 'allowed_fuel_type_ids'> | null;
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
  closing_balance: string;
}

type SortKey = keyof DailyEntry | 'company' | 'vehicle_name' | 'department_name' | 'section_name' | 'fuel_name';

// ============================================================
// Helpers
// ============================================================

const todayStr = (): string => new Date().toISOString().slice(0, 10);

const monthsInRange = (from: string, to: string): Array<{ year: number; month: number }> => {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const result: Array<{ year: number; month: number }> = [];
  for (const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    result.push({ year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1 });
  }
  return result;
};

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtNum = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('uz-UZ', { maximumFractionDigits: 2 });

const exportNumber = (n: number | null | undefined): number | string =>
  n == null || !Number.isFinite(n) ? '—' : n;

const fmtPct = (n: number): string =>
  Number.isFinite(n) ? `${n.toLocaleString('uz-UZ', { maximumFractionDigits: 2 })}%` : '—';

const normalizeFuelGroupName = (value?: string | null): string =>
  (value ?? '').toLocaleLowerCase('uz-UZ').replace(/[^a-z0-9]+/g, ' ').trim();

const matchFuelSummaryGroup = (fuelName: string, fuelCode: string, groupName: 'STG' | 'Benzin' | 'Dizel') => {
  const normalized = normalizeFuelGroupName(`${fuelName} ${fuelCode}`);
  if (groupName === 'STG') return normalized.includes('stg');
  if (groupName === 'Benzin') return normalized.includes('benzin');
  if (groupName === 'Dizel') return normalized.includes('dizel');
  return false;
};

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
  closing_balance: '',
});

interface VehiclePickerProps {
  vehicles: Vehicle[];
  value: string;
  onChange: (vehicleId: string) => void;
  getName: (vehicle: Vehicle) => string;
  disabled?: boolean;
  placeholder: string;
}

function VehiclePicker({ vehicles, value, onChange, getName, disabled = false, placeholder }: VehiclePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === value);
  const selectedLabel = selectedVehicle ? `${selectedVehicle.code} — ${getName(selectedVehicle)}` : '';
  const normalizedQuery = query.trim().toLocaleLowerCase('uz-UZ');
  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!normalizedQuery) return true;
    return [vehicle.id, vehicle.code, vehicle.name, vehicle.name_uz]
      .some((field) => String(field ?? '').toLocaleLowerCase('uz-UZ').includes(normalizedQuery));
  });

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open]);

  const selectVehicle = (vehicle: Vehicle) => {
    onChange(vehicle.id);
    setQuery('');
    setOpen(false);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) => Math.min(index + 1, Math.max(filteredVehicles.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (filteredVehicles[highlightedIndex]) {
        selectVehicle(filteredVehicles[highlightedIndex]);
      }
    }
  };

  const openPicker = () => {
    if (disabled) return;
    setQuery('');
    setHighlightedIndex(0);
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      {!open ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          aria-haspopup="listbox"
          aria-expanded="false"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={`min-w-0 flex-1 truncate ${selectedLabel ? 'text-foreground' : 'text-muted-foreground'}`}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background p-0 focus-within:ring-2 focus-within:ring-ring">
          <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value.toLocaleLowerCase('uz-UZ'));
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            required
            aria-label={placeholder}
            aria-haspopup="listbox"
            aria-expanded="true"
            aria-controls="vehicle-picker-options"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                setHighlightedIndex(0);
                searchInputRef.current?.focus();
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Qidiruvni tozalash"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setOpen(false);
              setQuery('');
            }}
            className="mr-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Qidiruvni yopish"
          >
            <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
          </button>
        </div>
      )}
      {open && !disabled && (
        <div
          id="vehicle-picker-options"
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {filteredVehicles.length > 0 ? filteredVehicles.map((vehicle, index) => (
            <button
              key={vehicle.id}
              type="button"
              role="option"
              aria-selected={vehicle.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectVehicle(vehicle)}
              className={`flex w-full items-start rounded-md px-3 py-2 text-left text-sm transition ${
                index === highlightedIndex ? 'bg-muted' : 'hover:bg-muted/60'
              } ${vehicle.id === value ? 'font-semibold text-primary' : 'text-foreground'}`}
            >
              <span>{vehicle.code} — {getName(vehicle)}</span>
              <span className="ml-auto pl-3 text-xs text-muted-foreground">{vehicle.id}</span>
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">Texnika topilmadi</div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterSection, setFilterSection] = useState<string>('');
  const [filterFuel, setFilterFuel] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<Partial<Record<SortKey, string>>>({});
  const [sortKey, setSortKey] = useState<SortKey>('entry_date');
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
      const entriesRes = await apiClient.get('/entries', {
        params: {
          date_from: filterDateFrom,
          date_to: filterDateTo,
          department_id: filterDept || undefined,
          vehicle_id: filterVehicle || undefined,
        },
      });
      const limitsResponses = await Promise.all(monthsInRange(filterDateFrom, filterDateTo).map((month) =>
        apiClient.get('/limits', { params: { ...month, department_id: filterDept || undefined } }),
      ));

      setEntries((entriesRes.data as EntryRow[]) ?? []);
      setLimits(limitsResponses.flatMap((response) => (response.data as MonthlyLimit[]) ?? []));
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
      (v.allowed_fuel_type_ids ?? [v.fuel_type_id]).some((fuelId) => enabledFuels.has(`${v.department_id}|${fuelId}`)),
    ),
    [vehicles, form.department_id, enabledFuels],
  );

  const pickerVehicles = useMemo(() => {
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicle_id);
    if (selectedVehicle && !formVehicles.some((vehicle) => vehicle.id === selectedVehicle.id)) {
      return [selectedVehicle, ...formVehicles];
    }
    return formVehicles;
  }, [vehicles, form.vehicle_id, formVehicles]);

  const selectedFuelType = useMemo(
    () => fuelTypes.find((f) => f.id === form.fuel_type_id) ?? null,
    [fuelTypes, form.fuel_type_id],
  );

  const formAllowedFuelTypes = useMemo(() => {
    const vehicle = vehicles.find((item) => item.id === form.vehicle_id);
    const allowedIds = vehicle?.allowed_fuel_type_ids ?? (vehicle?.fuel_type_id ? [vehicle.fuel_type_id] : []);
    return fuelTypes.filter((fuel) =>
      allowedIds.includes(fuel.id) && enabledFuels.has(`${form.department_id}|${fuel.id}`),
    );
  }, [vehicles, fuelTypes, enabledFuels, form.vehicle_id, form.department_id]);

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
      closing_balance: String(row.closing_balance ?? ''),
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
    const allowedFuelIds = (v?.allowed_fuel_type_ids ?? [v?.fuel_type_id]).filter(
      (fuelId): fuelId is string => Boolean(fuelId) && enabledFuels.has(`${v?.department_id}|${fuelId}`),
    );
    setForm((prev) => ({
      ...prev,
      vehicle_id: vehicleId,
      fuel_type_id: allowedFuelIds.length === 1 ? allowedFuelIds[0] : '',
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
      const payload = {
        entry_date: form.entry_date,
        department_id: form.department_id,
        section_id: form.section_id || null,
        vehicle_id: form.vehicle_id,
        fuel_type_id: form.fuel_type_id,
        // Opening and closing are server-authoritative chain values.
        received_azs: num(form.received_azs),
        transfer_in: num(form.transfer_in),
        transfer_out: num(form.transfer_out),
        consumption: num(form.consumption),
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
      const msg = getErrorMessage(err, 'Failed to save entry');
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
      const msg = getErrorMessage(err, 'Failed to delete entry');
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
    const numericKeys: SortKey[] = ['opening_balance', 'received_azs', 'transfer_in', 'transfer_out', 'consumption', 'closing_balance'];
    const value = (entry: EntryRow, key: SortKey): string | number => {
      if (key === 'company') return entry.department?.company?.short_name ?? '';
      if (key === 'vehicle_name') return entry.vehicle?.name_uz ?? '';
      if (key === 'department_name') return entry.department?.name_uz ?? '';
      if (key === 'section_name') return entry.section?.name_uz ?? '';
      if (key === 'fuel_name') return entry.fuel_type?.name_uz ?? '';
      return entry[key] ?? '';
    };

    const matchesColumnFilter = (entry: EntryRow, key: SortKey): boolean => {
      const filter = columnFilters[key]?.trim().toLocaleLowerCase('uz-UZ');
      if (!filter) return true;
      const entryValue = value(entry, key);
      if (numericKeys.includes(key)) {
        const numericValue = Number(entryValue);
        const range = filter.split('..').map(Number);
        if (range.length === 2 && range.every(Number.isFinite)) {
          return numericValue >= range[0] && numericValue <= range[1];
        }
        const exactValue = Number(filter);
        return Number.isFinite(exactValue) ? numericValue === exactValue : false;
      }
      return String(entryValue).toLocaleLowerCase('uz-UZ').includes(filter);
    };

    return entries.filter((e) => {
      const matchesDate = (!filterDateFrom || e.entry_date >= filterDateFrom) && (!filterDateTo || e.entry_date <= filterDateTo);
      const matchesDepartment = !filterDept || e.department_id === filterDept;
      const matchesVehicle = !filterVehicle || e.vehicle_id === filterVehicle;
      const matchesCompany = !filterCompany || (e.department?.company?.short_name ?? '').toLocaleLowerCase('uz-UZ').includes(filterCompany.toLocaleLowerCase('uz-UZ'));
      const matchesSection = !filterSection || e.section_id === filterSection;
      const matchesFuel = !filterFuel || e.fuel_type_id === filterFuel;
      const matchesSearch = !term || [
        e.entry_date,
        e.vehicle?.name_uz,
        e.vehicle?.code,
        e.department?.name_uz,
        e.department?.company?.short_name,
        e.section?.name_uz,
        e.fuel_type?.name_uz,
      ].some((v) => v?.toLocaleLowerCase('uz-UZ').includes(term));

      const matchesColumns = (Object.keys(columnFilters) as SortKey[]).every((key) => matchesColumnFilter(e, key));

      return matchesDate && matchesDepartment && matchesVehicle && matchesCompany && matchesSection && matchesFuel && matchesSearch && matchesColumns;
    }).sort((a, b) => {
      const av = value(a, sortKey); const bv = value(b, sortKey);
      const result = numericKeys.includes(sortKey)
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv), 'uz');
      return sortAsc ? result : -result;
    });
  }, [entries, filterDateFrom, filterDateTo, filterDept, filterVehicle, filterCompany, filterSection, filterFuel, search, columnFilters, sortKey, sortAsc]);

  const numericTotals = useMemo(() => displayedEntries.reduce((total, row) => ({
    opening_balance: total.opening_balance + (Number(row.opening_balance) || 0), received_azs: total.received_azs + (Number(row.received_azs) || 0),
    transfer_in: total.transfer_in + (Number(row.transfer_in) || 0), transfer_out: total.transfer_out + (Number(row.transfer_out) || 0),
    consumption: total.consumption + (Number(row.consumption) || 0), closing_balance: total.closing_balance + (Number(row.closing_balance) || 0),
  }), { opening_balance: 0, received_azs: 0, transfer_in: 0, transfer_out: 0, consumption: 0, closing_balance: 0 }), [displayedEntries]);
  const fuelNumericTotals = useMemo(() => {
    const totals = new Map<string, typeof numericTotals>();
    for (const row of displayedEntries) {
      const current = totals.get(row.fuel_type_id) ?? { opening_balance: 0, received_azs: 0, transfer_in: 0, transfer_out: 0, consumption: 0, closing_balance: 0 };
      current.opening_balance += Number(row.opening_balance) || 0;
      current.received_azs += Number(row.received_azs) || 0;
      current.transfer_in += Number(row.transfer_in) || 0;
      current.transfer_out += Number(row.transfer_out) || 0;
      current.consumption += Number(row.consumption) || 0;
      current.closing_balance += Number(row.closing_balance) || 0;
      totals.set(row.fuel_type_id, current);
    }
    return totals;
  }, [displayedEntries]);
  const fuelTotals = useMemo(
    () => computeFuelTotals(displayedEntries, fuelTypes, limits),
    [displayedEntries, fuelTypes, limits],
  );
  const toggleSort = (key: SortKey) => { if (sortKey === key) setSortAsc((v) => !v); else { setSortKey(key); setSortAsc(true); } };

  const summaryRows = useMemo(() => {
    const groupOrder: Array<'STG' | 'Benzin' | 'Dizel'> = ['STG', 'Benzin', 'Dizel'];
    const values = fuelTotals.perFuel.reduce<Record<string, { actual: number; limit: number }>>((acc, fuel) => {
      const fuelCode = fuelTypes.find((type) => type.id === fuel.fuelTypeId)?.code ?? '';
      const match = groupOrder.find((group) => matchFuelSummaryGroup(fuel.fuelName, fuelCode, group));
      const key = match ?? fuel.fuelName;
      const current = acc[key] ?? { actual: 0, limit: 0 };
      current.actual += fuel.actual;
      current.limit += fuel.limit;
      acc[key] = current;
      return acc;
    }, {});

    return groupOrder.map((group) => {
      const total = values[group] ?? { actual: 0, limit: 0 };
      return {
        fuelTypeId: group,
        fuelName: group,
        actual: total.actual,
        limit: total.limit,
        factPercentage: total.limit > 0 ? (total.actual / total.limit) * 100 : null,
        deviation: total.actual - total.limit,
        deviationPercentage: total.limit > 0 ? ((total.actual - total.limit) / total.limit) * 100 : null,
      };
    });
  }, [fuelTotals, fuelTypes]);

  const entryToExportRow = (e: EntryRow): (string | number)[] => [
    e.entry_date,
    e.department?.company?.short_name ?? '—',
    e.department ? ln(e.department) : '—',
    e.section ? ln(e.section) : '—',
    e.vehicle ? `${e.vehicle.code} — ${ln(e.vehicle)}` : '—',
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
  // Excel export (filtered data + the same summary as the screen)
  // --------------------------------------------------------
  const handleExport = () => {
    if (loading) {
      toast.error(t('loading'));
      return;
    }

    const headers = [
      t('date'),
      'Kompaniya qisqa nomi',
      t('department'),
      t('section'),
      t('vehicle'),
      t('fuelType'),
      t('opening'),
      t('receivedAzs'),
      t('transferIn'),
      t('transferOut'),
      t('consumption'),
      t('closing'),
    ];

    const dataRows = displayedEntries.map(entryToExportRow);

    const aoa: (string | number)[][] = [headers, ...dataRows];

    aoa.push([]);
    aoa.push(['Yoqilg\'i turi', 'Jami', 'Limit', 'Fakt %', 'Og\'ish %']);
    for (const ft of summaryRows) {
      aoa.push([ft.fuelName, ft.actual, ft.limit, ft.factPercentage ?? '—', ft.deviationPercentage ?? '—']);
    }

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
  const columnFilterCls = 'w-full min-w-0 rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring';
  const renderColumnFilter = (key: SortKey, placeholder: string, type: 'text' | 'date' = 'text') => (
    <input
      type={type}
      value={columnFilters[key] ?? ''}
      onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))}
      placeholder={placeholder}
      aria-label={`${placeholder} filter`}
      className={columnFilterCls}
    />
  );

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
    if (filterCompany) items.push({ label: 'Kompaniya qisqa nomi', value: filterCompany });
    if (filterVehicle) {
      const veh = vehicles.find((v) => v.id === filterVehicle);
      items.push({ label: t('vehicle'), value: veh ? `${veh.code} — ${ln(veh)}` : filterVehicle });
    }
    if (filterSection) {
      const section = sections.find((s) => s.id === filterSection);
      items.push({ label: t('section'), value: section ? ln(section) : filterSection });
    }
    if (filterFuel) {
      const fuel = fuelTypes.find((f) => f.id === filterFuel);
      items.push({ label: t('fuelType'), value: fuel ? ln(fuel) : filterFuel });
    }
    const columnFilterLabels: Partial<Record<SortKey, string>> = {
      entry_date: t('date'),
      company: 'Kompaniya qisqa nomi',
      department_name: t('department'),
      section_name: t('section'),
      vehicle_name: t('vehicle'),
      fuel_name: t('fuelType'),
      opening_balance: t('opening'),
      received_azs: t('receivedAzs'),
      transfer_in: t('transferIn'),
      transfer_out: t('transferOut'),
      consumption: t('consumption'),
      closing_balance: t('closing'),
    };
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) items.push({ label: `${columnFilterLabels[key as SortKey] ?? key} filter`, value });
    });
    return items;
  }, [filterDateFrom, filterDateTo, filterDept, filterCompany, filterVehicle, filterSection, filterFuel, columnFilters, departments, vehicles, sections, fuelTypes, t, ln]);

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
          <label className={labelCls}>Kompaniya qisqa nomi</label>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className={inputCls}
          >
            <option value="">{t('all')}</option>
            {[...new Set(entries.map((entry) => entry.department?.company?.short_name).filter(Boolean) as string[])].map((company) => (
              <option key={company} value={company}>{company}</option>
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
      <section className="no-print grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Yoqilg'i summary">
        {summaryRows.map((fuel) => (
          <article key={fuel.fuelTypeId} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Jami {fuel.fuelName}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><dt className="text-muted-foreground">Jami</dt><dd className="font-semibold text-foreground">{fmtNum(fuel.actual)}</dd></div>
              <div><dt className="text-muted-foreground">Limit</dt><dd className="font-semibold text-foreground">{fmtNum(fuel.limit)}</dd></div>
              <div><dt className="text-muted-foreground">Fakt %</dt><dd className="font-semibold text-foreground">{fuel.factPercentage == null ? '—' : fmtPct(fuel.factPercentage)}</dd></div>
              <div><dt className="text-muted-foreground">Og'ish %</dt><dd className={`font-semibold ${fuel.deviation > 0 ? 'text-destructive' : 'text-foreground'}`}>{fuel.deviationPercentage == null ? '—' : fmtPct(fuel.deviationPercentage)}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      <div className="print-only hidden rounded-xl border border-gray-300 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-black">Umumiy hisobot</h2>
        <div className="grid grid-cols-3 gap-3 text-sm text-black">
          {summaryRows.map((fuel) => (
            <div key={`${fuel.fuelTypeId}-print`} className="rounded border border-gray-300 p-2">
              <div className="font-semibold">{fuel.fuelName}</div>
              <div>Jami: {fmtNum(fuel.actual)}</div>
              <div>Limit: {fmtNum(fuel.limit)}</div>
              <div>Fakt %: {fuel.factPercentage == null ? '—' : fmtPct(fuel.factPercentage)}</div>
              <div>Og'ish %: {fuel.deviationPercentage == null ? '—' : fmtPct(fuel.deviationPercentage)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="print-table-wrapper overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th onClick={() => toggleSort('entry_date')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('date')}</th>
                <th onClick={() => toggleSort('company')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">Kompaniya qisqa nomi</th>
                <th onClick={() => toggleSort('department_name')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">Sex</th>
                <th onClick={() => toggleSort('section_name')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('section')}</th>
                <th onClick={() => toggleSort('vehicle_name')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('vehicle')}</th>
                <th onClick={() => toggleSort('fuel_name')} className="cursor-pointer px-3 py-2.5 text-left font-semibold text-foreground">{t('fuelType')}</th>
                <th onClick={() => toggleSort('opening_balance')} className="cursor-pointer px-3 py-2.5 text-right font-semibold text-foreground">{t('opening')}</th>
                <th onClick={() => toggleSort('received_azs')} className="cursor-pointer px-3 py-2.5 text-right font-semibold text-foreground">{t('receivedAzs')}</th>
                <th onClick={() => toggleSort('transfer_in')} className="cursor-pointer px-3 py-2.5 text-right font-semibold text-foreground">{t('transferIn')}</th>
                <th onClick={() => toggleSort('transfer_out')} className="cursor-pointer px-3 py-2.5 text-right font-semibold text-foreground">{t('transferOut')}</th>
                <th onClick={() => toggleSort('consumption')} className="cursor-pointer px-3 py-2.5 text-right font-semibold text-foreground">{t('consumption')}</th>
                <th onClick={() => toggleSort('closing_balance')} className="cursor-pointer px-3 py-2.5 text-right font-semibold text-foreground">{t('closing')}</th>
                <th className="no-print px-3 py-2.5 text-center font-semibold text-foreground">{t('actions')}</th>
              </tr>
              <tr className="no-print border-b border-border bg-muted/10">
                <th className="px-2 py-1.5">{renderColumnFilter('entry_date', 'YYYY-MM-DD', 'date')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('company', 'Filter')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('department_name', 'Filter')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('section_name', 'Filter')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('vehicle_name', 'Filter')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('fuel_name', 'Filter')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('opening_balance', 'Min/max')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('received_azs', 'Min/max')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('transfer_in', 'Min/max')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('transfer_out', 'Min/max')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('consumption', 'Min/max')}</th>
                <th className="px-2 py-1.5">{renderColumnFilter('closing_balance', 'Min/max')}</th>
                <th className="no-print px-2 py-1.5" />
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
                    <td className="px-3 py-2 text-muted-foreground">{e.department?.company?.short_name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.department ? ln(e.department) : '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{e.section ? ln(e.section) : '—'}</td>
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">{e.vehicle ? `${e.vehicle.code} — ${ln(e.vehicle)}` : '—'}</td>
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
                {Array.from(fuelNumericTotals.entries()).map(([fuelId, totals]) => {
                  const fuel = fuelTypes.find((item) => item.id === fuelId);
                  return (
                    <tr key={fuelId} className="text-sm">
                      <td className="px-3 py-2" colSpan={6}>{t('total')} ({fuel?.name_uz ?? '—'})</td>
                      <td className="px-3 py-2 text-right">{fmtNum(totals.opening_balance)}</td><td className="px-3 py-2 text-right">{fmtNum(totals.received_azs)}</td><td className="px-3 py-2 text-right">{fmtNum(totals.transfer_in)}</td><td className="px-3 py-2 text-right">{fmtNum(totals.transfer_out)}</td><td className="px-3 py-2 text-right">{fmtNum(totals.consumption)}</td><td className="px-3 py-2 text-right">{fmtNum(totals.closing_balance)}</td><td />
                    </tr>
                  );
                })}
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
                  <VehiclePicker
                    vehicles={pickerVehicles}
                    value={form.vehicle_id}
                    onChange={handleVehicleChange}
                    getName={ln}
                    disabled={!form.department_id}
                    placeholder={form.department_id ? 'Kod, nomi yoki ID bo\'yicha qidiring' : t('selectDepartmentFirst')}
                  />
                </div>

                {/* Fuel type is constrained by the selected vehicle. */}
                <div>
                  <label className={labelCls}>{t('fuelType')}</label>
                  {editingDisabledFuel ? (
                    <div className={`${inputCls} flex items-center gap-2 border-orange-300 bg-orange-50/50`}>
                      <span className="text-foreground">{selectedFuelType ? ln(selectedFuelType) : '—'}</span>
                      <span className="text-xs text-orange-600">({t('disabled')})</span>
                    </div>
                  ) : formAllowedFuelTypes.length > 1 ? (
                    <select
                      value={form.fuel_type_id}
                      onChange={(e) => handleField('fuel_type_id', e.target.value)}
                      required
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {formAllowedFuelTypes.map((fuel) => (
                        <option key={fuel.id} value={fuel.id}>{ln(fuel)}</option>
                      ))}
                    </select>
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

                {/* Closing balance is calculated by the backend after save. */}
                <div>
                  <label className={labelCls}>{t('closing')}</label>
                  <input
                    type="text"
                    value={form.closing_balance ? fmtNum(Number(form.closing_balance)) : 'Backend hisoblaydi'}
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
