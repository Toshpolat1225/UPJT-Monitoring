import { useState, useEffect, useMemo, useCallback } from 'react'
import { Printer, Calendar, Fuel, Layers } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Department, FuelType, DailyEntry, MonthlyLimit, DateRange, PeriodData } from '../types'

interface RowData {
  department: Department
  fuelType: FuelType
  period1: PeriodData
  period2: PeriodData
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

function defaultRange(endOffset: number): DateRange {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today)
  end.setDate(end.getDate() + endOffset)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export default function SexFuelTable() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([])
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [limits, setLimits] = useState<MonthlyLimit[]>([])
  const [loading, setLoading] = useState(true)

  const [range1, setRange1] = useState<DateRange>(() => defaultRange(0))
  const [range2, setRange2] = useState<DateRange>(() => {
    const start = new Date()
    start.setDate(1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    }
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [deptRes, fuelRes, entryRes, limitRes] = await Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('fuel_types').select('*').order('name'),
      supabase.from('daily_entries').select('*'),
      supabase.from('monthly_limits').select('*'),
    ])

    if (deptRes.data) setDepartments(deptRes.data as Department[])
    if (fuelRes.data) setFuelTypes(fuelRes.data as FuelType[])
    if (entryRes.data) setEntries(entryRes.data as DailyEntry[])
    if (limitRes.data) setLimits(limitRes.data as MonthlyLimit[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const computePeriod = useCallback(
    (deptId: string, fuelId: string, range: DateRange): PeriodData => {
      const rangeEntries = entries.filter(
        (e) =>
          e.department_id === deptId &&
          e.fuel_type_id === fuelId &&
          e.entry_date >= range.startDate &&
          e.entry_date <= range.endDate,
      )
      const consumption = rangeEntries.reduce((sum, e) => sum + Number(e.consumption), 0)

      const startDate = new Date(range.startDate)
      const monthlyLimit = limits.find(
        (l) =>
          l.department_id === deptId &&
          l.fuel_type_id === fuelId &&
          l.year === startDate.getFullYear() &&
          l.month === startDate.getMonth() + 1,
      )
      const limitValue = monthlyLimit ? Number(monthlyLimit.limit_value) : 0
      const dailyNorm = limitValue / 30
      const daysCount = Math.max(
        1,
        Math.round(
          (new Date(range.endDate).getTime() - new Date(range.startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1,
      )
      const norm = dailyNorm * daysCount
      const excess = consumption - norm
      const percentage = norm > 0 ? (consumption / norm) * 100 : 0

      return { limit: limitValue, norm, excess, percentage }
    },
    [entries, limits],
  )

  const rows: RowData[] = useMemo(() => {
    const depts = departments.filter((d) => !d.is_total)
    const result: RowData[] = []
    for (const dept of depts) {
      for (const fuel of fuelTypes) {
        const hasData =
          entries.some(
            (e) => e.department_id === dept.id && e.fuel_type_id === fuel.id,
          ) ||
          limits.some(
            (l) => l.department_id === dept.id && l.fuel_type_id === fuel.id,
          )
        if (hasData) {
          result.push({
            department: dept,
            fuelType: fuel,
            period1: computePeriod(dept.id, fuel.id, range1),
            period2: computePeriod(dept.id, fuel.id, range2),
          })
        }
      }
    }
    return result
  }, [departments, fuelTypes, entries, limits, range1, range2, computePeriod])

  const totals = useMemo(() => {
    const t1Limit = rows.reduce((s, r) => s + r.period1.limit, 0)
    const t1Norm = rows.reduce((s, r) => s + r.period1.norm, 0)
    const t1Excess = rows.reduce((s, r) => s + r.period1.excess, 0)
    const t1Pct = t1Norm > 0 ? (rows.reduce((s, r) => s + r.period1.norm * r.period1.percentage, 0) / t1Norm) : 0
    const t2Limit = rows.reduce((s, r) => s + r.period2.limit, 0)
    const t2Norm = rows.reduce((s, r) => s + r.period2.norm, 0)
    const t2Excess = rows.reduce((s, r) => s + r.period2.excess, 0)
    const t2Pct = t2Norm > 0 ? (rows.reduce((s, r) => s + r.period2.norm * r.period2.percentage, 0) / t2Norm) : 0
    return {
      p1: { limit: t1Limit, norm: t1Norm, excess: t1Excess, percentage: t1Pct },
      p2: { limit: t2Limit, norm: t2Norm, excess: t2Excess, percentage: t2Pct },
    }
  }, [rows])

  const handlePrint = () => {
    window.print()
  }

  const periodColumns = ['Davr limiti', "Davr me'yori / mezon", "Davr og'ishi", 'Davr foizi']

  return (
    <div className="space-y-4">
      {/* Header area with date filters and print button */}
      <div className="no-print bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-800">Sex / Yoqilg'i turi</h2>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Chop etish
          </button>
        </div>

        {/* Two date range filters side by side */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Period 1 */}
          <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-3">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">Davr 1</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sana (dan)</label>
                <input
                  type="date"
                  value={range1.startDate}
                  onChange={(e) => setRange1((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sana (gacha)</label>
                <input
                  type="date"
                  value={range1.endDate}
                  onChange={(e) => setRange1((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Period 2 */}
          <div className="rounded-lg border border-accent-200 bg-accent-50/50 p-3">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-accent-600" />
              <span className="text-sm font-semibold text-accent-700">Davr 2</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sana (dan)</label>
                <input
                  type="date"
                  value={range2.startDate}
                  onChange={(e) => setRange2((p) => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sana (gacha)</label>
                <input
                  type="date"
                  value={range2.endDate}
                  onChange={(e) => setRange2((p) => ({ ...p, endDate: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-accent-400 focus:border-accent-400 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print container - only this prints */}
      <div className="print-container bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        {/* Print-only header block */}
        <div className="print-header hidden">
          <h1>AGMK UPJT</h1>
          <h2>Fuel Monitoring System</h2>
          <h3>Sex / Yoqilg'i turi hisoboti</h3>
          <p className="print-dates">
            Davr 1: {formatDateDisplay(range1.startDate)} - {formatDateDisplay(range1.endDate)}
          </p>
          <p className="print-dates">
            Davr 2: {formatDateDisplay(range2.startDate)} - {formatDateDisplay(range2.endDate)}
          </p>
          <p className="print-meta">
            Chop etish sanasi: {new Date().toLocaleString('ru-RU')}
          </p>
        </div>

        <table className="print-table w-full text-sm border-collapse">
          <thead>
            {/* Row 1: Group headers */}
            <tr>
              <th rowSpan={2} className="border border-slate-300 bg-slate-100 text-slate-700 px-3 py-2 text-left font-semibold">
                Sex
              </th>
              <th rowSpan={2} className="border border-slate-300 bg-slate-100 text-slate-700 px-3 py-2 text-left font-semibold">
                <div className="flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5" />
                  Yoqilg'i turi
                </div>
              </th>
              <th colSpan={4} className="period-header border border-accent-300 bg-accent-600 text-white px-3 py-2 text-center font-semibold">
                Davr 1 ({formatDateDisplay(range1.startDate)} - {formatDateDisplay(range1.endDate)})
              </th>
              <th colSpan={4} className="period-header border border-primary-300 bg-primary-600 text-white px-3 py-2 text-center font-semibold">
                Davr 2 ({formatDateDisplay(range2.startDate)} - {formatDateDisplay(range2.endDate)})
              </th>
            </tr>
            {/* Row 2: Column headers per period */}
            <tr>
              {periodColumns.map((col) => (
                <th key={`p1-${col}`} className="border border-accent-300 bg-accent-500 text-white px-3 py-2 text-center font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
              {periodColumns.map((col) => (
                <th key={`p2-${col}`} className="border border-primary-300 bg-primary-500 text-white px-3 py-2 text-center font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-400 border border-slate-200">
                  Yuklanmoqda...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-400 border border-slate-200">
                  Ma'lumot topilmadi
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.department.id}-${row.fuelType.id}`} className="hover:bg-slate-50 transition-colors">
                  <td className="border border-slate-200 px-3 py-2 text-slate-700 whitespace-nowrap">
                    {row.department.name}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-600 whitespace-nowrap">
                    {row.fuelType.name_uz}
                  </td>
                  {/* Period 1 data */}
                  <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatNumber(row.period1.limit)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatNumber(row.period1.norm)}
                  </td>
                  <td className={`border border-slate-200 px-3 py-2 text-right tabular-nums ${row.period1.excess > 0 ? 'text-error-600 font-medium' : 'text-success-600'}`}>
                    {formatNumber(row.period1.excess)}
                  </td>
                  <td className={`border border-slate-200 px-3 py-2 text-right tabular-nums ${row.period1.percentage > 100 ? 'text-error-600 font-medium' : 'text-slate-600'}`}>
                    {formatPercent(row.period1.percentage)}
                  </td>
                  {/* Period 2 data */}
                  <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatNumber(row.period2.limit)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right tabular-nums">
                    {formatNumber(row.period2.norm)}
                  </td>
                  <td className={`border border-slate-200 px-3 py-2 text-right tabular-nums ${row.period2.excess > 0 ? 'text-error-600 font-medium' : 'text-success-600'}`}>
                    {formatNumber(row.period2.excess)}
                  </td>
                  <td className={`border border-slate-200 px-3 py-2 text-right tabular-nums ${row.period2.percentage > 100 ? 'text-error-600 font-medium' : 'text-slate-600'}`}>
                    {formatPercent(row.period2.percentage)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td className="border-2 border-slate-300 px-3 py-2 text-slate-800" colSpan={2}>
                  Jami
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatNumber(totals.p1.limit)}
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatNumber(totals.p1.norm)}
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatNumber(totals.p1.excess)}
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatPercent(totals.p1.percentage)}
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatNumber(totals.p2.limit)}
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatNumber(totals.p2.norm)}
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatNumber(totals.p2.excess)}
                </td>
                <td className="border-2 border-slate-300 px-3 py-2 text-right tabular-nums text-slate-800">
                  {formatPercent(totals.p2.percentage)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
