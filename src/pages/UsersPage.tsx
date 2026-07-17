import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type Profile, type UserRole, type Department, type Company, type AppRole } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Select, Modal, Table, EmptyState, Badge } from '../components/ui';

const ROLES: AppRole[] = ['admin', 'gsm', 'operator', 'master', 'management'];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin', gsm: 'GSM', operator: 'Operator', master: 'Master', management: 'Boshqaruv',
};

interface UserRow extends Profile {
  roles: AppRole[];
}

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', department_id: '', company_id: '',
    roles: [] as AppRole[], password: '', passwordConfirm: '',
  });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, rRes, dRes, cRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('*'),
      supabase.from('departments').select('*').eq('is_total', false).order('name_uz'),
      supabase.from('companies').select('*').order('short_name'),
    ]);
    if (pRes.error) toast.error(pRes.error.message);
    if (rRes.error) toast.error(rRes.error.message);

    const profiles = (pRes.data as Profile[]) ?? [];
    const allRoles = (rRes.data as UserRole[]) ?? [];
    const mapped: UserRow[] = profiles.map((p) => ({
      ...p,
      roles: allRoles.filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
    setRows(mapped);
    setDepartments((dRes.data as Department[]) ?? []);
    setCompanies((cRes.data as Company[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) =>
    r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ full_name: '', email: '', department_id: '', company_id: '', roles: [], password: '', passwordConfirm: '' });
    setOpen(true);
  };

  const openEdit = (p: Profile) => {
    setEditing(p);
    const userRoles = rows.find((r) => r.id === p.id)?.roles ?? [];
    setForm({ full_name: p.full_name ?? '', email: p.email ?? '', department_id: p.department_id ?? '', company_id: p.company_id ?? '', roles: userRoles, password: '', passwordConfirm: '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name.trim()) { toast.error(t('fullName')); return; }
    if (!form.email.trim()) { toast.error(t('email')); return; }
    if (!form.department_id) { toast.error(t('selectDept')); return; }
    if (!form.company_id) { toast.error(t('selectCompany')); return; }
    if (!form.roles.length) { toast.error(t('selectRole')); return; }

    if (editing) {
      const { error: pErr } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(), email: form.email.trim(),
        department_id: form.department_id || null, company_id: form.company_id || null,
      }).eq('id', editing.id);
      if (pErr) return toast.error(pErr.message);

      await supabase.from('user_roles').delete().eq('user_id', editing.id);
      if (form.roles.length) {
        await supabase.from('user_roles').insert(form.roles.map((r) => ({ user_id: editing.id, role: r })));
      }
      toast.success(t('saved'));
    } else {
      if (!form.password || form.password.length < 8) { toast.error(t('passwordTooShort')); return; }
      if (form.password !== form.passwordConfirm) { toast.error(t('passwordMismatch')); return; }

      setCreating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            email: form.email.trim(),
            department_id: form.department_id || null,
            company_id: form.company_id || null,
            roles: form.roles,
            password: form.password,
          }),
        });
        const result = await res.json();
        if (!res.ok || result.error) {
          toast.error(result.error || t('userCreateFailed'));
          setCreating(false);
          return;
        }
        toast.success(t('userCreated'));
      } catch {
        toast.error(t('userCreateFailed'));
        setCreating(false);
        return;
      }
      setCreating(false);
    }
    setOpen(false);
    await load();
  };

  const del = async (p: Profile) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('profiles').delete().eq('id', p.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  return (
    <div>
      <PageHeader title={t('users')}>
        {isAdmin && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('fullName'), t('email'), t('department'), t('company'), t('roles'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.full_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{r.email ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{departments.find((d) => d.id === r.department_id)?.name_uz ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{companies.find((c) => c.id === r.company_id)?.short_name ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {r.roles.map((role) => (
                      <Badge key={role} variant={role === 'admin' ? 'primary' : 'default'}>{ROLE_LABELS[role]}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {isAdmin && <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t('edit')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => del(r)}>{t('delete')}</Button>
                  </div>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => !creating && setOpen(false)} title={editing ? t('editUser') : t('newUser')}
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button>
          <Button onClick={save} disabled={creating}>{creating ? t('creating') : t('save')}</Button>
        </>}>
        <div className="space-y-4">
          <Input label={t('fullName')} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
          <Input label={t('email')} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
          <Select label={t('department')} value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name_uz ?? d.code }))} placeholder={t('selectDept')} required />
          <Select label={t('company')} value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v })}
            options={companies.map((c) => ({ value: c.id, label: c.short_name }))} placeholder={t('selectCompany')} required />
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">{t('roles')}<span className="text-destructive"> *</span></label>
            <div className="flex flex-wrap gap-1">
              {ROLES.map((r) => {
                const checked = form.roles.includes(r);
                return (
                  <button key={r} type="button"
                    onClick={() => setForm({ ...form, roles: checked ? form.roles.filter((x) => x !== r) : [...form.roles, r] })}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${checked ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}>
                    {ROLE_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>
          {!editing && (
            <>
              <Input label={t('password')} type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" />
              <Input label={t('passwordConfirm')} type="password" value={form.passwordConfirm} onChange={(v) => setForm({ ...form, passwordConfirm: v })} placeholder="••••••••" />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
