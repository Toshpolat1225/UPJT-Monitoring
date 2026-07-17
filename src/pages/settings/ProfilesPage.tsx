import { useEffect, useState } from 'react'
import { supabase, Profile, Department, UserRole, AppRole } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, TableContainer, LoadingSpinner, EmptyState, Toast } from '../../components/UI'
import { Modal } from '../../components/Modal'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  gsm: 'GSM',
  operator: 'Operator',
  master: 'Master',
  management: 'Boshqaruv',
}

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', department_id: '', company_id: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: pData }, { data: rData }, { data: dData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('*'),
      supabase.from('departments').select('*').order('code'),
    ])
    setProfiles(pData as Profile[] || [])
    setUserRoles(rData as UserRole[] || [])
    setDepartments(dData as Department[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deptMap = new Map(departments.map(d => [d.id, d]))
  const filtered = profiles.filter(p =>
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(search.toLowerCase())
  )

  function getRoles(userId: string): string[] {
    return userRoles.filter(r => r.user_id === userId).map(r => r.role)
  }

  function openEdit(p: Profile) {
    setEditing(p)
    setForm({ full_name: p.full_name || '', email: p.email || '', department_id: p.department_id || '', company_id: p.company_id || '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name || null,
      email: form.email || null,
      department_id: form.department_id || null,
    }).eq('id', editing.id)
    setSaving(false)
    if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    setModalOpen(false)
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.profiles} search={search} onSearch={setSearch} />

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <TableContainer>
          <thead className="bg-slate-50">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">{uz.form.fullName}</th>
              <th className="table-header">{uz.form.email}</th>
              <th className="table-header">{uz.form.department}</th>
              <th className="table-header">{uz.form.role}</th>
              <th className="table-header text-right">{uz.table.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p, i) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="table-cell text-slate-400">{i + 1}</td>
                <td className="table-cell font-medium">{p.full_name || '-'}</td>
                <td className="table-cell">{p.email || '-'}</td>
                <td className="table-cell">{deptMap.get(p.department_id || '')?.name_uz || '-'}</td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-1">
                    {getRoles(p.id).map(r => (
                      <span key={r} className="badge-primary">{ROLE_LABELS[r] || r}</span>
                    ))}
                  </div>
                </td>
                <td className="table-cell text-right">
                  <button onClick={() => openEdit(p)} className="btn-ghost text-sm">
                    {uz.action.edit}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableContainer>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={uz.action.edit}>
        <div className="space-y-4">
          <div>
            <label className="label">{uz.form.fullNamePerson}</label>
            <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">{uz.form.email}</label>
            <input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">{uz.form.department}</label>
            <select className="input" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
              <option value="">—</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name_uz}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">{uz.action.cancel}</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{uz.action.save}</button>
          </div>
        </div>
      </Modal>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
