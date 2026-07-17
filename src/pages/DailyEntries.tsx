import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type DailyEntry, type Department, type Section, type Vehicle, type FuelType } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Select, Modal, Table, EmptyState } from '../components/ui';

interface EntryRow extends DailyEntry {
  department_name?: string;
  vehicle_name?: string;
  fuel_type_name?: string;
}

export default function DailyEntries() {
  const { isAdmin, hasAny } = useAuth();
  const canEdit = isAdmin || hasAny(['gsm', 'operator', 'master']);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DailyEntry | null>(null);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    department_id: '', section_id: '', vehicle_id: '', fuel_type_id: '',
    opening_balance: '0', received_azs: '0', transfer_in: '0', transfer_out: '0', consumption: '0', closing_balance: '0',
  });
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [eRes, dRes, sRes, vRes, fRes] = await Promise.all([
      supabase.from('daily_entries').select('*, department:departments(name_uz), vehicle:vehicles(name_uz), fuel_type:fuel_types(name_uz)').order('entry_date', { ascending: false }).limit(100),
      supabase.from('departments').select('*').eq('is_total', false).order('name_uz'),
      supabase.from('sections').select('*').order('name_uz'),
      supabase.from('vehicles').select('*').order('name_uz'),
      supabase.from('fuel_types').select('*').order('name_uz'),
    ]);
    if (eRes.error) toast.error(eRes.error.message);
    setRows((eRes.data as any) ?? []);
    setDepartments((dRes.data as Department[]) ?? []);
    setSections((sRes.data as Section[]) ?? []);
    setVehicles((vRes.data as Vehicle[]) ?? []);
    setFuelTypes((fRes.data as FuelType[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase();
    const matchSearch = !s || r.vehicle_name?.toLowerCase().includes(s) || r.department_name?.toLowerCase().includes(s);
    const matchDept = !filterDept || r.department_id === filterDept;
    return matchSearch && matchDept;
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      entry_date: new Date().toISOString().slice(0, 10),
      department_id: '', section_id: '', vehicle_id: '', fuel_type_id: '',
      opening_balance: '0', received_azs: '0', transfer_in: '0', transfer_out: '0', consumption: '0', closing_balance: '0',
    });
    setOpen(true);
  };

  const openEdit = (r: DailyEntry) => {
    setEditing(r);
    setForm({
      entry_date: r.entry_date, department_id: r.department_id, section_id: r.section_id ?? '',
      vehicle_id: r.vehicle_id, fuel_type_id: r.fuel_type_id,
      opening_balance: String(r.opening_balance), received_azs: String(r.received_azs),
      transfer_in: String(r.transfer_in), transfer_out: String(r.transfer_out),
      consumption: String(r.consumption), closing_balance: String(r.closing_balance),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.entry_date || !form.department_id || !form.vehicle_id || !form.fuel_type_id) {
      toast.error(t('fillAllFields')); return;
    }
    const payload = {
      entry_date: form.entry_date,
      department_id: form.department_id,
      section_id: form.section_id || null,
      vehicle_id: form.vehicle_id,
      fuel_type_id: form.fuel_type_id,
      opening_balance: Number(form.opening_balance) || 0,
      received_azs: Number(form.received_azs) || 0,
      transfer_in: Number(form.transfer_in) || 0,
      transfer_out: Number(form.transfer_out) || 0,
      consumption: Number(form.consumption) || 0,
      closing_balance: Number(form.closing_balance) || 0,
    };
    if (editing) {
      const { error } = await supabase.from('daily_entries').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('daily_entries').insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t('saved'));
    setOpen(false);
    await load();
  };

  const del = async (r: DailyEntry) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('daily_entries').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  const numFields: { key: keyof typeof form; label: string }[] = [
    { key: 'opening_balance', label: t('openingBalance') },
    { key: 'received_azs', label: t('receivedAzs') },
    { key: 'transfer_in', label: t('transferIn') },
    { key: 'transfer_out', label: t('transferOut') },
    { key: 'consumption', label: t('consumption') },
    { key: 'closing_balance', label: t('closingBalance') },
  ];

  return (
    <div>
      <PageHeader title={t('dailyEntries')}>
        {canEdit && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
          <div className="sm:w-48">
            <Select label="" value={filterDept} onChange={setFilterDept}
              options={departments.map((d) => ({ value: d.id, label: d.name_uz ?? d.code }))}
              placeholder={t('all')} />
          </div>
        </div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('date'), t('department'), t('vehicle'), t('fuelType'), t('consumption'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 text-foreground">{r.entry_date}</td>
                <td className="px-4 py-2.5 text-foreground">{r.department_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{r.vehicle_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{r.fuel_type_name ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{r.consumption}</td>
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
          <Input label={t('entryDate')} type="date" value={form.entry_date} onChange={(v) => setForm({ ...form, entry_date: v })} required />
          <Select label={t('department')} value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name_uz ?? d.code }))} placeholder={t('select')} required />
          <Select label={t('section')} value={form.section_id} onChange={(v) => setForm({ ...form, section_id: v })}
            options={sections.filter((s) => !form.department_id || s.department_id === form.department_id).map((s) => ({ value: s.id, label: s.name_uz ?? s.name }))}
            placeholder={t('none')} />
          <Select label={t('vehicle')} value={form.vehicle_id} onChange={(v) => setForm({ ...form, vehicle_id: v })}
            options={vehicles.filter((v) => !form.department_id || v.department_id === form.department_id).map((v) => ({ value: v.id, label: `${v.code} - ${v.name_uz ?? v.name}` }))}
            placeholder={t('select')} required />
          <Select label={t('fuelType')} value={form.fuel_type_id} onChange={(v) => setForm({ ...form, fuel_type_id: v })}
            options={fuelTypes.map((f) => ({ value: f.id, label: f.name_uz ?? f.name }))}
            placeholder={t('select')} required />
          <div className="grid grid-cols-2 gap-3">
            {numFields.map((f) => (
              <Input key={f.key} label={f.label} type="number" value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
