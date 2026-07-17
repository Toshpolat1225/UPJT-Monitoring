import { useEffect, useState } from 'react'
import { supabase, DepartmentFuelMatrix, Department, FuelType } from '../../lib/supabase'
import { uz } from '../../lib/i18n'
import { PageHeader, LoadingSpinner, EmptyState, Toast } from '../../components/UI'
import { IconCheck, IconClose } from '../../components/Icons'

export function FuelMatrixPage() {
  const [matrix, setMatrix] = useState<DepartmentFuelMatrix[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: mData }, { data: dData }, { data: fData }] = await Promise.all([
      supabase.from('department_fuel_matrix').select('*'),
      supabase.from('departments').select('*').order('code'),
      supabase.from('fuel_types').select('*').order('code'),
    ])
    setMatrix(mData as DepartmentFuelMatrix[] || [])
    setDepartments(dData as Department[] || [])
    setFuelTypes(fData as FuelType[] || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function isEnabled(deptId: string, fuelId: string): boolean {
    return matrix.some(m => m.department_id === deptId && m.fuel_type_id === fuelId && m.enabled)
  }

  function getMatrixId(deptId: string, fuelId: string): string | undefined {
    return matrix.find(m => m.department_id === deptId && m.fuel_type_id === fuelId)?.id
  }

  async function toggle(deptId: string, fuelId: string) {
    const existing = matrix.find(m => m.department_id === deptId && m.fuel_type_id === fuelId)
    if (existing) {
      const { error } = await supabase
        .from('department_fuel_matrix')
        .update({ enabled: !existing.enabled })
        .eq('id', existing.id)
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    } else {
      const { error } = await supabase
        .from('department_fuel_matrix')
        .insert({ department_id: deptId, fuel_type_id: fuelId, enabled: true })
      if (!error) setToast({ message: uz.msg.saveSuccess, type: 'success' })
    }
    load()
  }

  if (loading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title={uz.nav.fuelMatrix} search="" onSearch={() => {}} />

      {departments.length === 0 || fuelTypes.length === 0 ? (
        <EmptyState message={uz.table.noData} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="table-header sticky left-0 bg-slate-50">{uz.form.department}</th>
                  {fuelTypes.map(f => (
                    <th key={f.id} className="table-header text-center">{f.name_uz}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell font-medium sticky left-0 bg-white">{d.code} - {d.name_uz}</td>
                    {fuelTypes.map(f => (
                      <td key={f.id} className="table-cell text-center">
                        <button
                          onClick={() => toggle(d.id, f.id)}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                            isEnabled(d.id, f.id)
                              ? 'bg-success-100 text-success-700 hover:bg-success-200'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {isEnabled(d.id, f.id) ? <IconCheck size={16} /> : <IconClose size={16} />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
