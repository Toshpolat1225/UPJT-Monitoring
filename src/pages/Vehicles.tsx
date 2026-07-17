import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type Vehicle, type Department, type FuelType } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Select, Modal, Table, EmptyState } from '../components/ui';

export default function Vehicles() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<(Vehicle & { department_name?: string; fuel_type_name?: string })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({ code: '', name_uz: '', department_id: '', fuel_type_id: '' });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: vehs, error: vErr }, { data: depts, error: dErr }, { data: fts, error: fErr }] = await Promise.all([
      supabase.from('vehicles').select('*, department:departments(name_uz), fuel_type:fuel_types(name_uz)').order('name_uz'),
      supabase.from('departments').select('*').eq('is_total', false).order('name_uz'),
      supabase.from('fuel_types').select('*').order('name_uz'),
    ]);
    if (vErr) toast.error(vErr.message);
    if (dErr) toast.error(dErr.message);
    if (fErr) toast.error(fErr.message);
    setRows((vehs as any) ?? []);
    setDepartments((depts as Department[]) ?? []);
    setFuelTypes((fts as FuelType[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => r.name_uz?.toLowerCase().includes(search.toLowerCase()) || r.code?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm({ code: '', name_uz: '', department_id: '', fuel_type_id: '' }); setOpen(true); };
  const openEdit = (r: Vehicle) => { setEditing(r); setForm({ code: r.code, name_uz: r.name_uz ?? '', department_id: r.department_id, fuel_type_id: r.fuel_type_id }); setOpen(true); };

  const save = async () => {
    if (!form.code.trim() || !form.name_uz.trim() || !form.department_id || !form.fuel_type_id) { toast.error(t('fillAllFields')); return; }
    const payload = {
      code: form.code.trim(), name: form.name_uz.trim(), name_uz: form.name_uz.trim(),
      department_id: form.department_id, fuel_type_id: form.fuel_type_id,
    };
    if (editing) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('vehicles').insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t('saved'));
    setOpen(false);
    await load();
  };

  const del = async (r: Vehicle) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('vehicles').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  return (
    <div>
      <PageHeader title={t('vehicles')}>
        {isAdmin && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('code'), t('name'), t('department'), t('fuelType'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 font-mono text-foreground">{r.code}</td>
                <td className="px-4 py-2.5 text-foreground">{r.name_uz ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{(r as any).department?.name_uz ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{(r as any).fuel_type?.name_uz ?? '-'}</td>
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
          <Select label={t('department')} value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name_uz ?? d.code }))} placeholder={t('select')} required />
          <Select label={t('fuelType')} value={form.fuel_type_id} onChange={(v) => setForm({ ...form, fuel_type_id: v })}
            options={fuelTypes.map((f) => ({ value: f.id, label: f.name_uz ?? f.code }))} placeholder={t('select')} required />
        </div>
      </Modal>
    </div>
  );
}
