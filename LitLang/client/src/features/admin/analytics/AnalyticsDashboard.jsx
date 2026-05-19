import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import Spinner from '../../../components/Spinner';

export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  const { get, loading } = useApi();
  const [data, setData] = useState(null);
  const statusLabelKeyByValue = {
    not_started: 'progress.notStarted',
    in_progress: 'progress.inProgress',
    completed: 'progress.completed',
  };

  useEffect(() => {
    get('/admin/analytics').then((res) => setData(res.data ?? res)).catch(() => {});
  }, [get]);

  if (loading || !data) return <Spinner size="lg" />;

  const maxStatusCount = Math.max(
    0,
    ...(data.userProgressByStatus || []).map((s) => s.count || 0)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.dashboard')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('admin.users')} value={data.totalUsers ?? 0} />
        <StatCard label={t('admin.languages')} value={data.totalLanguages ?? 0} />
        <StatCard label={t('admin.rules')} value={data.totalRules ?? 0} />
        <StatCard label={t('admin.excerpts')} value={data.totalExcerpts ?? 0} />
      </div>

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">{t('admin.popularLanguages')}</h2>
        <p className="text-xs text-gray-500 mb-4">{t('admin.popularLanguagesHint')}</p>
        {(data.popularLanguages || []).length === 0 ? (
          <p className="text-sm text-gray-500">{t('common.noData')}</p>
        ) : (
          <ul className="space-y-2">
            {data.popularLanguages.map((lang) => (
              <li key={lang.id} className="flex justify-between text-sm items-center">
                <span className="font-medium text-gray-800">{lang.name}</span>
                <span className="text-gray-600">
                  {lang.count}{' '}
                  <span className="text-gray-400 text-xs">
                    ({lang.metric === 'activity' ? t('admin.progressRows') : t('admin.rulesLabel')})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">{t('admin.completionByCategory')}</h2>
        <p className="text-xs text-gray-500 mb-4">{t('admin.completionByCategoryHint')}</p>
        {(data.completionByCategory || []).length === 0 ? (
          <p className="text-sm text-gray-500">{t('admin.noProgressYet')}</p>
        ) : (
          <div className="space-y-3">
            {data.completionByCategory.map((item) => {
              const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
              return (
                <div key={item.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-800">{item.category}</span>
                    <span className="text-gray-600">
                      {pct}% <span className="text-gray-400">({item.completed}/{item.total})</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">{t('admin.progressAcrossUsers')}</h2>
        <p className="text-xs text-gray-500 mb-4">{t('admin.progressAcrossUsersHint')}</p>
        {(data.userProgressByStatus || []).length === 0 ? (
          <p className="text-sm text-gray-500">{t('common.noData')}</p>
        ) : (
          <div className="space-y-2">
            {data.userProgressByStatus.map((row) => (
              <div key={row.status} className="flex items-center gap-3">
                <span className="text-xs w-28 shrink-0 text-gray-600">
                  {t(statusLabelKeyByValue[row.status] || 'common.noData')}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-600 rounded-full"
                    style={{ width: maxStatusCount ? `${(row.count / maxStatusCount) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs w-8 text-right text-gray-700">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">{t('admin.recentRegistrations')}</h2>
        <p className="text-2xl font-bold text-primary-700">{data.recentRegistrations ?? 0}</p>
        <p className="text-xs text-gray-500 mt-1">{t('admin.recentRegistrationsHint')}</p>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-primary-700 mt-1">{value}</p>
    </div>
  );
}
