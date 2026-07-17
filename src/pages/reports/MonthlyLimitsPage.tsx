import { useEffect, useState } from 'react'
import { supabase, MonthlyLimit, Department, Section, FuelType } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, ActionButtons, ConfirmDialog, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

export function MonthlyLimitsPage() {
  const [items, setItems] = useState<MonthlyLimit[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MonthlyLimit | null>(null)
  const [form, setForm] = useState({ department_id: '', section_id: '', fuel_type_id: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1, limit_value: 0 })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MonthlyLimit | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: mData }, { data: dData }, { data: sData }, { data: fData }] = await Promise.all([
      supabase.from('monthly_limits').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('departments').select('*').order('code'),
      supabase.from('sections').select('*').order('name_uz'),
      supabase.from('fuel_types').select('*').order('code'),
    ])
    setItems(mData as MonthlyLimit[] || [])
    setDepartments(dData as Department[] || [])
    setSections(sData as Section[] || [])
    setFuelTypes(fData as FuelType[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deptMap = new Map(departments.map(d => [d.id, d]))
  const sectionMap = new Map(sections.map(s => [s.id, s]))
  const fuelMap = new Map(fuelTypes.map(f => [f.id, f]))

  const filtered = items.filter(m => {
    const dept = deptMap.get(m.department_id)
    return (dept?.name_uz || '').toLowerCase().includes(search.toLowerCase()) ||
      `${m.year}`.includes(search) || uz.months[m.month - 1].toLowerCase().includes(search.toLowerCase())
  })

  function openCreate() {
    setEditing(null)
    setForm({ department_id: '', section_id: '', fuel_type_id: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1, limit_value: 0 })
    setModalOpen(true)
  }

  function openEdit(m: MonthlyLimit) {
    setEditing(m)
    setForm({ department_id: m.department_id, section_id: m.section_id || '', fuel_type_id: m.fuel_type_id, year: m.year, month: m.month, limit_value: m.limit_value })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.department_id || !form.fuel_type_id) return
    setSaving(true)
    const payload = {
      department_id: form.department_id,
      section_id: form.section_id || null,
      fuel_type_id: form.fuel_type_id,
      year: form.year,
      month: form.month,
      limit_value: form.limit_value,
    }
    if (editing) {
      const { error } = await supabase.from('monthly_limits').update(payload).eq('id', editing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase.from('monthly_limits').insert(payload)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('monthly_limits').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (!error) setToast({ message: uz.msg.deleteSuccess, type: 'success' })
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.monthlyLimits} onCreate={openCreate} createLabel={uz.action.create} search={search} onSearch={setSearch} />

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <TableContainer>
          <thead className="bg-slate-50">
            <tr>
              <th className="table-header">{uz.form.year}</th>
              <th className="table-header">{uz.form.month}</th>
              <th className="table-header">{uz.form.department}</th>
              <th className="table-header">{uz.form.section}</th>
              <th className="table-header">{uz.form.fuelType}</th>
              <th className="table-header text-right">{uz.form.limitValue}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell font-medium">{m.year}</td>
                <td className="table-cell">{uz.months[m.month - 1]}</td>
                <td className="table-cell">{deptMap.get(m.department_id)?.name_uz || '-'}</td>
                <td className="table-cell">{sectionMap.get(m.section_id || '')?.name_uz || '-'}</td>
                <td className="table-cell">{fuelMap.get(m.fuel_type_id)?.name_uz || '-'}</td>
                <td className="table-cell text-right font-medium">{Number(m.limit_value).toLocaleString()}</td>
                <td className="table-cell text-right">
                  <ActionButtons onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)} />
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
              <label className="label">{uz.form.year}</label>
              <input type="number" className="input" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })} />
            </div>
            <div>
              <label className="label">{uz.form.month}</label>
              <select className="input" value={form.month} onChange={e => setForm({ ...form, month: parseInt(e.target.value) })}>
                {uz.months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{uz.form.department}</label>
              <select className="input" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                <option value="">—</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name_uz}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{uz.form.section}</label>
              <select className="input" value={form.section_id} onChange={e => setForm({ ...form, section_id: e.target.value })}>
                <option value="">—</option>
                {sections.filter(s => s.department_id === form.department_id).map(s => <option key={s.id} value={s.id}>{s.name_uz}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{uz.form.fuelType}</label>
            <select className="input" value={form.fuel_type_id} onChange={e => setForm({ ...form, fuel_type_id: e.target.value })}>
              <option value="">—</option>
              {fuelTypes.map(f => <option key={f.id} value={f.id}>{f.name_uz}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{uz.form.limitValue}</label>
            <input type="number" step="0.01" className="input" value={form.limit_value} onChange={e => setForm({ ...form, limit_value: parseFloat(e.target.value) || 0 })} />
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
        message={`${deleteTarget?.year || ''} ${deleteTarget ? uz.months[deleteTarget.month - 1] : ''}`}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
