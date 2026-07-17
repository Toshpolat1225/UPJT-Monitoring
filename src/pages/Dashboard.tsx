import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, StatCard, Card, Table, EmptyState } from '../components/ui';

interface RecentEntry {
  id: string;
  entry_date: string;
  vehicle_name: string;
  department_name: string;
  fuel_type_name: string;
  consumption: number;
}

export default function Dashboard() {
  const { isAdmin, companyId } = useAuth();
  const [stats, setStats] = useState({ departments: 0, vehicles: 0, users: 0, todayEntries: 0 });
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);

        const [deptRes, vehRes, userRes, entryRes] = await Promise.all([
          supabase.from('departments').select('id', { count: 'exact', head: true }).eq('is_total', false),
          supabase.from('vehicles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('daily_entries').select('id', { count: 'exact', head: true }).eq('entry_date', today),
        ]);

        setStats({
          departments: deptRes.count ?? 0,
          vehicles: vehRes.count ?? 0,
          users: userRes.count ?? 0,
          todayEntries: entryRes.count ?? 0,
        });

        const { data: entries } = await supabase
          .from('daily_entries')
          .select(`
            id, entry_date, consumption,
            vehicle:vehicles(name_uz),
            department:departments(name_uz),
            fuel_type:fuel_types(name_uz)
          `)
          .order('created_at', { ascending: false })
          .limit(10);

        const mapped: RecentEntry[] = (entries ?? []).map((e: any) => ({
          id: e.id,
          entry_date: e.entry_date,
          vehicle_name: e.vehicle?.name_uz ?? '-',
          department_name: e.department?.name_uz ?? '-',
          fuel_type_name: e.fuel_type?.name_uz ?? '-',
          consumption: Number(e.consumption) ?? 0,
        }));
        setRecent(mapped);
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, isAdmin]);

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">{t('loading')}</p></div>;

  return (
    <div>
      <PageHeader title={t('dashboard')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('totalDepartments')} value={stats.departments} icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5" color="primary" />
        <StatCard label={t('totalVehicles')} value={stats.vehicles} icon="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9" color="success" />
        <StatCard label={t('totalUsers')} value={stats.users} icon="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6 5.87v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2m12-10a4 4 0 11-8 0 4 4 0 018 0z" color="warning" />
        <StatCard label={t('todayEntries')} value={stats.todayEntries} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" color="primary" />
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-foreground">{t('recentEntries')}</h2>
          {recent.length === 0 ? (
            <EmptyState message={t('noData')} />
          ) : (
            <Table headers={[t('date'), t('department'), t('vehicle'), t('fuelType'), t('consumption')]}>
              {recent.map((e) => (
                <tr key={e.id} className="hover:bg-accent/30">
                  <td className="px-4 py-2.5 text-foreground">{e.entry_date}</td>
                  <td className="px-4 py-2.5 text-foreground">{e.department_name}</td>
                  <td className="px-4 py-2.5 text-foreground">{e.vehicle_name}</td>
                  <td className="px-4 py-2.5 text-foreground">{e.fuel_type_name}</td>
                  <td className="px-4 py-2.5 text-foreground">{e.consumption}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
