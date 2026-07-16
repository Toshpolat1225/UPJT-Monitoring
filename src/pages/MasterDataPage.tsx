import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, X, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  supabase,
  type Department,
  type Section,
  type Vehicle,
  type FuelType,
  type FuelUnit,
  type Company,
} from '../lib/supabase';
import { useI18n, formatUnit } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TabKey = 'companies' | 'departments' | 'sections' | 'vehicles' | 'fuel_types';

interface DepartmentForm {
  code: string;
  name_uz: string;
  name_ru: string;
  is_total: boolean;
  company_id: string;
}
interface CompanyForm {
  short_name: string;
  full_name: string;
}
interface SectionForm {
  department_id: string;
  name_uz: string;
  name_ru: string;
}
interface VehicleForm {
  code: string;
  name_uz: string;
  name_ru: string;
  department_id: string;
  fuel_type_id: string;
}
interface FuelTypeForm {
  code: string;
  name_uz: string;
  name_ru: string;
  unit: FuelUnit;
}

const EMPTY_DEPARTMENT_FORM: DepartmentForm = {
  code: '',
  name_uz: '',
  name_ru: '',
  is_total: false,
  company_id: '',
};
const EMPTY_COMPANY_FORM: CompanyForm = {
  short_name: '',
  full_name: '',
};
const EMPTY_SECTION_FORM: SectionForm = {
  department_id: '',
  name_uz: '',
  name_ru: '',
};
const EMPTY_VEHICLE_FORM: VehicleForm = {
  code: '',
  name_uz: '',
  name_ru: '',
  department_id: '',
  fuel_type_id: '',
};
const EMPTY_FUEL_TYPE_FORM: FuelTypeForm = {
  code: '',
  name_uz: '',
  name_ru: '',
  unit: 'litr',
};

const FUEL_UNITS: FuelUnit[] = ['litr', 'm3'];

/* ------------------------------------------------------------------ */
/* Shared UI primitives                                                */
/* ------------------------------------------------------------------ */

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/30 hover:text-foreground"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40 placeholder:text-muted-foreground';
const labelClass = 'mb-1.5 block text-sm font-medium text-foreground';
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60';
const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/30';
const btnDestructive =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function FormActions({
  saving,
  onCancel,
  submitLabel,
}: {
  saving: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className={`${btnGhost} flex-1`}>
        <X className="h-4 w-4" />
        {t('cancel')}
      </button>
      <button type="submit" disabled={saving} className={`${btnPrimary} flex-1`}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {saving ? t('loading') : submitLabel}
      </button>
    </div>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useI18n();
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {t('noData')}
      </td>
    </tr>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function MasterDataPage() {
  const { t, ln, lang } = useI18n();
  const { hasAny } = useAuth();
  const isAdmin = hasAny(['admin']);

  const [activeTab, setActiveTab] = useState<TabKey>('departments');

  // data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // loading / error per tab
  const [loading, setLoading] = useState<Record<TabKey, boolean>>({
    companies: false,
    departments: false,
    sections: false,
    vehicles: false,
    fuel_types: false,
  });
  const [error, setError] = useState<Record<TabKey, string | null>>({
    companies: null,
    departments: null,
    sections: null,
    vehicles: null,
    fuel_types: null,
  });

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deptForm, setDeptForm] = useState<DepartmentForm>(EMPTY_DEPARTMENT_FORM);
  const [sectionForm, setSectionForm] = useState<SectionForm>(EMPTY_SECTION_FORM);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(EMPTY_VEHICLE_FORM);
  const [fuelTypeForm, setFuelTypeForm] = useState<FuelTypeForm>(EMPTY_FUEL_TYPE_FORM);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(EMPTY_COMPANY_FORM);

  // delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- fetchers ---------------- */

  const fetchDepartments = useCallback(async () => {
    setLoading((s) => ({ ...s, departments: true }));
    setError((s) => ({ ...s, departments: null }));
    const { data, error: e } = await supabase
      .from('departments')
      .select('*')
      .order('code', { ascending: true });
    if (e) setError((s) => ({ ...s, departments: e.message }));
    else setDepartments((data as Department[]) ?? []);
    setLoading((s) => ({ ...s, departments: false }));
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading((s) => ({ ...s, companies: true }));
    setError((s) => ({ ...s, companies: null }));
    const { data, error: e } = await supabase
      .from('companies')
      .select('*')
      .order('short_name', { ascending: true });
    if (e) setError((s) => ({ ...s, companies: e.message }));
    else setCompanies((data as Company[]) ?? []);
    setLoading((s) => ({ ...s, companies: false }));
  }, []);

  const fetchSections = useCallback(async () => {
    setLoading((s) => ({ ...s, sections: true }));
    setError((s) => ({ ...s, sections: null }));
    const { data, error: e } = await supabase
      .from('sections')
      .select('*')
      .order('name_uz', { ascending: true });
    if (e) setError((s) => ({ ...s, sections: e.message }));
    else setSections((data as Section[]) ?? []);
    setLoading((s) => ({ ...s, sections: false }));
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading((s) => ({ ...s, vehicles: true }));
    setError((s) => ({ ...s, vehicles: null }));
    const { data, error: e } = await supabase
      .from('vehicles')
      .select('*')
      .order('code', { ascending: true });
    if (e) setError((s) => ({ ...s, vehicles: e.message }));
    else setVehicles((data as Vehicle[]) ?? []);
    setLoading((s) => ({ ...s, vehicles: false }));
  }, []);

  const fetchFuelTypes = useCallback(async () => {
    setLoading((s) => ({ ...s, fuel_types: true }));
    setError((s) => ({ ...s, fuel_types: null }));
    const { data, error: e } = await supabase
      .from('fuel_types')
      .select('*')
      .order('code', { ascending: true });
    if (e) setError((s) => ({ ...s, fuel_types: e.message }));
    else setFuelTypes((data as FuelType[]) ?? []);
    setLoading((s) => ({ ...s, fuel_types: false }));
  }, []);

  // initial load + reload lookups whenever departments/fuelTypes change
  useEffect(() => {
    void fetchDepartments();
    void fetchFuelTypes();
    void fetchCompanies();
  }, [fetchDepartments, fetchFuelTypes, fetchCompanies]);

  useEffect(() => {
    if (activeTab === 'sections') void fetchSections();
  }, [activeTab, fetchSections]);

  useEffect(() => {
    if (activeTab === 'vehicles') void fetchVehicles();
  }, [activeTab, fetchVehicles]);

  /* ---------------- helpers ---------------- */

  const departmentName = useCallback(
    (id: string | null) => departments.find((d) => d.id === id) ?? null,
    [departments],
  );
  const fuelTypeName = useCallback(
    (id: string | null) => fuelTypes.find((f) => f.id === id) ?? null,
    [fuelTypes],
  );

  const refreshActive = useCallback(() => {
    switch (activeTab) {
      case 'companies':
        void fetchCompanies();
        break;
      case 'departments':
        void fetchDepartments();
        break;
      case 'sections':
        void fetchSections();
        break;
      case 'vehicles':
        void fetchVehicles();
        break;
      case 'fuel_types':
        void fetchFuelTypes();
        break;
    }
  }, [activeTab, fetchDepartments, fetchSections, fetchVehicles, fetchFuelTypes, fetchCompanies]);

  /* ---------------- modal open/close ---------------- */

  const openCreate = () => {
    setEditingId(null);
    switch (activeTab) {
      case 'companies':
        setCompanyForm(EMPTY_COMPANY_FORM);
        break;
      case 'departments':
        setDeptForm({ ...EMPTY_DEPARTMENT_FORM, company_id: companies[0]?.id ?? '' });
        break;
      case 'sections':
        setSectionForm({ ...EMPTY_SECTION_FORM, department_id: departments[0]?.id ?? '' });
        break;
      case 'vehicles':
        setVehicleForm({
          ...EMPTY_VEHICLE_FORM,
          department_id: departments[0]?.id ?? '',
          fuel_type_id: fuelTypes[0]?.id ?? '',
        });
        break;
      case 'fuel_types':
        setFuelTypeForm(EMPTY_FUEL_TYPE_FORM);
        break;
    }
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    switch (activeTab) {
      case 'companies': {
        const c = companies.find((x) => x.id === id);
        if (c)
          setCompanyForm({
            short_name: c.short_name ?? '',
            full_name: c.full_name ?? '',
          });
        break;
      }
      case 'departments': {
        const d = departments.find((x) => x.id === id);
        if (d)
          setDeptForm({
            code: d.code ?? '',
            name_uz: d.name_uz ?? '',
            name_ru: d.name_ru ?? '',
            is_total: !!d.is_total,
            company_id: d.company_id ?? '',
          });
        break;
      }
      case 'sections': {
        const s = sections.find((x) => x.id === id);
        if (s)
          setSectionForm({
            department_id: s.department_id ?? '',
            name_uz: s.name_uz ?? '',
            name_ru: s.name_ru ?? '',
          });
        break;
      }
      case 'vehicles': {
        const v = vehicles.find((x) => x.id === id);
        if (v)
          setVehicleForm({
            code: v.code ?? '',
            name_uz: v.name_uz ?? '',
            name_ru: v.name_ru ?? '',
            department_id: v.department_id ?? '',
            fuel_type_id: v.fuel_type_id ?? '',
          });
        break;
      }
      case 'fuel_types': {
        const f = fuelTypes.find((x) => x.id === id);
        if (f)
          setFuelTypeForm({
            code: f.code ?? '',
            name_uz: f.name_uz ?? '',
            name_ru: f.name_ru ?? '',
            unit: f.unit ?? 'litr',
          });
        break;
      }
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  /* ---------------- submit ---------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (activeTab === 'companies') {
        const payload = {
          short_name: companyForm.short_name.trim(),
          full_name: companyForm.full_name.trim(),
        };
        const op = editingId
          ? supabase.from('companies').update(payload).eq('id', editingId)
          : supabase.from('companies').insert(payload);
        const { error: err } = await op;
        if (err) throw err;
      } else if (activeTab === 'departments') {
        const payload = {
          code: deptForm.code.trim(),
          name_uz: deptForm.name_uz.trim(),
          name_ru: deptForm.name_ru.trim(),
          name: deptForm.name_uz.trim(),
          is_total: deptForm.is_total,
          company_id: deptForm.company_id || null,
        };
        const op = editingId
          ? supabase.from('departments').update(payload).eq('id', editingId)
          : supabase.from('departments').insert(payload);
        const { error: err } = await op;
        if (err) throw err;
      } else if (activeTab === 'sections') {
        const payload = {
          department_id: sectionForm.department_id,
          name_uz: sectionForm.name_uz.trim(),
          name_ru: sectionForm.name_ru.trim(),
          name: sectionForm.name_uz.trim(),
        };
        const op = editingId
          ? supabase.from('sections').update(payload).eq('id', editingId)
          : supabase.from('sections').insert(payload);
        const { error: err } = await op;
        if (err) throw err;
      } else if (activeTab === 'vehicles') {
        const payload = {
          code: vehicleForm.code.trim(),
          name_uz: vehicleForm.name_uz.trim(),
          name_ru: vehicleForm.name_ru.trim(),
          name: vehicleForm.name_uz.trim(),
          department_id: vehicleForm.department_id,
          fuel_type_id: vehicleForm.fuel_type_id,
        };
        const op = editingId
          ? supabase.from('vehicles').update(payload).eq('id', editingId)
          : supabase.from('vehicles').insert(payload);
        const { error: err } = await op;
        if (err) throw err;
      } else if (activeTab === 'fuel_types') {
        const payload = {
          code: fuelTypeForm.code.trim(),
          name_uz: fuelTypeForm.name_uz.trim(),
          name_ru: fuelTypeForm.name_ru.trim(),
          name: fuelTypeForm.name_uz.trim(),
          unit: fuelTypeForm.unit,
        };
        const op = editingId
          ? supabase.from('fuel_types').update(payload).eq('id', editingId)
          : supabase.from('fuel_types').insert(payload);
        const { error: err } = await op;
        if (err) throw err;
      }

      toast.success(t('saved'));
      closeModal();
      refreshActive();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('error')}: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- delete ---------------- */

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase
        .from(activeTab)
        .delete()
        .eq('id', deleteTarget.id);
      if (err) throw err;
      toast.success(t('delete'));
      setDeleteTarget(null);
      refreshActive();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`${t('error')}: ${msg}`);
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- derived ---------------- */

  const tabs = useMemo<{ key: TabKey; label: string }[]>(
    () => [
      { key: 'companies', label: t('companies') },
      { key: 'departments', label: t('department') },
      { key: 'sections', label: t('section') },
      { key: 'vehicles', label: t('vehicle') },
      { key: 'fuel_types', label: t('fuelType') },
    ],
    [t],
  );

  const modalTitle = editingId ? t('edit') : t('add');
  const submitLabel = editingId ? t('save') : t('create');
  const isLoading = loading[activeTab];
  const tabError = error[activeTab];

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('masterData')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tabs.find((x) => x.key === activeTab)?.label}
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={openCreate} className={btnPrimary}>
            <Plus className="h-4 w-4" />
            {t('add')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {tabError && (
        <div className="mb-2">
          <ErrorBanner message={tabError} />
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Companies table */}
          {activeTab === 'companies' && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('shortName')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('fullName')}</th>
                      {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{t('actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {companies.length === 0 ? (
                      <EmptyRow colSpan={isAdmin ? 3 : 2} />
                    ) : (
                      companies.map((c) => (
                        <tr key={c.id} className="transition hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{c.short_name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{c.full_name}</td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(c.id)}
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                  aria-label={t('edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget({ id: c.id, label: c.short_name })}
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={t('delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Departments table */}
          {activeTab === 'departments' && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('code')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameUz')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameRu')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('company')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('total')}</th>
                      {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{t('actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {departments.length === 0 ? (
                      <EmptyRow colSpan={isAdmin ? 6 : 5} />
                    ) : (
                      departments.map((d) => (
                        <tr key={d.id} className="transition hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{d.code}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{d.name_uz}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{d.name_ru}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{companies.find((c) => c.id === d.company_id)?.short_name ?? '—'}</td>
                          <td className="px-4 py-3 text-sm">
                            {d.is_total ? (
                              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {t('total')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(d.id)}
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                  aria-label={t('edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({ id: d.id, label: ln(d) })
                                  }
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={t('delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sections table */}
          {activeTab === 'sections' && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('department')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameUz')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameRu')}</th>
                      {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{t('actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sections.length === 0 ? (
                      <EmptyRow colSpan={isAdmin ? 4 : 3} />
                    ) : (
                      sections.map((s) => (
                        <tr key={s.id} className="transition hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {ln(departmentName(s.department_id))}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{s.name_uz}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{s.name_ru}</td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(s.id)}
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                  aria-label={t('edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({ id: s.id, label: ln(s) })
                                  }
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={t('delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vehicles table */}
          {activeTab === 'vehicles' && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('code')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameUz')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameRu')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('department')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('fuelType')}</th>
                      {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{t('actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vehicles.length === 0 ? (
                      <EmptyRow colSpan={isAdmin ? 6 : 5} />
                    ) : (
                      vehicles.map((v) => (
                        <tr key={v.id} className="transition hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{v.code}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{v.name_uz}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{v.name_ru}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {ln(departmentName(v.department_id))}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {ln(fuelTypeName(v.fuel_type_id))}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(v.id)}
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                  aria-label={t('edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({ id: v.id, label: ln(v) })
                                  }
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={t('delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fuel types table */}
          {activeTab === 'fuel_types' && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('code')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameUz')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('nameRu')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t('unit')}</th>
                      {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{t('actions')}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fuelTypes.length === 0 ? (
                      <EmptyRow colSpan={isAdmin ? 5 : 4} />
                    ) : (
                      fuelTypes.map((f) => (
                        <tr key={f.id} className="transition hover:bg-muted/30">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{f.code}</td>
                          <td className="px-4 py-3 text-sm text-foreground">{f.name_uz}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{f.name_ru}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
                              {formatUnit(f.unit, lang)}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(f.id)}
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                                  aria-label={t('edit')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({ id: f.id, label: ln(f) })
                                  }
                                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                  aria-label={t('delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={closeModal} title={modalTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'companies' && (
            <>
              <Field label={t('shortName')}>
                <input
                  type="text"
                  value={companyForm.short_name}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, short_name: e.target.value }))}
                  required
                  className={inputClass}
                  placeholder="ABC"
                />
              </Field>
              <Field label={t('fullName')}>
                <input
                  type="text"
                  value={companyForm.full_name}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                  className={inputClass}
                  placeholder="ABC Company LLC"
                />
              </Field>
            </>
          )}
          {activeTab === 'departments' && (
            <>
              <Field label={t('code')}>
                <input
                  type="text"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))}
                  required
                  className={inputClass}
                  placeholder="DEP-01"
                />
              </Field>
              <Field label={t('nameUz')}>
                <input
                  type="text"
                  value={deptForm.name_uz}
                  onChange={(e) => setDeptForm((f) => ({ ...f, name_uz: e.target.value }))}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label={t('nameRu')}>
                <input
                  type="text"
                  value={deptForm.name_ru}
                  onChange={(e) => setDeptForm((f) => ({ ...f, name_ru: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label={t('company')}>
                <select
                  value={deptForm.company_id}
                  onChange={(e) => setDeptForm((f) => ({ ...f, company_id: e.target.value }))}
                  required
                  className={inputClass}
                >
                  <option value="">{t('selectCompany')}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.short_name} — {c.full_name}</option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={deptForm.is_total}
                  onChange={(e) => setDeptForm((f) => ({ ...f, is_total: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                {t('total')}
              </label>
            </>
          )}

          {activeTab === 'sections' && (
            <>
              <Field label={t('department')}>
                <select
                  value={sectionForm.department_id}
                  onChange={(e) => setSectionForm((f) => ({ ...f, department_id: e.target.value }))}
                  required
                  className={inputClass}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {ln(d)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('nameUz')}>
                <input
                  type="text"
                  value={sectionForm.name_uz}
                  onChange={(e) => setSectionForm((f) => ({ ...f, name_uz: e.target.value }))}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label={t('nameRu')}>
                <input
                  type="text"
                  value={sectionForm.name_ru}
                  onChange={(e) => setSectionForm((f) => ({ ...f, name_ru: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            </>
          )}

          {activeTab === 'vehicles' && (
            <>
              <Field label={t('code')}>
                <input
                  type="text"
                  value={vehicleForm.code}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, code: e.target.value }))}
                  required
                  className={inputClass}
                  placeholder="VEH-001"
                />
              </Field>
              <Field label={t('nameUz')}>
                <input
                  type="text"
                  value={vehicleForm.name_uz}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, name_uz: e.target.value }))}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label={t('nameRu')}>
                <input
                  type="text"
                  value={vehicleForm.name_ru}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, name_ru: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label={t('department')}>
                <select
                  value={vehicleForm.department_id}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, department_id: e.target.value }))}
                  required
                  className={inputClass}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {ln(d)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('fuelType')}>
                <select
                  value={vehicleForm.fuel_type_id}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, fuel_type_id: e.target.value }))}
                  required
                  className={inputClass}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {fuelTypes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {ln(f)} ({formatUnit(f.unit, lang)})
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {activeTab === 'fuel_types' && (
            <>
              <Field label={t('code')}>
                <input
                  type="text"
                  value={fuelTypeForm.code}
                  onChange={(e) => setFuelTypeForm((f) => ({ ...f, code: e.target.value }))}
                  required
                  className={inputClass}
                  placeholder="FUEL-01"
                />
              </Field>
              <Field label={t('nameUz')}>
                <input
                  type="text"
                  value={fuelTypeForm.name_uz}
                  onChange={(e) => setFuelTypeForm((f) => ({ ...f, name_uz: e.target.value }))}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label={t('nameRu')}>
                <input
                  type="text"
                  value={fuelTypeForm.name_ru}
                  onChange={(e) => setFuelTypeForm((f) => ({ ...f, name_ru: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label={t('unit')}>
                <select
                  value={fuelTypeForm.unit}
                  onChange={(e) => setFuelTypeForm((f) => ({ ...f, unit: e.target.value as FuelUnit }))}
                  required
                  className={inputClass}
                >
                  {FUEL_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <FormActions saving={saving} onCancel={closeModal} submitLabel={submitLabel} />
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('delete')}>
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                {t('confirmDelete')} <span className="font-semibold">{deleteTarget.label}</span>
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className={`${btnGhost} flex-1`}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className={`${btnDestructive} flex-1`}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('delete')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default MasterDataPage;
