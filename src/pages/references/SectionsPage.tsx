import { useEffect, useState } from 'react'
import { supabase, Section, Department } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, ActionButtons, ConfirmDialog, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

export function SectionsPage() {
  const [items, setItems] = useState<Section[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Section | null>(null)
  const [form, setForm] = useState({ name: '', name_uz: '', name_ru: '', department_id: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: sData }, { data: dData }] = await Promise.all([
      supabase.from('sections').select('*').order('name_uz'),
      supabase.from('departments').select('*').order('code'),
    ])
    setItems(sData as Section[] || [])
    setDepartments(dData as Department[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deptMap = new Map(departments.map(d => [d.id, d]))
  const filtered = items.filter(s =>
    s.name_uz.toLowerCase().includes(search.toLowerCase()) ||
    (s.name_ru || '').toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ name: '', name_uz: '', name_ru: '', department_id: '' })
    setModalOpen(true)
  }

  function openEdit(s: Section) {
    setEditing(s)
    setForm({ name: s.name, name_uz: s.name_uz, name_ru: s.name_ru || '', department_id: s.department_id })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name_uz || !form.department_id) return
    setSaving(true)
    const payload = {
      name: form.name || form.name_uz,
      name_uz: form.name_uz,
      name_ru: form.name_ru || null,
      department_id: form.department_id,
    }
    if (editing) {
      const { error } = await supabase.from('sections').update(payload).eq('id', editing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase.from('sections').insert(payload)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('sections').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (!error) setToast({ message: uz.msg.deleteSuccess, type: 'success' })
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.sections} onCreate={openCreate} createLabel={uz.action.create} search={search} onSearch={setSearch} />

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <TableContainer>
          <thead className="bg-slate-50">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">{uz.form.nameUz}</th>
              <th className="table-header">{uz.form.nameRu}</th>
              <th className="table-header">{uz.form.department}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s, i) => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell text-slate-400">{i + 1}</td>
                <td className="table-cell font-medium">{s.name_uz}</td>
                <td className="table-cell text-slate-500">{s.name_ru || '-'}</td>
                <td className="table-cell">{deptMap.get(s.department_id)?.name_uz || '-'}</td>
                <td className="table-cell text-right">
                  <ActionButtons onEdit={() => openEdit(s)} onDelete={() => setDeleteTarget(s)} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableContainer>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? uz.action.edit : uz.action.create}>
        <div className="space-y-4">
          <div>
            <label className="label">{uz.form.department}</label>
            <select className="input" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name_uz}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{uz.form.nameUz}</label>
            <input className="input" value={form.name_uz} onChange={e => setForm({ ...form, name_uz: e.target.value })} />
          </div>
          <div>
            <label className="label">{uz.form.nameRu}</label>
            <input className="input" value={form.name_ru} onChange={e => setForm({ ...form, name_ru: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">{uz.action.cancel}</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{uz.action.save}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={uz.action.confirmDelete}
        message={deleteTarget?.name_uz || ''}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
