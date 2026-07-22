import React, { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import './FuelReport.css'

type PeriodValues = {
  limit: number
  fakt: number
}

type FuelEntry = {
  name: string
  unit: string
  type: 'diesel' | 'petrol' | 'stg'
  p1: PeriodValues
  p2: PeriodValues
}

type Section = {
  code: string
  fuels: FuelEntry[]
}

const SECTIONS: Section[] = [
  {
    code: '2-TYS',
    fuels: [
      { name: 'Dizel yoqilg\'isi', unit: 'l', type: 'diesel', p1: { limit: 5000, fakt: 4200 }, p2: { limit: 7500, fakt: 5100 } },
      { name: 'Benzin', unit: 'l', type: 'petrol', p1: { limit: 1200, fakt: 980 }, p2: { limit: 1800, fakt: 1100 } },
      { name: 'STG', unit: 'm³', type: 'stg', p1: { limit: 3000, fakt: 2600 }, p2: { limit: 4500, fakt: 3100 } },
    ],
  },
  {
    code: '3-TYS',
    fuels: [
      { name: 'Dizel yoqilg\'isi', unit: 'l', type: 'diesel', p1: { limit: 6200, fakt: 5800 }, p2: { limit: 9300, fakt: 6400 } },
      { name: 'Benzin', unit: 'l', type: 'petrol', p1: { limit: 800, fakt: 720 }, p2: { limit: 1200, fakt: 840 } },
      { name: 'STG', unit: 'm³', type: 'stg', p1: { limit: 2500, fakt: 2100 }, p2: { limit: 3750, fakt: 2400 } },
    ],
  },
  {
    code: '4-TYS',
    fuels: [
      { name: 'Dizel yoqilg\'isi', unit: 'l', type: 'diesel', p1: { limit: 4800, fakt: 3900 }, p2: { limit: 7200, fakt: 4600 } },
      { name: 'Benzin', unit: 'l', type: 'petrol', p1: { limit: 600, fakt: 540 }, p2: { limit: 900, fakt: 620 } },
      { name: 'STG', unit: 'm³', type: 'stg', p1: { limit: 2000, fakt: 1700 }, p2: { limit: 3000, fakt: 2000 } },
    ],
  },
  {
    code: 'K/T xizmati',
    fuels: [
      { name: 'Dizel yoqilg\'isi', unit: 'l', type: 'diesel', p1: { limit: 3500, fakt: 3100 }, p2: { limit: 5250, fakt: 3700 } },
      { name: 'Benzin', unit: 'l', type: 'petrol', p1: { limit: 400, fakt: 360 }, p2: { limit: 600, fakt: 410 } },
      { name: 'STG', unit: 'm³', type: 'stg', p1: { limit: 1500, fakt: 1300 }, p2: { limit: 2250, fakt: 1550 } },
    ],
  },
  {
    code: 'SMB va AX',
    fuels: [
      { name: 'Dizel yoqilg\'isi', unit: 'l', type: 'diesel', p1: { limit: 2200, fakt: 1800 }, p2: { limit: 3300, fakt: 2100 } },
      { name: 'Benzin', unit: 'l', type: 'petrol', p1: { limit: 300, fakt: 280 }, p2: { limit: 450, fakt: 320 } },
      { name: 'STG', unit: 'm³', type: 'stg', p1: { limit: 800, fakt: 700 }, p2: { limit: 1200, fakt: 820 } },
    ],
  },
  {
    code: 'EX',
    fuels: [
      { name: 'Dizel yoqilg\'isi', unit: 'l', type: 'diesel', p1: { limit: 1800, fakt: 1500 }, p2: { limit: 2700, fakt: 1700 } },
      { name: 'Benzin', unit: 'l', type: 'petrol', p1: { limit: 200, fakt: 180 }, p2: { limit: 300, fakt: 210 } },
      { name: 'STG', unit: 'm³', type: 'stg', p1: { limit: 600, fakt: 500 }, p2: { limit: 900, fakt: 600 } },
    ],
  },
  {
    code: 'KTUX',
    fuels: [
      { name: 'Dizel yoqilg\'isi', unit: 'l', type: 'diesel', p1: { limit: 1500, fakt: 1300 }, p2: { limit: 2250, fakt: 1500 } },
      { name: 'Benzin', unit: 'l', type: 'petrol', p1: { limit: 150, fakt: 130 }, p2: { limit: 225, fakt: 150 } },
      { name: 'STG', unit: 'm³', type: 'stg', p1: { limit: 400, fakt: 350 }, p2: { limit: 600, fakt: 420 } },
    ],
  },
]

const PERIOD1 = { from: '01.07.2026', to: '21.07.2026' }
const PERIOD2 = { from: '01.07.2026', to: '31.07.2026' }

function fmt(n: number): string {
  return n.toLocaleString('ru-RU')
}

function oghish(limit: number, fakt: number): number {
  return limit - fakt
}

function foiz(limit: number, fakt: number): string {
  if (limit === 0) return '0%'
  return `${Math.round((fakt / limit) * 100)}%`
}

type Totals = {
  diesel: PeriodValues
  petrol: PeriodValues
  stg: PeriodValues
}

function computeTotals(sections: Section[]): Totals {
  const t: Totals = {
    diesel: { limit: 0, fakt: 0 },
    petrol: { limit: 0, fakt: 0 },
    stg: { limit: 0, fakt: 0 },
  }
  for (const s of sections) {
    for (const f of s.fuels) {
      t[f.type].limit += f.p1.limit + f.p2.limit
      t[f.type].fakt += f.p1.fakt + f.p2.fakt
    }
  }
  return t
}

function fuelColor(type: string): string {
  if (type === 'diesel') return '#2563eb'
  if (type === 'petrol') return '#ea580c'
  return '#16a34a'
}

export default function FuelReport() {
  const [p1From, setP1From] = useState(PERIOD1.from)
  const [p1To, setP1To] = useState(PERIOD1.to)
  const [p2From, setP2From] = useState(PERIOD2.from)
  const [p2To, setP2To] = useState(PERIOD2.to)

  const totals = useMemo(() => computeTotals(SECTIONS), [])

  const printedAt = useMemo(() => {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`
  }, [])

  const renderRow = (f: FuelEntry, sectionCode: string) => {
    const color = fuelColor(f.type)
    return (
      <tr key={`${sectionCode}-${f.type}`}>
        <td className="fuel-name" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '14px' }}>
          {f.name} ({f.unit})
        </td>
        <td className="num">{fmt(f.p1.limit)}</td>
        <td className="num">{fmt(f.p1.fakt)}</td>
        <td className="num">{fmt(oghish(f.p1.limit, f.p1.fakt))}</td>
        <td className="num">{foiz(f.p1.limit, f.p1.fakt)}</td>
        <td className="num">{fmt(f.p2.limit)}</td>
        <td className="num">{fmt(f.p2.fakt)}</td>
        <td className="num">{fmt(oghish(f.p2.limit, f.p2.fakt))}</td>
        <td className="num">{foiz(f.p2.limit, f.p2.fakt)}</td>
      </tr>
    )
  }

  const totalRow = (label: string, unit: string, type: 'diesel' | 'petrol' | 'stg') => {
    const t = totals[type]
    const p1limit = Math.round(t.limit / 2)
    const p1fakt = Math.round(t.fakt / 2)
    const p2limit = t.limit - p1limit
    const p2fakt = t.fakt - p1fakt
    const color = fuelColor(type)
    return (
      <tr className="total-row">
        <td className="fuel-name" style={{ borderLeft: `4px solid ${color}`, paddingLeft: '14px' }}>
          {label} ({unit})
        </td>
        <td className="num">{fmt(p1limit)}</td>
        <td className="num">{fmt(p1fakt)}</td>
        <td className="num">{fmt(oghish(p1limit, p1fakt))}</td>
        <td className="num">{foiz(p1limit, p1fakt)}</td>
        <td className="num">{fmt(p2limit)}</td>
        <td className="num">{fmt(p2fakt)}</td>
        <td className="num">{fmt(oghish(p2limit, p2fakt))}</td>
        <td className="num">{foiz(p2limit, p2fakt)}</td>
      </tr>
    )
  }

  return (
    <div className="report-page">
      <div className="toolbar no-print">
        <h1 className="toolbar-title">Yoqilg'i monitoring tizimi</h1>
        <button className="print-btn" onClick={() => window.print()}>
          <Printer size={18} />
          <span>Print</span>
        </button>
      </div>

      <div className="report-sheet">
        <header className="report-header">
          <div className="header-left">
            <h2 className="report-title">Yoqilg'i monitoring tizimi / Sex / Yoqilg'i turi hisoboti</h2>
            <p className="timestamp">Chop etilgan: {printedAt}</p>
          </div>
          <div className="header-right">
            <div className="period-box">
              <span className="period-label">Davr</span>
              <div className="period-fields">
                <label>Sana dan: <input type="text" value={p1From} onChange={e => setP1From(e.target.value)} /></label>
                <label>Sana gacha: <input type="text" value={p1To} onChange={e => setP1To(e.target.value)} /></label>
              </div>
            </div>
            <div className="period-box">
              <span className="period-label">Davr</span>
              <div className="period-fields">
                <label>Sana dan: <input type="text" value={p2From} onChange={e => setP2From(e.target.value)} /></label>
                <label>Sana gacha: <input type="text" value={p2To} onChange={e => setP2To(e.target.value)} /></label>
              </div>
            </div>
          </div>
        </header>

        <table className="fuel-table">
          <thead>
            <tr className="header-row-1">
              <th rowSpan={2} className="col-section">Sex / Yoqilg'i turi</th>
              <th colSpan={4} className="period-header p1">Davr (Sana dan: {p1From}, Sana gacha: {p1To})</th>
              <th colSpan={4} className="period-header p2">Davr (Sana dan: {p2From}, Sana gacha: {p2To})</th>
            </tr>
            <tr className="header-row-2">
              <th>Davr limiti</th>
              <th>Davr fakti</th>
              <th>Davr og'ishi</th>
              <th>Davr foizi</th>
              <th>Davr limiti</th>
              <th>Davr fakti</th>
              <th>Davr og'ishi</th>
              <th>Davr foizi</th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(sec => (
              <React.Fragment key={sec.code}>
                <tr className="section-header">
                  <td colSpan={9}>{sec.code}</td>
                </tr>
                {sec.fuels.map(f => renderRow(f, sec.code))}
              </React.Fragment>
            ))}
            <tr className="jami-header">
              <td colSpan={9}>Jami (Umumiy hisobot)</td>
            </tr>
            {totalRow('Dizel yoqilg\'isi (Jami)', 'l', 'diesel')}
            {totalRow('Benzin (Jami)', 'l', 'petrol')}
            {totalRow('STG (Jami)', 'm³', 'stg')}
          </tbody>
        </table>
      </div>
    </div>
  )
}
