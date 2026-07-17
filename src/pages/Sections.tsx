import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type Section, type Department } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Select, Modal, Table, EmptyState } from '../components/ui';

export default function Sections() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<(Section & { department_name?: string })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState({ name_uz: '', department_id: '' });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: secs, error: sErr }, { data: depts, error: dErr }] = await Promise.all([
      supabase.from('sections').select('*, department:departments(name_uz)').order('name_uz'),
      supabase.from('departments').select('*').eq('is_total', false).order('name_uz'),
    ]);
    if (sErr) toast.error(sErr.message);
    if (dErr) toast.error(dErr.message);
    setRows((secs as any) ?? []);
    setDepartments((depts as Department[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => r.name_uz?.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setEditing(null); setForm({ name_uz: '', department_id: '' }); setOpen(true); };
  const openEdit = (r: Section) => { setEditing(r); setForm({ name_uz: r.name_uz ?? '', department_id: r.department_id }); setOpen(true); };

  const save = async () => {
    if (!form.name_uz.trim() || !form.department_id) { toast.error(t('fillAllFields')); return; }
    const payload = { name: form.name_uz.trim(), name_uz: form.name_uz.trim(), department_id: form.department_id };
    if (editing) {
      const { error } = await supabase.from('sections').update(payload).eq('id', editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('sections').insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t('saved'));
    setOpen(false);
    await load();
  };

  const del = async (r: Section) => {
    if (!confirm(t('confirmDelete'))) return;
    const { error } = await supabase.from('sections').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(t('deleted'));
    await load();
  };

  return (
    <div>
      <PageHeader title={t('sections')}>
        {isAdmin && <Button onClick={openNew}>{t('add')}</Button>}
      </PageHeader>
      <Card>
        <div className="mb-4"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('sectionName'), t('parentDepartment'), t('actions')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 text-foreground">{r.name_uz ?? '-'}</td>
                <td className="px-4 py-2.5 text-foreground">{(r as any).department?.name_uz ?? '-'}</td>
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
          <Input label={t('sectionName')} value={form.name_uz} onChange={(v) => setForm({ ...form, name_uz: v })} required />
          <Select label={t('parentDepartment')} value={form.department_id} onChange={(v) => setForm({ ...form, department_id: v })}
            options={departments.map((d) => ({ value: d.id, label: d.name_uz ?? d.code }))} placeholder={t('select')} required />
        </div>
      </Modal>
    </div>
  );
}
