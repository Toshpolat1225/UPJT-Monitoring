import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type MonthlyLimit, type Department, type Section, type FuelType } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Select, Modal, Table, EmptyState } from '../components/ui';

interface LimitRow extends MonthlyLimit {
  department_name?: string;
  fuel_type_name?: string;
}

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

export default function MonthlyLimits() {
  const { isAdmin, hasRole } = useAuth();
  const canEdit = isAdmin || hasRole('gsm');
  const [rows, setRows] = useState<LimitRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MonthlyLimit | null>(null);
  const [form, setForm] = useState({
    department_id: '', section_id: '', fuel_type_id: '',
    year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1), limit_value: '0',
  });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [lRes, dRes, sRes, fRes] = await Promise.all([
      supabase.from('monthly_limits').select('*, department:departments(name_uz), fuel_type:fuel_types(name_uz)').order('year', { ascending: false }).limit(200),
      supabase.from('departments').select('*').eq('is_total', false).order('name_uz'),
      supabase.from('sections').select('*').order('name_uz'),
      supabase.from('fuel_types').select('*').order('name_uz'),
    ]);
    if (lRes.error) toast.error(lRes.error.message);
    setRows((lRes.data as any) ?? []);
    setDepartments((dRes.data as Department[]) ?? []);
    setSections((sRes.data as Section[]) ?? []);
    setFuelTypes((fRes.data as FuelType[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase();
    return !s || r.department_name?.toLowerCase().includes(s) || r.fuel_type_name?.toLowerCase().includes(s);
  });

  const openNew = () => {
    setEditing(null);
    setForm({ department_id: '', section_id: '', fuel_type_id: '', year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1), limit_value: '0' });
    setOpen(true);
  };
  const openEdit = (r: MonthlyLimit) => {
    setEditing(r);
    setForm({ department_id: r.department_id, section_id: r.section_id ?? '', fuel_type_id: r.fuel_type_id, year: String(r.year), month: String(r.month), limit_value: String(r.limit_value) });
    setOpen(true);
  };

  const save = async () => {
    if (!form.department_id || !form.fuel_type_id || !form.year || !form.month) { toast.error(t('fillAllFields')); return; }
    const payload = {
      department_id: form.department_id,
      section_id: form.section_id || null,
      fuel_type_id: form.fuel_type_id,
      year: Number(form.year),
      month: Number(form.month),
      limit_value: Number(form.limit_value) || 0,
    };
    if (editing) {
      const { error } = await supabase.from('monthly_limits').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('monthly_limits').insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t('saved'));
    setOpen(false);
    await load();
  };

  const del = async (r: MonthlyLimit) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('monthly_limits').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  return (
    <div>
      <PageHeader title={t('monthlyLimits')}>
        {canEdit && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('department'), t('fuelType'), t('year'), t('month'), t('limitValue'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 text-foreground">{r.department_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{r.fuel_type_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{r.year}</td>
                <td className="px-4 py-2.5 text-foreground">{MONTHS[r.month - 1] ?? r.month}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{r.limit_value}</td>
                <td className="px-4 py-2.5">
                  {canEdit && <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t('edit')}</Button>
                    {isAdmin && <Button size="sm" variant="ghost" onClick={() => del(r)}>{t('delete')}</Button>}
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
          <Select label={t('department')} value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name_uz ?? d.code }))} placeholder={t('select')} required />
          <Select label={t('section')} value={form.section_id} onChange={(v) => setForm({ ...form, section_id: v })}
            options={sections.filter((s) => !form.department_id || s.department_id === form.department_id).map((s) => ({ value: s.id, label: s.name_uz ?? s.name }))}
            placeholder={t('none')} />
          <Select label={t('fuelType')} value={form.fuel_type_id} onChange={(v) => setForm({ ...form, fuel_type_id: v })}
            options={fuelTypes.map((f) => ({ value: f.id, label: f.name_uz ?? f.name }))} placeholder={t('select')} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('year')} type="number" value={form.year} onChange={(v) => setForm({ ...form, year: v })} required />
            <Select label={t('month')} value={form.month} onChange={(v) => setForm({ ...form, month: v })}
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          </div>
          <Input label={t('limitValue')} type="number" value={form.limit_value} onChange={(v) => setForm({ ...form, limit_value: v })} required />
        </div>
      </Modal>
    </div>
  );
}
