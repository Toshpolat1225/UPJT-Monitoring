import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type Company } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Modal, Table, EmptyState } from '../components/ui';

export default function Companies() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ short_name: '', full_name: '' });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('companies').select('*').order('short_name');
    if (error) toast.error(error.message);
    setRows((data as Company[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => r.short_name?.toLowerCase().includes(search.toLowerCase()) || r.full_name?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm({ short_name: '', full_name: '' }); setOpen(true); };
  const openEdit = (r: Company) => { setEditing(r); setForm({ short_name: r.short_name, full_name: r.full_name }); setOpen(true); };

  const save = async () => {
    if (!form.short_name.trim() || !form.full_name.trim()) { toast.error(t('fillAllFields')); return; }
    const payload = { short_name: form.short_name.trim(), full_name: form.full_name.trim() };
    if (editing) {
      const { error } = await supabase.from('companies').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('companies').insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t('saved'));
    setOpen(false);
    await load();
  };

  const del = async (r: Company) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('companies').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  return (
    <div>
      <PageHeader title={t('companies')}>
        {isAdmin && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('shortName'), t('fullNameLabel'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 font-medium text-foreground">{r.short_name}</td>
                <td className="px-4 py-2.5 text-foreground">{r.full_name}</td>
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
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('edit') : t('create')}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('shortName')} value={form.short_name} onChange={(v) => setForm({ ...form, short_name: v })} required />
          <Input label={t('fullNameLabel')} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
        </div>
      </Modal>
    </div>
  );
}
