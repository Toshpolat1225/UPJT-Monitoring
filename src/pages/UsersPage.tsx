import { useEffect, useState } from 'react';
import { supabase, type Profile, type AppRole, type RolePermission, type Company } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

const ROLES: AppRole[] = ['admin', 'gsm', 'operator', 'master', 'management'];
const MODULES = ['entries', 'limits', 'master_data', 'users', 'audit'] as const;
const PERMS = ['view', 'create', 'edit', 'delete'] as const;

interface UserRoleRow { id: string; user_id: string; role: AppRole }
interface Dept { id: string; name_uz: string; name_ru: string }

export function UsersPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'users' | 'permissions'>('users');

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('users')}</h1>
      <div className="inline-flex rounded-lg border border-border p-0.5">
        <button
          onClick={() => setTab('users')}
          className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === 'users' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('users')}
        </button>
        <button
          onClick={() => setTab('permissions')}
          className={`rounded-md px-4 py-1.5 text-sm transition-colors ${tab === 'permissions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {t('permissions')}
        </button>
      </div>
      {tab === 'users' ? <UsersTab /> : <PermissionsTab />}
    </div>
  );
}

function UsersTab() {
  const { t, ln } = useI18n();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', department_id: '', company_id: '', roles: [] as string[] });

  const load = async () => {
    const [p, r, d, c] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_roles').select('id,user_id,role'),
      supabase.from('departments').select('id,name_uz,name_ru').order('name_uz'),
      supabase.from('companies').select('*').order('short_name'),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setRoles((r.data ?? []) as UserRoleRow[]);
    setDepts((d.data ?? []) as Dept[]);
    setCompanies((c.data ?? []) as Company[]);
  };
  useEffect(() => { load(); }, []);

  const userRoles = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);

  const openNew = () => { setEditing(null); setForm({ full_name: '', email: '', department_id: '', company_id: '', roles: [] }); setOpen(true); };
  const openEdit = (p: Profile) => { setEditing(p); setForm({ full_name: p.full_name ?? '', email: p.email ?? '', department_id: p.department_id ?? '', company_id: p.company_id ?? '', roles: userRoles(p.id) }); setOpen(true); };

  const save = async () => {
    if (!form.email.trim()) { toast.error(t('email')); return; }
    if (!form.roles.length) { toast.error(t('role')); return; }

    if (editing) {
      const { error: pErr } = await supabase.from('profiles').update({
        full_name: form.full_name, email: form.email.trim(), department_id: form.department_id || null, company_id: form.company_id || null,
      }).eq('id', editing.id);
      if (pErr) return toast.error(pErr.message);

      await supabase.from('user_roles').delete().eq('user_id', editing.id);
      if (form.roles.length) {
        await supabase.from('user_roles').insert(form.roles.map((r) => ({ user_id: editing.id, role: r })));
      }
      toast.success(t('saved'));
    } else {
      toast.error(t('noPermission'));
      return;
    }
    setOpen(false);
    await load();
  };

  const del = async (p: Profile) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('profiles').delete().eq('id', p.id);
    if (error) toast.error(error.message);
    else { toast.success(t('saved')); await load(); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <button onClick={openNew} className="mb-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">
        <Plus className="h-4 w-4" />{t('newUser')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold text-foreground">{editing ? t('edit') : t('newUser')}</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('fullName')}</label>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('email')}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('department')}</label>
                <select value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                  <option value="">—</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{ln(d)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('company')}</label>
                <select value={form.company_id || ''} onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                  <option value="">{t('selectCompany')}</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name} — {c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{t('role')}</label>
                <div className="flex flex-wrap gap-1">
                  {ROLES.map((r) => {
                    const checked = form.roles.includes(r);
                    return (
                      <button key={r} type="button" onClick={() => setForm({ ...form, roles: checked ? form.roles.filter((x) => x !== r) : [...form.roles, r] })}
                        className={`rounded px-2.5 py-1 text-xs transition-colors ${checked ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">{t('cancel')}</button>
              <button onClick={save} className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 font-medium">{t('fullName')}</th>
              <th className="py-2 font-medium">{t('email')}</th>
              <th className="py-2 font-medium">{t('company')}</th>
              <th className="py-2 font-medium">{t('department')}</th>
              <th className="py-2 font-medium">{t('role')}</th>
              <th className="py-2 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-2 font-medium text-foreground">{p.full_name || '—'}</td>
                <td className="py-2 text-muted-foreground">{p.email}</td>
                <td className="py-2 text-muted-foreground">{companies.find((c) => c.id === p.company_id)?.short_name ?? '—'}</td>
                <td className="py-2 text-muted-foreground">{ln(depts.find((d) => d.id === p.department_id) ?? null)}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1 text-xs">
                    {userRoles(p.id).map((r) => (
                      <span key={r} className="rounded bg-muted px-1.5 py-0.5">{r}</span>
                    ))}
                  </div>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => openEdit(p)} className="rounded p-1 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(p)} disabled={p.id === user?.id} className="rounded p-1 text-destructive hover:bg-muted disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PermissionsTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<RolePermission[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('role_permissions').select('*');
    setRows((data ?? []) as RolePermission[]);
  };
  useEffect(() => { load(); }, []);

  const get = (role: string, module: string, perm: string) =>
    rows.find((r) => r.role === role && r.module === module && r.permission === perm)?.allowed ?? false;

  const toggle = async (role: string, module: string, perm: string, value: boolean) => {
    setBusy(true);
    const existing = rows.find((r) => r.role === role && r.module === module && r.permission === perm);
    if (existing) {
      await supabase.from('role_permissions').update({ allowed: value }).eq('id', existing.id);
    } else {
      await supabase.from('role_permissions').insert({ role: role as AppRole, module, permission: perm, allowed: value });
    }
    await load();
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="mb-3 text-sm text-muted-foreground">{t('permissions')} — view / create / edit / delete per role per module.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 font-medium">{t('module')}</th>
              {ROLES.map((r) => <th key={r} className="px-3 py-2 text-center font-medium">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => PERMS.map((p) => (
              <tr key={`${m}-${p}`} className="border-b border-border/50">
                <td className="py-2 font-medium text-foreground">
                  {m} <span className="text-xs text-muted-foreground">· {p}</span>
                </td>
                {ROLES.map((r) => (
                  <td key={r} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={get(r, m, p)}
                      disabled={busy}
                      onChange={(e) => toggle(r, m, p, e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </td>
                ))}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
