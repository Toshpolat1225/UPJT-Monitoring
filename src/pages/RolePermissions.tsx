import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase, type RolePermission, type AppRole } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Table, EmptyState, Badge } from '../components/ui';

const ROLES: AppRole[] = ['admin', 'gsm', 'operator', 'master', 'management'];
const MODULES = ['entries', 'limits', 'master_data', 'users', 'audit'];
const PERMISSIONS = ['view', 'create', 'edit', 'delete'];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin', gsm: 'GSM', operator: 'Operator', master: 'Master', management: 'Boshqaruv',
};

export default function RolePermissions() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('role_permissions').select('*').order('role, module, permission');
    if (error) toast.error(error.message);
    setRows((data as RolePermission[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (rp: RolePermission) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('role_permissions')
      .update({ allowed: !rp.allowed })
      .eq('id', rp.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const getPerm = (role: AppRole, module: string, perm: string) =>
    rows.find((r) => r.role === role && r.module === module && r.permission === perm);

  return (
    <div>
      <PageHeader title={t('rolePermissions')} />
      <Card>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        rows.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('module'), t('permission'), ...ROLES.map((r) => ROLE_LABELS[r])]}>
            {MODULES.map((mod) =>
              PERMISSIONS.map((perm) => (
                <tr key={`${mod}-${perm}`} className="hover:bg-accent/30">
                  <td className="px-4 py-2.5 font-medium text-foreground">{mod}</td>
                  <td className="px-4 py-2.5 text-foreground">{perm}</td>
                  {ROLES.map((role) => {
                    const rp = getPerm(role, mod, perm);
                    if (!rp) return <td key={role} className="px-4 py-2.5 text-muted-foreground">-</td>;
                    return (
                      <td key={role} className="px-4 py-2.5">
                        {isAdmin ? (
                          <button onClick={() => toggle(rp)} className="cursor-pointer">
                            <Badge variant={rp.allowed ? 'success' : 'default'}>
                              {rp.allowed ? t('yes') : t('no')}
                            </Badge>
                          </button>
                        ) : (
                          <Badge variant={rp.allowed ? 'success' : 'default'}>
                            {rp.allowed ? t('yes') : t('no')}
                          </Badge>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </Table>
        )}
      </Card>
    </div>
  );
}
