import { useEffect, useState } from 'react'
import { supabase, DailyEntry, Department, Section, Vehicle, FuelType } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, ActionButtons, ConfirmDialog, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

export function DailyEntriesPage() {
  const [items, setItems] = useState<DailyEntry[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DailyEntry | null>(null)
  const [form, setForm] = useState({
    entry_date: '', department_id: '', section_id: '', vehicle_id: '', fuel_type_id: '',
    opening_balance: 0, received_azs: 0, transfer_in: 0, transfer_out: 0, consumption: 0, closing_balance: 0,
  })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DailyEntry | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: eData }, { data: dData }, { data: sData }, { data: vData }, { data: fData }] = await Promise.all([
      supabase.from('daily_entries').select('*').order('entry_date', { ascending: false }).limit(100),
      supabase.from('departments').select('*').order('code'),
      supabase.from('sections').select('*').order('name_uz'),
      supabase.from('vehicles').select('*').order('code'),
      supabase.from('fuel_types').select('*').order('code'),
    ])
    setItems(eData as DailyEntry[] || [])
    setDepartments(dData as Department[] || [])
    setSections(sData as Section[] || [])
    setVehicles(vData as Vehicle[] || [])
    setFuelTypes(fData as FuelType[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deptMap = new Map(departments.map(d => [d.id, d]))
  const sectionMap = new Map(sections.map(s => [s.id, s]))
  const vehicleMap = new Map(vehicles.map(v => [v.id, v]))
  const fuelMap = new Map(fuelTypes.map(f => [f.id, f]))

  const filtered = items.filter(e => {
    const dept = deptMap.get(e.department_id)
    const veh = vehicleMap.get(e.vehicle_id)
    return (
      (dept?.name_uz || '').toLowerCase().includes(search.toLowerCase()) ||
      (veh?.name_uz || '').toLowerCase().includes(search.toLowerCase()) ||
      e.entry_date.includes(search)
    )
  })

  function openCreate() {
    setEditing(null)
    setForm({
      entry_date: new Date().toISOString().split('T')[0],
      department_id: '', section_id: '', vehicle_id: '', fuel_type_id: '',
      opening_balance: 0, received_azs: 0, transfer_in: 0, transfer_out: 0, consumption: 0, closing_balance: 0,
    })
    setModalOpen(true)
  }

  function openEdit(e: DailyEntry) {
    setEditing(e)
    setForm({
      entry_date: e.entry_date,
      department_id: e.department_id, section_id: e.section_id || '', vehicle_id: e.vehicle_id, fuel_type_id: e.fuel_type_id,
      opening_balance: e.opening_balance, received_azs: e.received_azs, transfer_in: e.transfer_in, transfer_out: e.transfer_out,
      consumption: e.consumption, closing_balance: e.closing_balance,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.entry_date || !form.department_id || !form.vehicle_id || !form.fuel_type_id) return
    setSaving(true)
    const payload = {
      entry_date: form.entry_date,
      department_id: form.department_id,
      section_id: form.section_id || null,
      vehicle_id: form.vehicle_id,
      fuel_type_id: form.fuel_type_id,
      opening_balance: form.opening_balance,
      received_azs: form.received_azs,
      transfer_in: form.transfer_in,
      transfer_out: form.transfer_out,
      consumption: form.consumption,
      closing_balance: form.closing_balance,
    }
    if (editing) {
      const { error } = await supabase.from('daily_entries').update(payload).eq('id', editing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase.from('daily_entries').insert(payload)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('daily_entries').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (!error) setToast({ message: uz.msg.deleteSuccess, type: 'success' })
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.dailyEntries} onCreate={openCreate} createLabel={uz.action.create} search={search} onSearch={setSearch} />

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <TableContainer>
          <thead className="bg-slate-50">
            <tr>
              <th className="table-header">{uz.form.date}</th>
              <th className="table-header">{uz.form.department}</th>
              <th className="table-header">{uz.form.section}</th>
              <th className="table-header">{uz.form.vehicle}</th>
              <th className="table-header">{uz.form.fuelType}</th>
              <th className="table-header text-right">{uz.form.openingBalance}</th>
              <th className="table-header text-right">{uz.form.receivedAzs}</th>
              <th className="table-header text-right">{uz.form.consumption}</th>
              <th className="table-header text-right">{uz.form.closingBalance}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell whitespace-nowrap">{new Date(e.entry_date).toLocaleDateString('uz')}</td>
                <td className="table-cell">{deptMap.get(e.department_id)?.name_uz || '-'}</td>
                <td className="table-cell">{sectionMap.get(e.section_id || '')?.name_uz || '-'}</td>
                <td className="table-cell">{vehicleMap.get(e.vehicle_id)?.name_uz || '-'}</td>
                <td className="table-cell">{fuelMap.get(e.fuel_type_id)?.name_uz || '-'}</td>
                <td className="table-cell text-right">{Number(e.opening_balance).toLocaleString()}</td>
                <td className="table-cell text-right">{Number(e.received_azs).toLocaleString()}</td>
                <td className="table-cell text-right">{Number(e.consumption).toLocaleString()}</td>
                <td className="table-cell text-right font-medium">{Number(e.closing_balance).toLocaleString()}</td>
                <td className="table-cell text-right">
                  <ActionButtons onEdit={() => openEdit(e)} onDelete={() => setDeleteTarget(e)} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableContainer>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? uz.action.edit : uz.action.create} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{uz.form.date}</label>
              <input type="date" className="input" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} />
            </div>
            <div>
              <label className="label">{uz.form.fuelType}</label>
              <select className="input" value={form.fuel_type_id} onChange={e => setForm({ ...form, fuel_type_id: e.target.value })}>
                <option value="">—</option>
                {fuelTypes.map(f => <option key={f.id} value={f.id}>{f.name_uz}</option>)}
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
            <label className="label">{uz.form.vehicle}</label>
            <select className="input" value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })}>
              <option value="">—</option>
              {vehicles.filter(v => v.department_id === form.department_id).map(v => <option key={v.id} value={v.id}>{v.code} - {v.name_uz}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">{uz.form.openingBalance}</label>
              <input type="number" step="0.01" className="input" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">{uz.form.receivedAzs}</label>
              <input type="number" step="0.01" className="input" value={form.received_azs} onChange={e => setForm({ ...form, received_azs: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">{uz.form.transferIn}</label>
              <input type="number" step="0.01" className="input" value={form.transfer_in} onChange={e => setForm({ ...form, transfer_in: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">{uz.form.transferOut}</label>
              <input type="number" step="0.01" className="input" value={form.transfer_out} onChange={e => setForm({ ...form, transfer_out: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">{uz.form.consumption}</label>
              <input type="number" step="0.01" className="input" value={form.consumption} onChange={e => setForm({ ...form, consumption: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">{uz.form.closingBalance}</label>
              <input type="number" step="0.01" className="input" value={form.closing_balance} onChange={e => setForm({ ...form, closing_balance: parseFloat(e.target.value) || 0 })} />
            </div>
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
        message={`${uz.form.date}: ${deleteTarget?.entry_date || ''}`}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
