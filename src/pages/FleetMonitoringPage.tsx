import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock3,
  Download,
  Fuel,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  Signal,
  Truck,
} from 'lucide-react';
import apiClient from '../lib/client';
import { getErrorMessage } from '../lib/errorMessage';

interface SensorValue {
  key: string;
  name: string;
  value: unknown;
}

interface TelemetryPoint {
  message_time: string | null;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  mileage: number | null;
  engine_hours: number | null;
  sensors: SensorValue[];
}

interface FleetUnit extends TelemetryPoint {
  id: number;
  name: string;
  unit_type: string | null;
  groups: string[];
  status: 'moving' | 'stopped' | 'stale' | 'no_data';
  raw_sensors: Record<string, unknown>;
}

interface FleetResponse {
  updated_at: string;
  unit_count: number;
  units: FleetUnit[];
}

interface MessageHistoryResponse {
  unit_id: number;
  unit_name: string;
  total_count: number;
  returned_count: number;
  truncated: boolean;
  messages: TelemetryPoint[];
}

interface ReportTemplate {
  resource_id: number;
  resource_name: string;
  template_id: number;
  name: string;
  object_type: 'avl_unit' | 'avl_unit_group';
}

interface ReportTarget {
  id: number;
  name: string;
}

interface ReportOptions {
  units: ReportTarget[];
  groups: ReportTarget[];
  templates: ReportTemplate[];
}

interface ReportTable {
  name: string;
  label: string;
  headers: string[];
  row_count: number;
  rows: Array<{ n?: number; c?: unknown[] }>;
  total: unknown[] | null;
  truncated: boolean;
}

interface ReportResult {
  report_name: string;
  object_name: string;
  stats: string[][];
  tables: ReportTable[];
}

const inputClass =
  'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring';

function localDateTime(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function formatNumber(value: number | null, fractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('uz-UZ', { maximumFractionDigits: fractionDigits });
}

function formatDate(value: string | null): string {
  if (!value) return 'Xabar yo‘q';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('uz-UZ', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Tashkent',
  }).format(date);
}

function sensorValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function reportCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value !== 'object') return String(value);
  const cell = value as { t?: unknown; v?: unknown; y?: unknown; x?: unknown };
  if (cell.t !== undefined) return String(cell.t);
  if (cell.v !== undefined) return String(cell.v);
  if (cell.y !== undefined && cell.x !== undefined) return `${cell.y}, ${cell.x}`;
  return JSON.stringify(value);
}

function StatusBadge({ status }: { status: FleetUnit['status'] }) {
  const style = {
    moving: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    stopped: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    stale: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    no_data: 'border-border bg-muted text-muted-foreground',
  }[status];
  const label = {
    moving: 'Harakatda',
    stopped: 'To‘xtagan',
    stale: 'Xabar eskirgan',
    no_data: 'Ma’lumot yo‘q',
  }[status];

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span>;
}

export function FleetMonitoringPage() {
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [tab, setTab] = useState<'live' | 'history' | 'reports'>('live');
  const [historyUnitId, setHistoryUnitId] = useState('');
  const [historyFrom, setHistoryFrom] = useState(() => {
    const from = new Date();
    from.setHours(from.getHours() - 24);
    return localDateTime(from);
  });
  const [historyTo, setHistoryTo] = useState(() => localDateTime(new Date()));
  const [history, setHistory] = useState<MessageHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [reportOptions, setReportOptions] = useState<ReportOptions | null>(null);
  const [reportOptionsLoading, setReportOptionsLoading] = useState(false);
  const [reportOptionsRequested, setReportOptionsRequested] = useState(false);
  const [reportOptionsError, setReportOptionsError] = useState('');
  const [reportSelection, setReportSelection] = useState('');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportFrom, setReportFrom] = useState(() => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return localDateTime(from);
  });
  const [reportTo, setReportTo] = useState(() => localDateTime(new Date()));
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const loadFleet = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get<FleetResponse>('/wialon/units');
      setFleet(data);
      setHistoryUnitId((current) => current || String(data.units[0]?.id ?? ''));
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, 'Wialon ma’lumotlarini yuklab bo‘lmadi.'));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadFleet();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadFleet]);

  useEffect(() => {
    if (tab !== 'reports' || reportOptions || reportOptionsLoading || reportOptionsRequested) return;
    setReportOptionsRequested(true);
    setReportOptionsLoading(true);
    setReportOptionsError('');
    apiClient.get<ReportOptions>('/wialon/reports/options')
      .then(({ data }) => {
        setReportOptions(data);
        if (data.templates.length) {
          setReportSelection(`${data.templates[0].resource_id}:${data.templates[0].template_id}`);
        }
      })
      .catch((loadError: unknown) => {
        setReportOptionsError(getErrorMessage(loadError, 'Wialon hisobot shablonlarini olib bo‘lmadi.'));
      })
      .finally(() => setReportOptionsLoading(false));
  }, [tab, reportOptions, reportOptionsLoading, reportOptionsRequested]);

  const units = useMemo(() => fleet?.units ?? [], [fleet]);
  const selectedTemplate = reportOptions?.templates.find(
    (template) => `${template.resource_id}:${template.template_id}` === reportSelection,
  );
  const reportTargets = useMemo(
    () => selectedTemplate?.object_type === 'avl_unit_group'
      ? reportOptions?.groups ?? []
      : reportOptions?.units ?? [],
    [selectedTemplate?.object_type, reportOptions?.groups, reportOptions?.units],
  );

  useEffect(() => {
    if (reportTargets.length && !reportTargets.some((target) => String(target.id) === reportTargetId)) {
      setReportTargetId(String(reportTargets[0].id));
    }
  }, [reportTargets, reportTargetId]);

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return units.filter((unit) => {
      const matchesSearch =
        !query ||
        unit.name.toLocaleLowerCase().includes(query) ||
        String(unit.id).includes(query) ||
        (unit.unit_type ?? '').toLocaleLowerCase().includes(query) ||
        unit.groups.some((group) => group.toLocaleLowerCase().includes(query));
      return matchesSearch && (statusFilter === 'all' || unit.status === statusFilter);
    });
  }, [units, search, statusFilter]);

  const movingCount = units.filter((unit) => unit.status === 'moving').length;
  const stoppedCount = units.filter((unit) => unit.status === 'stopped').length;
  const staleCount = units.filter((unit) => unit.status === 'stale' || unit.status === 'no_data').length;
  const maxSpeed = units.reduce((max, unit) => Math.max(max, unit.speed_kmh ?? 0), 0);
  const hasSpeedData = units.some((unit) => unit.speed_kmh !== null);

  const loadHistory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHistory(null);
    setHistoryError('');
    const fromTs = Math.floor(new Date(historyFrom).getTime() / 1000);
    const toTs = Math.floor(new Date(historyTo).getTime() / 1000);
    if (!historyUnitId || !Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs <= fromTs) {
      setHistoryError('Texnika va to‘g‘ri vaqt oralig‘ini tanlang.');
      return;
    }

    setHistoryLoading(true);
    try {
      const { data } = await apiClient.get<MessageHistoryResponse>(
        `/wialon/units/${historyUnitId}/messages`,
        { params: { from_ts: fromTs, to_ts: toTs } },
      );
      setHistory(data);
    } catch (loadError: unknown) {
      setHistoryError(getErrorMessage(loadError, 'Xabarlar tarixini yuklab bo‘lmadi.'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportResult(null);
    setReportError('');
    const fromTs = Math.floor(new Date(reportFrom).getTime() / 1000);
    const toTs = Math.floor(new Date(reportTo).getTime() / 1000);
    if (!selectedTemplate || !reportTargetId || !Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs <= fromTs) {
      setReportError('Hisobot shabloni, obyekt va to‘g‘ri vaqt oralig‘ini tanlang.');
      return;
    }

    setReportLoading(true);
    try {
      const { data } = await apiClient.post<ReportResult>('/wialon/reports/run', {
        resource_id: selectedTemplate.resource_id,
        template_id: selectedTemplate.template_id,
        object_id: Number(reportTargetId),
        from_ts: fromTs,
        to_ts: toTs,
      });
      setReportResult(data);
    } catch (loadError: unknown) {
      setReportError(getErrorMessage(loadError, 'Wialon hisobotini bajarib bo‘lmadi.'));
    } finally {
      setReportLoading(false);
    }
  };

  const downloadReport = () => {
    if (!reportResult) return;
    const blob = new Blob([JSON.stringify(reportResult, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wialon-hisobot.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-primary">Wialon GPS</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Transport monitoringi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jonli telemetriya · sahifa ochiq bo‘lganda har 60 soniyada yangilanadi
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadFleet()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </button>
      </div>

      <div className="flex w-fit gap-1 rounded-xl border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setTab('live')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'live' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          Jonli monitoring
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          Xabarlar tarixi
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'reports' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          Hisobotlar
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          {error.includes('not configured') && (
            <span className="mt-1 block">Backend muhitiga WIALON_TOKEN o‘zgaruvchisini qo‘shish kerak.</span>
          )}
        </div>
      )}

      {tab === 'live' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Jami texnika', value: loading ? '…' : String(fleet?.unit_count ?? 0), icon: Truck, tone: 'text-primary bg-primary/10' },
              { label: 'Oxirgi xabarda harakatda', value: loading ? '…' : String(movingCount), icon: Activity, tone: 'text-emerald-600 bg-emerald-500/10' },
              { label: 'Oxirgi xabarda to‘xtagan', value: loading ? '…' : String(stoppedCount), icon: Signal, tone: 'text-amber-600 bg-amber-500/10' },
              { label: 'Xabari 24 soatdan eski', value: loading ? '…' : String(staleCount), icon: Clock3, tone: 'text-orange-600 bg-orange-500/10' },
              { label: 'Eng yuqori tezlik', value: loading ? '…' : hasSpeedData ? `${formatNumber(maxSpeed)} km/soat` : '—', icon: Gauge, tone: 'text-sky-600 bg-sky-500/10' },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <span className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></span>
                </div>
                <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <label className="relative w-full max-w-md">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Texnikani qidirish</span>
              <Search className="absolute left-3 top-[2.35rem] h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`${inputClass} w-full pl-9`}
                placeholder="Nomi yoki ID..."
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Holat</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
                <option value="all">Barcha holatlar</option>
                <option value="moving">Harakatda</option>
                <option value="stopped">To‘xtagan</option>
                <option value="stale">Xabar eskirgan</option>
                <option value="no_data">Ma’lumot yo‘q</option>
              </select>
            </label>
            <p className="pb-2 text-xs text-muted-foreground">
              {fleet ? `Yangilangan: ${formatDate(fleet.updated_at)}` : '—'}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-semibold text-foreground">Texnikalar</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Ko‘rsatilmoqda: {filteredUnits.length} / {units.length}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" /> Xabar vaqti Toshkent vaqti bilan
              </span>
            </div>
            {loading && !fleet ? (
              <div className="flex items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" /> Wialon’dan ma’lumot olinmoqda...
              </div>
            ) : filteredUnits.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {units.length ? 'Filtrga mos texnika topilmadi.' : 'Wialon’da texnikalar topilmadi.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Texnika</th>
                      <th className="px-4 py-3 font-medium">Guruh</th>
                      <th className="px-4 py-3 font-medium">Holat</th>
                      <th className="px-4 py-3 font-medium">Tezlik</th>
                      <th className="px-4 py-3 font-medium">Probeg</th>
                      <th className="px-4 py-3 font-medium">Motosoat</th>
                      <th className="px-4 py-3 font-medium">Joylashuv</th>
                      <th className="px-4 py-3 font-medium">Oxirgi xabar</th>
                      <th className="px-4 py-3 font-medium">Datchiklar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUnits.map((unit) => (
                      <tr key={unit.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{unit.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            ID {unit.id}{unit.unit_type ? ` · ${unit.unit_type}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{unit.groups.join(', ') || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={unit.status} /></td>
                        <td className="px-4 py-3 font-medium tabular-nums">{formatNumber(unit.speed_kmh)} km/soat</td>
                        <td className="px-4 py-3 tabular-nums">{formatNumber(unit.mileage)} km</td>
                        <td className="px-4 py-3 tabular-nums">{formatNumber(unit.engine_hours)} soat</td>
                        <td className="px-4 py-3">
                          {unit.latitude !== null && unit.longitude !== null ? (
                            <a
                              href={`https://maps.google.com/?q=${unit.latitude},${unit.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              {unit.latitude.toFixed(5)}, {unit.longitude.toFixed(5)}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(unit.message_time)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            {expandedUnit === unit.id ? 'Yopish' : `${unit.sensors.length} ta ko‘rish`}
                          </button>
                        </td>
                      </tr>
                    )).flatMap((row, index) => {
                      const unit = filteredUnits[index];
                      if (expandedUnit !== unit.id) return [row];
                      return [
                        row,
                        <tr key={`${unit.id}-sensors`} className="bg-muted/30">
                          <td colSpan={9} className="px-5 py-4">
                            {unit.sensors.length ? (
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {unit.sensors.map((sensor) => (
                                  <div key={`${unit.id}-${sensor.key}`} className="rounded-lg border border-border bg-card px-3 py-2">
                                    <div className="truncate text-xs text-muted-foreground" title={sensor.key}>{sensor.name}</div>
                                    <div className="mt-1 font-medium text-foreground">{sensorValue(sensor.value)}</div>
                                  </div>
                                ))}
                              </div>
                            ) : <p className="text-sm text-muted-foreground">Oxirgi xabarda sensor parametrlari yo‘q.</p>}
                          </td>
                        </tr>,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : tab === 'history' ? (
        <div className="space-y-4">
          <form onSubmit={loadHistory} className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_1fr_1fr_auto] xl:items-end">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Texnika
              <select value={historyUnitId} onChange={(event) => setHistoryUnitId(event.target.value)} className={inputClass} required>
                <option value="">Tanlang</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Boshlanish vaqti
              <input type="datetime-local" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} className={inputClass} required />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Tugash vaqti
              <input type="datetime-local" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} className={inputClass} required />
            </label>
            <button type="submit" disabled={historyLoading || !units.length} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {historyLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Xabarlarni olish
            </button>
          </form>
          <p className="text-xs text-muted-foreground">Wialon xabarlari UTC vaqtida so‘raladi va Toshkent vaqti bilan ko‘rsatiladi. Bitta so‘rov oralig‘i 31 kundan oshmasin.</p>
          {historyError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{historyError}</div>}
          {history && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-semibold text-foreground">{history.unit_name} — xabarlar tarixi</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Olingan: {history.returned_count} / {history.total_count}
                    {history.truncated ? ' · 2 000 ta xabar limiti sabab natija qisqartirildi' : ''}
                  </p>
                </div>
              </div>
              {history.messages.length ? (
                <div className="max-h-[65vh] overflow-auto">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Vaqt</th>
                        <th className="px-4 py-3 font-medium">Tezlik</th>
                        <th className="px-4 py-3 font-medium">Probeg</th>
                        <th className="px-4 py-3 font-medium">Motosoat</th>
                        <th className="px-4 py-3 font-medium">Koordinatalar</th>
                        <th className="px-4 py-3 font-medium">Datchiklar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {history.messages.map((message, index) => (
                        <tr key={`${message.message_time ?? 'message'}-${index}`} className="align-top">
                          <td className="whitespace-nowrap px-4 py-3">{formatDate(message.message_time)}</td>
                          <td className="px-4 py-3 tabular-nums">{formatNumber(message.speed_kmh)} km/soat</td>
                          <td className="px-4 py-3 tabular-nums">{formatNumber(message.mileage)} km</td>
                          <td className="px-4 py-3 tabular-nums">{formatNumber(message.engine_hours)} soat</td>
                          <td className="px-4 py-3">
                            {message.latitude !== null && message.longitude !== null
                              ? `${message.latitude.toFixed(5)}, ${message.longitude.toFixed(5)}`
                              : '—'}
                          </td>
                          <td className="max-w-sm px-4 py-3">
                            {message.sensors.length
                              ? message.sensors.map((sensor) => `${sensor.name}: ${sensorValue(sensor.value)}`).join(' · ')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="p-10 text-center text-sm text-muted-foreground">Tanlangan oraliqda ma’lumot xabarlari topilmadi.</div>}
            </div>
          )}
          {!history && !historyError && !historyLoading && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <Fuel className="mx-auto mb-3 h-8 w-8 opacity-50" />
              Texnika va vaqt oralig‘ini tanlab, xabarlar tarixini yuklang.
            </div>
          )}
        </div>
      ) : (
            <div className="space-y-4">
              <form onSubmit={loadReport} className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(190px,1fr)_1fr_1fr_auto] xl:items-end">
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  Hisobot shabloni
                  <select
                    value={reportSelection}
                    onChange={(event) => { setReportSelection(event.target.value); setReportResult(null); }}
                    className={inputClass}
                    disabled={reportOptionsLoading || !reportOptions?.templates.length}
                    required
                  >
                    <option value="">Shablonni tanlang</option>
                    {reportOptions?.templates.map((template) => (
                      <option key={`${template.resource_id}:${template.template_id}`} value={`${template.resource_id}:${template.template_id}`}>
                        {template.resource_name} · {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  {selectedTemplate?.object_type === 'avl_unit_group' ? 'Texnika guruhi' : 'Texnika'}
                  <select value={reportTargetId} onChange={(event) => setReportTargetId(event.target.value)} className={inputClass} required>
                    <option value="">Tanlang</option>
                    {reportTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  Boshlanish vaqti
                  <input type="datetime-local" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} className={inputClass} required />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  Tugash vaqti
                  <input type="datetime-local" value={reportTo} onChange={(event) => setReportTo(event.target.value)} className={inputClass} required />
                </label>
                <button type="submit" disabled={reportLoading || !selectedTemplate || !reportTargetId} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {reportLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  Hisobotni bajarish
                </button>
              </form>
              <p className="text-xs text-muted-foreground">Wialon akkauntidagi mavjud report shablonlari ishlatiladi. Bitta hisobot oralig‘i 31 kundan oshmaydi; natija har bir jadval uchun 2 500, jami 5 000 qator bilan chegaralangan.</p>
              {reportOptionsLoading && <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Hisobot shablonlari olinmoqda...</div>}
              {reportOptionsError && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {reportOptionsError}
                  <button type="button" onClick={() => setReportOptionsRequested(false)} className="rounded-md border border-destructive/30 px-3 py-1.5 font-medium hover:bg-destructive/10">Qayta urinish</button>
                </div>
              )}
              {reportError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{reportError}</div>}
              {reportResult && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{reportResult.report_name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{reportResult.object_name}</p>
                    </div>
                    <button type="button" onClick={downloadReport} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                      <Download className="h-4 w-4" />JSON yuklab olish
                    </button>
                    <div className="grid w-full gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                      {reportResult.stats.map(([label, value]) => (
                        <div key={`${label}-${value}`} className="min-w-0">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="truncate text-sm font-medium text-foreground" title={value}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {reportResult.tables.map((table, tableIndex) => (
                    <div key={`${table.name}-${tableIndex}`} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                        <h3 className="font-semibold text-foreground">{table.label}</h3>
                        <span className="text-xs text-muted-foreground">
                          {table.row_count.toLocaleString('uz-UZ')} qator
                          {table.truncated ? ' · natija 2 500 qator bilan cheklangan' : ''}
                        </span>
                      </div>
                      {table.rows.length ? (
                        <div className="max-h-[60vh] overflow-auto">
                          <table className="w-full min-w-max text-left text-sm">
                            <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
                              <tr>{table.headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap px-3 py-2.5 font-medium">{header}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {table.rows.map((row, rowIndex) => (
                                <tr key={row.n ?? rowIndex}>
                                  {(row.c ?? []).map((value, cellIndex) => (
                                    <td key={cellIndex} className="max-w-[24rem] whitespace-nowrap px-3 py-2.5 text-foreground">
                                      {reportCell(value)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                            {table.total && (
                              <tfoot className="border-t-2 border-border bg-muted/30 font-semibold">
                                <tr>{table.total.map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-2.5">{reportCell(value)}</td>)}</tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      ) : <div className="p-8 text-center text-sm text-muted-foreground">Tanlangan davrda qator yo‘q.</div>}
                    </div>
                  ))}
                </div>
              )}
              {!reportOptionsLoading && !reportOptionsError && !reportResult && (
                <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                  <BarChart3 className="mx-auto mb-3 h-8 w-8 opacity-50" />
                  Wialon shablonidan hisobotni tanlang va bajaring.
                </div>
              )}
        </div>
      )}
    </div>
  );
}
