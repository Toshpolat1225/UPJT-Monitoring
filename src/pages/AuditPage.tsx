import { useEffect, useMemo, useState, Fragment } from 'react';
import { supabase, type AuditLog, type Profile, type Department, type Section, type Vehicle, type FuelType } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { ChevronDown, ChevronRight, ArrowUpDown, RotateCcw } from 'lucide-react';

const PAGE_SIZE = 20;

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  INSERT: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  UPDATE: 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  DELETE: 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300',
  LOGIN: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300',
  LOGOUT: 'border-slate-500/30 bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

function normalizeAction(a: string) {
  const u = (a || '').toUpperCase();
  return u === 'INSERT' ? 'CREATE' : u;
}

export function AuditPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [depts, setDepts] = useState<Record<string, Department>>({});
  const [secs, setSecs] = useState<Record<string, Section>>({});
  const [vehs, setVehs] = useState<Record<string, Vehicle>>({});
  const [fuels, setFuels] = useState<Record<string, FuelType>>({});
  const [rolesMap, setRolesMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fUser, setFUser] = useState('all');
  const [fRole, setFRole] = useState('all');
  const [fDept, setFDept] = useState('all');
  const [fAction, setFAction] = useState('all');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [a, p, d, s, v, f, r] = await Promise.all([
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('profiles').select('id,full_name,email,department_id'),
        supabase.from('departments').select('id,name_uz'),
        supabase.from('sections').select('id,name_uz'),
        supabase.from('vehicles').select('id,code,name_uz'),
        supabase.from('fuel_types').select('id,code,name_uz'),
        supabase.from('user_roles').select('user_id,role'),
      ]);
      setRows((a.data ?? []) as AuditLog[]);
      const toMap = <T extends { id: string }>(arr: T[] | null) =>
        Object.fromEntries((arr ?? []).map((x) => [x.id, x])) as Record<string, T>;
      setProfiles(toMap((p.data ?? []) as Profile[]));
      setDepts(toMap((d.data ?? []) as Department[]));
      setSecs(toMap((s.data ?? []) as Section[]));
      setVehs(toMap((v.data ?? []) as Vehicle[]));
      setFuels(toMap((f.data ?? []) as FuelType[]));
      const rmap: Record<string, string[]> = {};
      ((r.data ?? []) as { user_id: string; role: string }[]).forEach((x) => {
        rmap[x.user_id] = [...(rmap[x.user_id] ?? []), x.role];
      });
      setRolesMap(rmap);
      setLoading(false);
    })();
  }, []);

  const ln = (row: { name_uz?: string | null } | undefined) => {
    if (!row) return '—';
    return row.name_uz || '—';
  };

  const userName = (uid: string | null) => {
    if (!uid) return '—';
    const p = profiles[uid];
    return p?.full_name || p?.email || uid.slice(0, 8);
  };
  const userRoles = (uid: string | null) => (uid ? (rolesMap[uid] ?? []) : []);
  const userDept = (uid: string | null) => {
    const p = uid ? profiles[uid] : undefined;
    return p?.department_id ? ln(depts[p.department_id]) : '—';
  };

  const describe = (r: AuditRow): string => {
    const d = (r.details || {}) as Record<string, string>;
    const act = normalizeAction(r.action);
    const tbl = r.table_name;
    const dept = d.department_id ? ln(depts[d.department_id]) : null;
    const veh = d.vehicle_id ? (vehs[d.vehicle_id] ? `${vehs[d.vehicle_id].code} ${ln(vehs[d.vehicle_id])}` : null) : null;
    const fuel = d.fuel_type_id ? ln(fuels[d.fuel_type_id]) : null;
    const sec = d.section_id ? ln(secs[d.section_id]) : null;
    if (tbl === 'daily_entries') {
      const target = veh || dept || '';
      if (act === 'CREATE') return `${target} uchun kunlik yozuv qo'shildi`;
      if (act === 'UPDATE') return `${target} uchun kunlik yozuv yangilandi`;
      if (act === 'DELETE') return `${target} uchun yozuv o'chirildi`;
    }
    if (tbl === 'monthly_limits') {
      const target = [dept, sec, fuel].filter(Boolean).join(' / ');
      if (act === 'CREATE') return `Limit qo'shildi: ${target}`;
      if (act === 'UPDATE') return `Limit yangilandi: ${target}`;
      if (act === 'DELETE') return `Limit o'chirildi: ${target}`;
    }
    if (tbl === 'vehicles') {
      const name = d.code && d.name_uz ? `${d.code} ${d.name_uz}` : (d.name_uz || d.code || '');
      if (act === 'DELETE') return `Texnika o'chirildi: ${name}`;
      if (act === 'CREATE') return `Texnika qo'shildi: ${name}`;
      if (act === 'UPDATE') return `Texnika yangilandi: ${name}`;
    }
    if (tbl === 'departments' || tbl === 'sections' || tbl === 'fuel_types') {
      const name = d.name_uz || d.name || d.code || '';
      const labelUz: Record<string, string> = { departments: 'Sex', sections: "Bo'lim", fuel_types: "Yoqilg'i" };
      const label = labelUz[tbl];
      if (act === 'CREATE') return `${label}: ${name} qo'shildi`;
      if (act === 'UPDATE') return `${label}: ${name} yangilandi`;
      if (act === 'DELETE') return `${label}: ${name} o'chirildi`;
    }
    if (act === 'LOGIN') return 'Tizimga kirdi';
    if (act === 'LOGOUT') return 'Tizimdan chiqdi';
    return `${act} \u2022 ${tbl}`;
  };

  type AuditRow = AuditLog;
  const allUsers = useMemo(() => Object.values(profiles), [profiles]);
  const allDepts = useMemo(() => Object.values(depts), [depts]);
  const allRolesList = useMemo(() => {
    const set = new Set<string>();
    Object.values(rolesMap).forEach((rs) => rs.forEach((r) => set.add(r)));
    return Array.from(set);
  }, [rolesMap]);
  const allActions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(normalizeAction(r.action)));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows.filter((r) => {
      const act = normalizeAction(r.action);
      if (fAction !== 'all' && act !== fAction) return false;
      if (fUser !== 'all' && r.user_id !== fUser) return false;
      if (fDept !== 'all') {
        const p = r.user_id ? profiles[r.user_id] : undefined;
        if (p?.department_id !== fDept) return false;
      }
      if (fRole !== 'all') {
        if (!userRoles(r.user_id).includes(fRole)) return false;
      }
      if (dateFrom && r.created_at < dateFrom) return false;
      if (dateTo && r.created_at > dateTo + 'T23:59:59') return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [userName(r.user_id), r.table_name, act, describe(r), JSON.stringify(r.details || {})].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = out.sort((a, b) => sortDesc ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at));
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fAction, fUser, fDept, fRole, dateFrom, dateTo, search, sortDesc, profiles, rolesMap, depts, vehs, fuels, secs]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, fUser, fRole, fDept, fAction]);

  const reset = () => {
    setSearch(''); setDateFrom(''); setDateTo('');
    setFUser('all'); setFRole('all'); setFDept('all'); setFAction('all');
  };

  const renderChanges = (r: AuditLog) => {
    const d = r.details || {};
    const before = (d as Record<string, unknown>)['_before'];
    const after = (d as Record<string, unknown>)['_after'];
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      const b = before as Record<string, unknown>;
      const a = after as Record<string, unknown>;
      const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
      const diffs = keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
      if (diffs.length === 0) return null;
      return (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t('changes')}</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 font-medium">{t('field')}</th>
                <th className="py-1 font-medium">{t('oldValue')}</th>
                <th className="py-1 font-medium">{t('newValue')}</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((k) => (
                <tr key={k} className="border-b border-border/30">
                  <td className="py-1 font-mono">{k}</td>
                  <td className="py-1 text-red-600">{String(b[k] ?? '—')}</td>
                  <td className="py-1 text-emerald-600">{String(a[k] ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('audit')}</h1>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
          <select value={fAction} onChange={(e) => setFAction(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            <option value="all">{t('all')} — {t('action')}</option>
            {allActions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={fUser} onChange={(e) => setFUser(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            <option value="all">{t('all')} — {t('user')}</option>
            {allUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email || u.id.slice(0, 8)}</option>)}
          </select>
          <select value={fRole} onChange={(e) => setFRole(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            <option value="all">{t('all')} — {t('role')}</option>
            {allRolesList.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={fDept} onChange={(e) => setFDept(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            <option value="all">{t('all')} — {t('department')}</option>
            {allDepts.map((d) => <option key={d.id} value={d.id}>{ln(d)}</option>)}
          </select>
          <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <RotateCcw className="h-4 w-4" />{t('reset')}
          </button>
        </div>

        <div className="mb-2 text-xs text-muted-foreground">{filtered.length} yozuv</div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="w-8 py-2"></th>
                <th className="cursor-pointer select-none py-2 font-medium" onClick={() => setSortDesc((s) => !s)}>
                  <span className="inline-flex items-center gap-1">{t('date')} <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="py-2 font-medium">{t('action')}</th>
                <th className="py-2 font-medium">{t('user')}</th>
                <th className="py-2 font-medium">{t('role')}</th>
                <th className="py-2 font-medium">{t('department')}</th>
                <th className="py-2 font-medium">{t('details')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{t('loading')}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{t('noData')}</td></tr>
              ) : (
                pageRows.map((r) => {
                  const act = normalizeAction(r.action);
                  const isOpen = !!expanded[r.id];
                  return (
                    <Fragment key={r.id}>
                      <tr className="cursor-pointer border-b border-border/50 hover:bg-muted/30" onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}>
                        <td className="py-2">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                        <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="py-2">
                          <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[act] || ''}`}>{act}</span>
                        </td>
                        <td className="py-2 text-sm text-foreground">{userName(r.user_id)}</td>
                        <td className="py-2 text-xs">
                          {userRoles(r.user_id).map((rl) => (
                            <span key={rl} className="mr-1 rounded bg-muted px-1.5 py-0.5">{rl}</span>
                          ))}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{userDept(r.user_id)}</td>
                        <td className="py-2 text-sm text-foreground">{describe(r)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30">
                          <td></td>
                          <td colSpan={6} className="py-3">
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">{r.table_name} {r.row_id ? `• ${r.row_id.slice(0, 8)}` : ''}</div>
                              {renderChanges(r)}
                              <pre className="max-h-64 overflow-x-auto rounded border border-border bg-background p-2 text-xs">
{JSON.stringify(r.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="text-xs text-muted-foreground">{t('page')} {page} / {totalPages}</div>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-lg border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted disabled:opacity-30">{t('prev')}</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="rounded-lg border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted disabled:opacity-30">{t('next')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
