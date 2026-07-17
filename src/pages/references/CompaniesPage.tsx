import { useEffect, useState } from 'react'
import { supabase, Company } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, ActionButtons, ConfirmDialog, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

export function CompaniesPage() {
  const [items, setItems] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState({ short_name: '', full_name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('companies').select('*').order('short_name')
    setItems(data as Company[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(c =>
    c.short_name.toLowerCase().includes(search.toLowerCase()) ||
    c.full_name.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ short_name: '', full_name: '' })
    setModalOpen(true)
  }

  function openEdit(c: Company) {
    setEditing(c)
    setForm({ short_name: c.short_name, full_name: c.full_name })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.short_name || !form.full_name) return
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('companies').update(form).eq('id', editing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase.from('companies').insert(form)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    setSaving(false)
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('companies').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (!error) setToast({ message: uz.msg.deleteSuccess, type: 'success' })
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.companies} onCreate={openCreate} createLabel={uz.action.create} search={search} onSearch={setSearch} />

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <TableContainer>
          <thead className="bg-slate-50">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">{uz.form.shortName}</th>
              <th className="table-header">{uz.form.fullName}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c, i) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell text-slate-400">{i + 1}</td>
                <td className="table-cell font-medium">{c.short_name}</td>
                <td className="table-cell">{c.full_name}</td>
                <td className="table-cell text-right">
                  <ActionButtons onEdit={() => openEdit(c)} onDelete={() => setDeleteTarget(c)} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableContainer>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? uz.action.edit : uz.action.create}>
        <div className="space-y-4">
          <div>
            <label className="label">{uz.form.shortName}</label>
            <input className="input" value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value })} />
          </div>
          <div>
            <label className="label">{uz.form.fullName}</label>
            <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
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
        message={`${deleteTarget?.short_name || ''} - ${deleteTarget?.full_name || ''}`}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
