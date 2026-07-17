import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyEntries from './pages/DailyEntries';
import MonthlyLimits from './pages/MonthlyLimits';
import Departments from './pages/Departments';
import Sections from './pages/Sections';
import FuelTypes from './pages/FuelTypes';
import Vehicles from './pages/Vehicles';
import Companies from './pages/Companies';
import UsersPage from './pages/UsersPage';
import AuditLog from './pages/AuditLog';
import RolePermissions from './pages/RolePermissions';

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Yuklanmoqda...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="daily-entries" element={<DailyEntries />} />
        <Route path="monthly-limits" element={<MonthlyLimits />} />
        <Route path="departments" element={<Departments />} />
        <Route path="sections" element={<Sections />} />
        <Route path="fuel-types" element={<FuelTypes />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="companies" element={<Companies />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="role-permissions" element={<RolePermissions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Yuklanmoqda...</p></div>;
  if (!user) return <Routes><Route path="/login" element={<Login />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  return <ProtectedRoutes />;
}
