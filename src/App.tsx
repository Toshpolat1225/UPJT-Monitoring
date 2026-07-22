import { useState } from 'react'
import { Fuel, LayoutDashboard, BarChart3, Settings, FileText, Bell } from 'lucide-react'
import SexFuelTable from './components/SexFuelTable'

function App() {
  const [activeNav, setActiveNav] = useState('reports')

  const navItems = [
    { id: 'dashboard', label: 'Boshqaruv paneli', icon: LayoutDashboard },
    { id: 'reports', label: 'Hisobotlar', icon: FileText },
    { id: 'analytics', label: 'Tahlil', icon: BarChart3 },
    { id: 'settings', label: 'Sozlamalar', icon: Settings },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <aside className="no-print w-64 bg-slate-800 flex flex-col flex-shrink-0">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
          <Fuel className="w-7 h-7 text-primary-400" />
          <div>
            <h1 className="text-white text-sm font-bold">AGMK UPJT</h1>
            <p className="text-slate-400 text-xs">Fuel Monitoring</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = activeNav === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t border-slate-700">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <Bell className="w-5 h-5" />
            Bildirishnomalar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Top header */}
        <header className="no-print bg-white border-b border-slate-200 px-6 py-3">
          <h2 className="text-lg font-semibold text-slate-800">Hisobotlar</h2>
        </header>

        {/* Content area */}
        <div className="p-6">
          <SexFuelTable />
        </div>
      </main>
    </div>
  )
}

export default App
