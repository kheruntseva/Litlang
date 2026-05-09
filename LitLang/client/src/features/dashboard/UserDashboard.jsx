import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import Spinner from '../../components/Spinner';

export default function UserDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/me/stats'),
      api.get('/me/progress'),
    ])
      .then(([statsRes, progressRes]) => {
        setStats(statsRes.data.data);
        setProgress(progressRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = useMemo(() => {
    const m = {};
    stats?.statusCounts?.forEach((s) => {
      m[s.status] = parseInt(s.count, 10);
    });
    // Fallback: derive from /me/progress if stats endpoint returned incomplete payload.
    if (!m.completed && !m.in_progress && !m.not_started && progress.length > 0) {
      progress.forEach((p) => {
        const key = p.status || 'not_started';
        m[key] = (m[key] || 0) + 1;
      });
    }
    return m;
  }, [stats, progress]);

  const categoryProgress = stats?.categoryProgress || [];
  const overallPercent = Number(stats?.overallPercent) || 0;

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">{t('progress.stats')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="ui-card p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{statusCounts.completed || 0}</p>
          <p className="text-sm text-slate-500">{t('progress.completed')}</p>
        </div>
        <div className="ui-card p-5 text-center">
          <p className="text-3xl font-bold text-amber-600">{statusCounts.in_progress || 0}</p>
          <p className="text-sm text-slate-500">{t('progress.inProgress')}</p>
        </div>
        <div className="ui-card p-5 text-center">
          <p className="text-3xl font-bold text-slate-400">{statusCounts.not_started || 0}</p>
          <p className="text-sm text-slate-500">{t('progress.notStarted')}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-slate-800 mb-2">{t('progress.title')}</h2>
      <p className="text-sm text-slate-500 mb-6">{t('progress.byCategoryHint')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="ui-card p-6 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-slate-700 mb-3">{t('progress.overall')}</p>
          <div className="relative w-40 h-40 shrink-0">
            <div
              className="absolute inset-0 rounded-full shadow-inner"
              style={{
                background: `conic-gradient(rgb(122 49 62) 0% ${overallPercent}%, rgb(226 232 240) ${overallPercent}% 100%)`,
              }}
              aria-hidden
            />
            <div className="absolute inset-[14px] rounded-full bg-white flex flex-col items-center justify-center border border-slate-100">
              <span className="text-3xl font-bold text-slate-800">{overallPercent}%</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide mt-1 text-center px-2">
                {t('progress.overallHint')}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 ui-card p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">{t('progress.byCategory')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('progress.byCategoryHint')}</p>
          {categoryProgress.length === 0 ? (
            <p className="text-slate-500 text-sm">{t('common.noData')}</p>
          ) : (
            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {categoryProgress.map((row) => {
                const total = Number(row.total) || 0;
                const completed = Number(row.completed) || 0;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div key={row.category_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-800 font-medium">{row.category_title}</span>
                      <span className="text-slate-500">
                        {pct}% <span className="text-slate-400">({completed}/{total})</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-600 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-1">{t('progress.recentActivity')}</h3>
      <p className="text-xs text-slate-500 mb-3">{t('progress.recentActivityHint')}</p>
      {progress.length === 0 ? (
        <p className="text-slate-500">{t('common.noData')}</p>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {progress.slice(0, 8).map((p) => (
            <Link
              key={p.id}
              to={`/rules/${p.rule_id}`}
              className="flex items-center justify-between p-3 ui-card ui-card-hover rounded-lg"
            >
              <span className="text-sm text-slate-800 truncate pr-2">
                {p.rule_title || p.rule_slug}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                  p.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : p.status === 'in_progress'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {t(
                  `progress.${
                    p.status === 'not_started'
                      ? 'notStarted'
                      : p.status === 'in_progress'
                        ? 'inProgress'
                        : 'completed'
                  }`
                )}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link to="/catalog" className="text-primary-700 hover:text-accent-700 text-sm font-medium mr-4">
          {t('catalog.title')} &rarr;
        </Link>
        <Link to="/favourites" className="text-primary-700 hover:text-accent-700 text-sm font-medium">
          {t('favourites.title')} &rarr;
        </Link>
      </div>
    </div>
  );
}
