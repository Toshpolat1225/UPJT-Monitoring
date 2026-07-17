import { useEffect, useState } from 'react'
import { supabase, Vehicle, Department, FuelType } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, ActionButtons, ConfirmDialog, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

export function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form, setForm] = useState({ code: '', name: '', name_uz: '', name_ru: '', department_id: '', fuel_type_id: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: vData }, { data: dData }, { data: fData }] = await Promise.all([
      supabase.from('vehicles').select('*').order('code'),
      supabase.from('departments').select('*').order('code'),
      supabase.from('fuel_types').select('*').order('code'),
    ])
    setItems(vData as Vehicle[] || [])
    setDepartments(dData as Department[] || [])
    setFuelTypes(fData as FuelType[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deptMap = new Map(departments.map(d => [d.id, d]))
  const fuelMap = new Map(fuelTypes.map(f => [f.id, f]))
  const filtered = items.filter(v =>
    v.code.toLowerCase().includes(search.toLowerCase()) ||
    v.name_uz.toLowerCase().includes(search.toLowerCase()) ||
    (v.name_ru || '').toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ code: '', name: '', name_uz: '', name_ru: '', department_id: '', fuel_type_id: '' })
    setModalOpen(true)
  }

  function openEdit(v: Vehicle) {
    setEditing(v)
    setForm({
      code: v.code, name: v.name, name_uz: v.name_uz, name_ru: v.name_ru || '',
      department_id: v.department_id, fuel_type_id: v.fuel_type_id,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.code || !form.name_uz || !form.department_id || !form.fuel_type_id) return
    setSaving(true)
    const payload = {
      code: form.code,
      name: form.name || form.name_uz,
      name_uz: form.name_uz,
      name_ru: form.name_ru || null,
      department_id: form.department_id,
      fuel_type_id: form.fuel_type_id,
    }
    if (editing) {
      const { error } = await supabase.from('vehicles').update(payload).eq('id', editing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase.from('vehicles').insert(payload)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('vehicles').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (!error) setToast({ message: uz.msg.deleteSuccess, type: 'success' })
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.vehicles} onCreate={openCreate} createLabel={uz.action.create} search={search} onSearch={setSearch} />

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
              <th className="table-header">{uz.form.department}</th>
              <th className="table-header">{uz.form.fuelType}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((v, i) => (
              <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell text-slate-400">{i + 1}</td>
                <td className="table-cell font-medium">{v.code}</td>
                <td className="table-cell">{v.name_uz}</td>
                <td className="table-cell text-slate-500">{v.name_ru || '-'}</td>
                <td className="table-cell">{deptMap.get(v.department_id)?.name_uz || '-'}</td>
                <td className="table-cell">{fuelMap.get(v.fuel_type_id)?.name_uz || '-'}</td>
                <td className="table-cell text-right">
                  <ActionButtons onEdit={() => openEdit(v)} onDelete={() => setDeleteTarget(v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableContainer>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? uz.action.edit : uz.action.create} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{uz.form.code}</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <label className="label">{uz.form.department}</label>
              <select className="input" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                <option value="">—</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name_uz}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{uz.form.fuelType}</label>
            <select className="input" value={form.fuel_type_id} onChange={e => setForm({ ...form, fuel_type_id: e.target.value })}>
              <option value="">—</option>
              {fuelTypes.map(f => <option key={f.id} value={f.id}>{f.code} - {f.name_uz}</option>)}
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
        message={`${deleteTarget?.code || ''} - ${deleteTarget?.name_uz || ''}`}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
