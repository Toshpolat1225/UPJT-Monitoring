import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type Department, type Company } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Select, Modal, Table, EmptyState, Badge } from '../components/ui';

export default function Departments() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ code: '', name_uz: '', is_total: false, company_id: '' });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: depts, error: dErr }, { data: comps, error: cErr }] = await Promise.all([
      supabase.from('departments').select('*').order('code'),
      supabase.from('companies').select('*').order('short_name'),
    ]);
    if (dErr) toast.error(dErr.message);
    if (cErr) toast.error(cErr.message);
    setRows((depts as Department[]) ?? []);
    setCompanies((comps as Company[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) =>
    r.name_uz?.toLowerCase().includes(search.toLowerCase()) ||
    r.code?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => { setEditing(null); setForm({ code: '', name_uz: '', is_total: false, company_id: '' }); setOpen(true); };
  const openEdit = (r: Department) => { setEditing(r); setForm({ code: r.code, name_uz: r.name_uz ?? '', is_total: r.is_total, company_id: r.company_id ?? '' }); setOpen(true); };

  const save = async () => {
    if (!form.code.trim() || !form.name_uz.trim()) { toast.error(t('fillAllFields')); return; }
    const payload = {
      code: form.code.trim(),
      name: form.name_uz.trim(),
      name_uz: form.name_uz.trim(),
      is_total: form.is_total,
      company_id: form.company_id || null,
    };
    if (editing) {
      const { error } = await supabase.from('departments').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
      toast.success(t('saved'));
    } else {
      const { error } = await supabase.from('departments').insert(payload);
      if (error) return toast.error(error.message);
      toast.success(t('saved'));
    }
    setOpen(false);
    await load();
  };

  const del = async (r: Department) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('departments').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  return (
    <div>
      <PageHeader title={t('departments')}>
        {isAdmin && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>

      <Card>
        <div className="mb-4">
          <Input label="" value={search} onChange={setSearch} placeholder={t('search')} />
        </div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('code'), t('name'), t('company'), t('status'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 font-mono text-foreground">{r.code}</td>
                <td className="px-4 py-2.5 text-foreground">{r.name_uz ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{companies.find((c) => c.id === r.company_id)?.short_name ?? '-'}</td>
                <td className="px-4 py-2.5">{r.is_total ? <Badge variant="primary">{t('isTotal')}</Badge> : <Badge>{t('active')}</Badge>}</td>
                <td className="px-4 py-2.5">
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t('edit')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => del(r)}>{t('delete')}</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('edit') : t('create')}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('code')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} required />
          <Input label={t('name')} value={form.name_uz} onChange={(v) => setForm({ ...form, name_uz: v })} required />
          <Select label={t('company')} value={form.company_id} onChange={(v) => setForm({ ...form, company_id: v })}
            options={companies.map((c) => ({ value: c.id, label: c.short_name }))} placeholder={t('select')} />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.is_total} onChange={(e) => setForm({ ...form, is_total: e.target.checked })} />
            {t('isTotal')}
          </label>
        </div>
      </Modal>
    </div>
  );
}
