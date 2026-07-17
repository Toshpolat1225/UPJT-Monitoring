import { useEffect, useState } from 'react'
import { supabase, FuelType } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, ActionButtons, ConfirmDialog, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

export function FuelTypesPage() {
  const [items, setItems] = useState<FuelType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FuelType | null>(null)
  const [form, setForm] = useState({ code: '', name: '', name_uz: '', name_ru: '', unit: 'litr' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FuelType | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('fuel_types').select('*').order('code')
    setItems(data as FuelType[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(f =>
    f.code.toLowerCase().includes(search.toLowerCase()) ||
    f.name_uz.toLowerCase().includes(search.toLowerCase()) ||
    (f.name_ru || '').toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ code: '', name: '', name_uz: '', name_ru: '', unit: 'litr' })
    setModalOpen(true)
  }

  function openEdit(f: FuelType) {
    setEditing(f)
    setForm({ code: f.code, name: f.name, name_uz: f.name_uz, name_ru: f.name_ru || '', unit: f.unit })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.code || !form.name_uz) return
    setSaving(true)
    const payload = {
      code: form.code,
      name: form.name || form.name_uz,
      name_uz: form.name_uz,
      name_ru: form.name_ru || null,
      unit: form.unit,
    }
    if (editing) {
      const { error } = await supabase.from('fuel_types').update(payload).eq('id', editing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase.from('fuel_types').insert(payload)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('fuel_types').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (!error) setToast({ message: uz.msg.deleteSuccess, type: 'success' })
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.fuelTypes} onCreate={openCreate} createLabel={uz.action.create} search={search} onSearch={setSearch} />

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <TableContainer>
          <thead className="bg-slate-50">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">{uz.form.code}</th>
              <th className="table-header">{uz.form.nameUz}</th>
              <th className="table-header">{uz.form.nameRu}</th>
              <th className="table-header">{uz.form.unit}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((f, i) => (
              <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell text-slate-400">{i + 1}</td>
                <td className="table-cell font-medium">{f.code}</td>
                <td className="table-cell">{f.name_uz}</td>
                <td className="table-cell text-slate-500">{f.name_ru || '-'}</td>
                <td className="table-cell">{f.unit}</td>
                <td className="table-cell text-right">
                  <ActionButtons onEdit={() => openEdit(f)} onDelete={() => setDeleteTarget(f)} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableContainer>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? uz.action.edit : uz.action.create}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{uz.form.code}</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <label className="label">{uz.form.unit}</label>
              <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                <option value="litr">Litr</option>
                <option value="m3">m³</option>
                <option value="kg">Kilogramm</option>
              </select>
            </div>
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
        message={`${deleteTarget?.code || ''} - ${deleteTarget?.name_uz || ''}`}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
