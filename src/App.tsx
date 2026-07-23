import { useMemo, useState } from 'react'
import { fuelRecords, type FuelRecord } from './data'

const statusBadge = (s: FuelRecord['status']) => {
  if (s === 'Berilgan') return 'badge badge-success'
  if (s === 'Kutilmoqda') return 'badge badge-warning'
  return 'badge badge-danger'
}

const fmtMoney = (n: number) => n.toLocaleString('ru-RU')

export default function App() {
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return fuelRecords
    return fuelRecords.filter((r) =>
      [r.sex, r.fuelType, r.carNumber, r.driver, r.date, r.station, r.status]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [query])

  const totalVolume = rows.reduce((s, r) => s + r.volume, 0)
  const totalCost = rows.reduce((s, r) => s + r.cost, 0)
  const givenCount = rows.filter((r) => r.status === 'Berilgan').length

  const handlePrint = () => window.print()

  return (
    <div className="app">
      <div className="page-header no-print">
        <div className="page-title">
          <h1>Yoqilg'i monitoring tizimi</h1>
          <p>Sex / Yoqilg'i turi bo'yicha yoqilg'i berilishi hisoboti</p>
        </div>
        <div className="toolbar">
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Qidirish: sex, yoqilg'i, davr, haydovchi..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-print" onClick={handlePrint}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Chop etish
          </button>
        </div>
      </div>

      <div className="card">
        <div className="print-only print-header">
          <h2>YOQILG'I BERILISHI HISOBOTI</h2>
          <p>Sex / Yoqilg'i turi bo'yicha — {new Date().toLocaleDateString('ru-RU')}</p>
        </div>

        <div className="summary">
          <div className="summary-item">
            <span className="label">Jami yozuvlar</span>
            <span className="value">{rows.length} <span>ta</span></span>
          </div>
          <div className="summary-item">
            <span className="label">Umumiy hajm</span>
            <span className="value">{totalVolume} <span>litr</span></span>
          </div>
          <div className="summary-item">
            <span className="label">Umumiy summa</span>
            <span className="value">{fmtMoney(totalCost)} <span>UZS</span></span>
          </div>
          <div className="summary-item">
            <span className="label">Berilgan</span>
            <span className="value" style={{ color: 'var(--success)' }}>{givenCount} <span>ta</span></span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Sex</th>
                <th>Yoqilg'i turi</th>
                <th>Mashina raqami</th>
                <th>Haydovchi</th>
                <th>Sana</th>
                <th className="num">Hajm</th>
                <th className="num">Summa (UZS)</th>
                <th>Shahobcha</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.sex}</td>
                  <td>{r.fuelType}</td>
                  <td>{r.carNumber}</td>
                  <td>{r.driver}</td>
                  <td>{r.date}</td>
                  <td className="num">{r.volume} {r.unit}</td>
                  <td className="num">{fmtMoney(r.cost)}</td>
                  <td>{r.station}</td>
                  <td><span className={statusBadge(r.status)}>{r.status}</span></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    Hech narsa topilmadi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="print-only">
          <div className="print-footer">
            <span>Hisobot tuzilgan sana: {new Date().toLocaleDateString('ru-RU')}</span>
            <span>Imzo: ____________________</span>
          </div>
          <div className="sign-row">
            <div className="sign">
              <div className="line">Tuzuvchi</div>
              <div>____________________</div>
            </div>
            <div className="sign">
              <div className="line">Tasdiqladi</div>
              <div>____________________</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
