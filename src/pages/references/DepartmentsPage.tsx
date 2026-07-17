import { useEffect, useState } from 'react'
import { supabase, Department, Company } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, ActionButtons, ConfirmDialog, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

export function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ code: '', name: '', name_uz: '', name_ru: '', is_total: false, company_id: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: dData }, { data: cData }] = await Promise.all([
      supabase.from('departments').select('*').order('code'),
      supabase.from('companies').select('*').order('short_name'),
    ])
    setItems(dData as Department[] || [])
    setCompanies(cData as Company[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const companyMap = new Map(companies.map(c => [c.id, c]))
  const filtered = items.filter(d =>
    d.code.toLowerCase().includes(search.toLowerCase()) ||
    d.name_uz.toLowerCase().includes(search.toLowerCase()) ||
    (d.name_ru || '').toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ code: '', name: '', name_uz: '', name_ru: '', is_total: false, company_id: '' })
    setModalOpen(true)
  }

  function openEdit(d: Department) {
    setEditing(d)
    setForm({
      code: d.code,
      name: d.name,
      name_uz: d.name_uz,
      name_ru: d.name_ru || '',
      is_total: d.is_total,
      company_id: d.company_id || '',
    })
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
      is_total: form.is_total,
      company_id: form.company_id || null,
    }
    if (editing) {
      const { error } = await supabase.from('departments').update(payload).eq('id', editing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase.from('departments').insert(payload)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('departments').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (!error) setToast({ message: uz.msg.deleteSuccess, type: 'success' })
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.departments} onCreate={openCreate} createLabel={uz.action.create} search={search} onSearch={setSearch} />

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
              <th className="table-header">{uz.form.company}</th>
              <th className="table-header">{uz.form.isTotal}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((d, i) => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell text-slate-400">{i + 1}</td>
                <td className="table-cell font-medium">{d.code}</td>
                <td className="table-cell">{d.name_uz}</td>
                <td className="table-cell text-slate-500">{d.name_ru || '-'}</td>
                <td className="table-cell">{companyMap.get(d.company_id || '')?.short_name || '-'}</td>
                <td className="table-cell">{d.is_total ? <span className="badge-primary">{uz.form.isTotal}</span> : '-'}</td>
                <td className="table-cell text-right">
                  <ActionButtons onEdit={() => openEdit(d)} onDelete={() => setDeleteTarget(d)} />
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
              <label className="label">{uz.form.company}</label>
              <select className="input" value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}>
                <option value="">—</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.short_name}</option>)}
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
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_total} onChange={e => setForm({ ...form, is_total: e.target.checked })} className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-slate-700">{uz.form.isTotal}</span>
            </label>
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
