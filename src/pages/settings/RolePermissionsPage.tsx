import { useEffect, useState } from 'react'
import { supabase, RolePermission } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, LoadingSpinner, EmptyState, Toast } from '../../components/UI'
import { IconCheck, IconClose } from '../../components/Icons'

const ROLES = ['admin', 'gsm', 'operator', 'master', 'management'] as const
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  gsm: 'GSM',
  operator: 'Operator',
  master: 'Master',
  management: 'Boshqaruv',
}

export function RolePermissionsPage() {
  const [items, setItems] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('role_permissions').select('*').order('module').order('permission')
    setItems(data as RolePermission[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const modules = [...new Set(items.map(p => p.module))].sort()

  function getPermission(role: string, module: string, permission: string): boolean {
    return items.find(p => p.role === role && p.module === module && p.permission === permission)?.allowed || false
  }

  function getId(role: string, module: string, permission: string): string | undefined {
    return items.find(p => p.role === role && p.module === module && p.permission === permission)?.id
  }

  async function toggle(role: string, module: string, permission: string) {
    const id = getId(role, module, permission)
    if (!id) return
    const current = getPermission(role, module, permission)
    const { error } = await supabase.from('role_permissions').update({ allowed: !current }).eq('id', id)
    if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    load()
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  const allPermissions = [...new Set(items.map(p => p.permission))].sort()

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.rolePermissions} search="" onSearch={() => {}} />

      {items.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <div className="space-y-4">
          {modules.map(mod => {
            const perms = [...new Set(items.filter(p => p.module === mod).map(p => p.permission))]
            return (
              <div key={mod} className="card overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-700">{mod}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="table-header">{uz.form.permission}</th>
                        {ROLES.map(r => (
                          <th key={r} className="table-header text-center">{ROLE_LABELS[r]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {perms.map(perm => (
                        <tr key={perm} className="hover:bg-slate-50 transition-colors">
                          <td className="table-cell font-medium">{perm}</td>
                          {ROLES.map(r => (
                            <td key={r} className="table-cell text-center">
                              <button
                                onClick={() => toggle(r, mod, perm)}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                                  getPermission(r, mod, perm)
                                    ? 'bg-success-100 text-success-700 hover:bg-success-200'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {getPermission(r, mod, perm) ? <IconCheck size={16} /> : <IconClose size={16} />}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
