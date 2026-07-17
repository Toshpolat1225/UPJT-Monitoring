import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CompaniesPage } from './pages/references/CompaniesPage'
import { DepartmentsPage } from './pages/references/DepartmentsPage'
import { SectionsPage } from './pages/references/SectionsPage'
import { FuelTypesPage } from './pages/references/FuelTypesPage'
import { VehiclesPage } from './pages/references/VehiclesPage'
import { DailyEntriesPage } from './pages/reports/DailyEntriesPage'
import { MonthlyLimitsPage } from './pages/reports/MonthlyLimitsPage'
import { FuelMatrixPage } from './pages/settings/FuelMatrixPage'
import { RolePermissionsPage } from './pages/settings/RolePermissionsPage'
import { ProfilesPage } from './pages/settings/ProfilesPage'
import { LoadingSpinner } from './components/UI'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/references/companies" element={<CompaniesPage />} />
        <Route path="/references/departments" element={<DepartmentsPage />} />
        <Route path="/references/sections" element={<SectionsPage />} />
        <Route path="/references/fuel-types" element={<FuelTypesPage />} />
        <Route path="/references/vehicles" element={<VehiclesPage />} />
        <Route path="/reports/daily-entries" element={<DailyEntriesPage />} />
        <Route path="/reports/monthly-limits" element={<MonthlyLimitsPage />} />
        <Route path="/settings/fuel-matrix" element={<FuelMatrixPage />} />
        <Route path="/settings/role-permissions" element={<RolePermissionsPage />} />
        <Route path="/settings/profiles" element={<ProfilesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
