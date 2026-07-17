import { useEffect, useState } from 'react'
import { supabase, Department, FuelType, Vehicle, DailyEntry } from '../lib/supabase'
import { uz } from '../lib/i18n'
import { LoadingSpinner } from '../components/UI'
import { IconTruck, IconLayers, IconFuel, IconCalendar } from '../components/Icons'

export function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ vehicles: 0, departments: 0, fuelTypes: 0, entries: 0 })
  const [recentEntries, setRecentEntries] = useState<DailyEntry[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [{ data: vData }, { data: dData }, { data: fData }, { data: eData }] = await Promise.all([
          supabase.from('vehicles').select('*'),
          supabase.from('departments').select('*'),
          supabase.from('fuel_types').select('*'),
          supabase.from('daily_entries').select('*').order('created_at', { ascending: false }).limit(10),
        ])

        setVehicles(vData as Vehicle[] || [])
        setDepartments(dData as Department[] || [])
        setFuelTypes(fData as FuelType[] || [])
        setRecentEntries(eData as DailyEntry[] || [])
        setStats({
          vehicles: vData?.length || 0,
          departments: dData?.length || 0,
          fuelTypes: fData?.length || 0,
          entries: (eData as DailyEntry[])?.length || 0,
        })
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  const deptMap = new Map(departments.map(d => [d.id, d]))
  const fuelMap = new Map(fuelTypes.map(f => [f.id, f]))
  const vehicleMap = new Map(vehicles.map(v => [v.id, v]))

  const statCards = [
    { label: uz.dashboard.totalVehicles, value: stats.vehicles, icon: <IconTruck size={24} />, color: 'bg-primary-50 text-primary-700' },
    { label: uz.dashboard.totalDepartments, value: stats.departments, icon: <IconLayers size={24} />, color: 'bg-accent-50 text-accent-700' },
    { label: uz.dashboard.totalFuelTypes, value: stats.fuelTypes, icon: <IconFuel size={24} />, color: 'bg-success-50 text-success-700' },
    { label: uz.dashboard.totalEntries, value: stats.entries, icon: <IconCalendar size={24} />, color: 'bg-warning-50 text-warning-700' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">{uz.dashboard.title}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <div key={i} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500 mb-1">{card.label}</div>
                <div className="text-3xl font-bold text-slate-800">{card.value}</div>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent entries */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{uz.dashboard.recentEntries}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="table-header">{uz.form.date}</th>
                <th className="table-header">{uz.form.department}</th>
                <th className="table-header">{uz.form.vehicle}</th>
                <th className="table-header">{uz.form.fuelType}</th>
                <th className="table-header text-right">{uz.form.consumption}</th>
                <th className="table-header text-right">{uz.form.closingBalance}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentEntries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">{uz.table.noData}</td></tr>
              ) : recentEntries.map(entry => {
                const dept = deptMap.get(entry.department_id)
                const fuel = fuelMap.get(entry.fuel_type_id)
                const vehicle = vehicleMap.get(entry.vehicle_id)
                return (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell">{new Date(entry.entry_date).toLocaleDateString('uz')}</td>
                    <td className="table-cell">{dept?.name_uz || dept?.name || '-'}</td>
                    <td className="table-cell">{vehicle?.name_uz || vehicle?.name || '-'}</td>
                    <td className="table-cell">{fuel?.name_uz || fuel?.name || '-'}</td>
                    <td className="table-cell text-right font-medium">{Number(entry.consumption).toLocaleString()}</td>
                    <td className="table-cell text-right font-medium">{Number(entry.closing_balance).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
