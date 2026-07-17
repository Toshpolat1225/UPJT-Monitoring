import { useEffect, useState, useCallback } from 'react';
import { supabase, type AuditLog } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { PageHeader, Card, Input, Table, EmptyState, Badge } from '../components/ui';

export default function AuditLogPage() {
  const { hasAny } = useAuth();
  const [rows, setRows] = useState<(AuditLog & { user_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_log')
      .select('*, profile:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) console.error(error.message);
    const mapped = (data as any ?? []).map((r: any) => ({
      ...r,
      user_name: r.profile?.full_name ?? '-',
    }));
    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    const s = search.toLowerCase();
    const matchSearch = !s || r.table_name?.toLowerCase().includes(s) || r.user_name?.toLowerCase().includes(s);
    const matchAction = !filterAction || r.action === filterAction;
    return matchSearch && matchAction;
  });

  return (
    <div>
      <PageHeader title={t('auditLog')} />
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><Input label="" value={search} onChange={setSearch} placeholder={t('search')} /></div>
          <div className="sm:w-40">
            <Input label="" value={filterAction} onChange={setFilterAction} placeholder={t('action')} />
          </div>
        </div>
        {loading ? <p className="py-8 text-center text-muted-foreground">{t('loading')}</p> :
        filtered.length === 0 ? <EmptyState message={t('noData')} /> : (
          <Table headers={[t('timestamp'), t('user'), t('action'), t('tableName'), t('details')]}>
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-4 py-2.5 whitespace-nowrap text-foreground">{new Date(r.created_at).toLocaleString('uz-UZ')}</td>
                <td className="px-4 py-2.5 text-foreground">{r.user_name}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={r.action === 'DELETE' ? 'destructive' : r.action === 'INSERT' ? 'success' : 'warning'}>
                    {r.action}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 font-mono text-foreground">{r.table_name}</td>
                <td className="px-4 py-2.5 max-w-xs truncate text-muted-foreground">
                  {r.details ? JSON.stringify(r.details).slice(0, 100) : '-'}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
