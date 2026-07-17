import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { uz } from '../lib/i18n'
import {
  IconDashboard, IconReferences, IconReports, IconSettings,
  IconBuilding, IconLayers, IconFuel, IconTruck, IconCalendar,
  IconLimit, IconGrid, IconShield, IconUsers, IconSection,
  IconLogout, IconChevronDown, IconChevronRight, IconMenu, IconClose,
} from './Icons'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
}

type NavGroup = {
  label: string
  icon: ReactNode
  items: NavItem[]
}

export function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refsOpen, setRefsOpen] = useState(true)
  const [reportsOpen, setReportsOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(true)

  const navGroups: NavGroup[] = [
    {
      label: uz.nav.references,
      icon: <IconReferences size={18} />,
      items: [
        { to: '/references/companies', label: uz.nav.companies, icon: <IconBuilding size={16} /> },
        { to: '/references/departments', label: uz.nav.departments, icon: <IconLayers size={16} /> },
        { to: '/references/sections', label: uz.nav.sections, icon: <IconSection size={16} /> },
        { to: '/references/fuel-types', label: uz.nav.fuelTypes, icon: <IconFuel size={16} /> },
        { to: '/references/vehicles', label: uz.nav.vehicles, icon: <IconTruck size={16} /> },
      ],
    },
    {
      label: uz.nav.reports,
      icon: <IconReports size={18} />,
      items: [
        { to: '/reports/daily-entries', label: uz.nav.dailyEntries, icon: <IconCalendar size={16} /> },
        { to: '/reports/monthly-limits', label: uz.nav.monthlyLimits, icon: <IconLimit size={16} /> },
      ],
    },
    {
      label: uz.nav.settings,
      icon: <IconSettings size={18} />,
      items: [
        { to: '/settings/fuel-matrix', label: uz.nav.fuelMatrix, icon: <IconGrid size={16} /> },
        { to: '/settings/role-permissions', label: uz.nav.rolePermissions, icon: <IconShield size={16} /> },
        { to: '/settings/profiles', label: uz.nav.profiles, icon: <IconUsers size={16} /> },
      ],
    },
  ]

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function GroupSection({ group, isOpen, toggle }: { group: NavGroup; isOpen: boolean; toggle: () => void }) {
    return (
      <div className="mb-1">
        <button onClick={toggle} className="sidebar-link w-full justify-between">
          <span className="flex items-center gap-3">
            {group.icon}
            <span>{group.label}</span>
          </span>
          {isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </button>
        {isOpen && (
          <div className="ml-4 mt-0.5 space-y-0.5">
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-white border-r border-slate-200 flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <IconFuel size={22} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">{uz.appName}</div>
            <div className="text-xs text-slate-500">{uz.appShort}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <NavLink
            to="/"
            end
            className={({ isActive }) => isActive ? 'sidebar-link-active mb-2' : 'sidebar-link mb-2'}
            onClick={() => setSidebarOpen(false)}
          >
            <IconDashboard size={18} />
            <span>{uz.nav.dashboard}</span>
          </NavLink>

          {navGroups.map((group, i) => (
            <GroupSection
              key={group.label}
              group={group}
              isOpen={i === 0 ? refsOpen : i === 1 ? reportsOpen : settingsOpen}
              toggle={() => {
                if (i === 0) setRefsOpen(!refsOpen)
                else if (i === 1) setReportsOpen(!reportsOpen)
                else setSettingsOpen(!settingsOpen)
              }}
            />
          ))}
        </nav>

        {/* User info at bottom - NO language switcher */}
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-700">
                {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 truncate">
                {profile?.full_name || profile?.email || 'Foydalanuvchi'}
              </div>
            </div>
            <button onClick={handleSignOut} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" title={uz.auth.logout}>
              <IconLogout size={18} className="text-slate-500" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
            <IconMenu size={22} className="text-slate-600" />
          </button>
          <span className="font-semibold text-slate-700">{uz.appName}</span>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
