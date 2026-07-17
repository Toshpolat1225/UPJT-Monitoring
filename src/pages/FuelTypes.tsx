import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type FuelType, type FuelUnit } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Select, Modal, Table, EmptyState } from '../components/ui';

export default function FuelTypes() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FuelType | null>(null);
  const [form, setForm] = useState({ code: '', name_uz: '', unit: 'litr' as FuelUnit });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('fuel_types').select('*').order('name_uz');
    if (error) toast.error(error.message);
    setRows((data as FuelType[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => r.name_uz?.toLowerCase().includes(search.toLowerCase()) || r.code?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm({ code: '', name_uz: '', unit: 'litr' }); setOpen(true); };
  const openEdit = (r: FuelType) => { setEditing(r); setForm({ code: r.code, name_uz: r.name_uz ?? '', unit: r.unit }); setOpen(true); };

  const save = async () => {
    if (!form.code.trim() || !form.name_uz.trim()) { toast.error(t('fillAllFields')); return; }
    const payload = { code: form.code.trim(), name: form.name_uz.trim(), name_uz: form.name_uz.trim(), unit: form.unit };
    if (editing) {
      const { error } = await supabase.from('fuel_types').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('fuel_types').insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t('saved'));
    setOpen(false);
    await load();
  };

  const del = async (r: FuelType) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('fuel_types').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  return (
    <div>
      <PageHeader title={t('fuelTypes')}>
        {isAdmin && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('code'), t('name'), t('unit'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 font-mono text-foreground">{r.code}</td>
                <td className="px-4 py-2.5 text-foreground">{r.name_uz ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{r.unit === 'litr' ? t('litr') : t('m3')}</td>
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
          <Input label={t('code')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} required />
          <Input label={t('name')} value={form.name_uz} onChange={(v) => setForm({ ...form, name_uz: v })} required />
          <Select label={t('unit')} value={form.unit} onChange={(v) => setForm({ ...form, unit: v as FuelUnit })}
            options={[{ value: 'litr', label: t('litr') }, { value: 'm3', label: t('m3') }]} />
        </div>
      </Modal>
    </div>
  );
}
