import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import { useAuth } from '../auth/AuthContext';
import Spinner from '../../components/Spinner';

function HighlightedPassage({ passage, highlight }) {
  if (!highlight) return <p className="text-slate-800 leading-relaxed">{passage}</p>;

  const idx = passage.indexOf(highlight);
  if (idx === -1) return <p className="text-slate-800 leading-relaxed">{passage}</p>;

  return (
    <p className="text-slate-800 leading-relaxed">
      {passage.substring(0, idx)}
      <mark className="bg-accent-200 text-accent-900 font-semibold not-italic px-0.5 rounded">
        {highlight}
      </mark>
      {passage.substring(idx + highlight.length)}
    </p>
  );
}

export default function RuleDetailPage() {
  const { ruleId } = useParams();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [rule, setRule] = useState(null);
  const [excerpts, setExcerpts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [favouriteExcerptIds, setFavouriteExcerptIds] = useState(new Set());
  const [ruleFavouriteId, setRuleFavouriteId] = useState(null);

  useEffect(() => {
    const requests = [
      api.get(`/rules/${ruleId}`),
      api.get(`/rules/${ruleId}/excerpts`),
    ];
    if (isAuthenticated) {
      requests.push(api.get('/me/progress', { params: { ruleId } }));
      requests.push(api.get('/me/favourites', { params: { target_type: 'excerpt' } }));
      requests.push(api.get('/me/favourites', { params: { target_type: 'rule' } }));
    }
    Promise.all(requests)
      .then(([ruleRes, excerptsRes, progressRes, favouriteRes, ruleFavouriteRes]) => {
        setRule(ruleRes.data.data);
        setExcerpts(excerptsRes.data.data ?? []);
        if (progressRes) {
          const entries = progressRes.data?.data ?? [];
          const entry = entries.find((p) => String(p.rule_id) === String(ruleId));
          setStatus(entry?.status ?? 'not_started');
        }
        if (favouriteRes) {
          const favouriteIds = (favouriteRes.data?.data ?? []).map((f) => String(f.target_id));
          setFavouriteExcerptIds(new Set(favouriteIds));
        }
        if (ruleFavouriteRes) {
          const fav = (ruleFavouriteRes.data?.data ?? []).find((f) => String(f.target_id) === String(ruleId));
          setRuleFavouriteId(fav?.id ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ruleId, isAuthenticated]);

  const updateStatus = async (newStatus) => {
    try {
      await api.put(`/me/progress/${ruleId}`, { status: newStatus });
      setStatus(newStatus);
    } catch {
      // ignore
    }
  };

  const toggleExcerptFavourite = async (excerptId) => {
    const idKey = String(excerptId);
    const isFavourite = favouriteExcerptIds.has(idKey);
    try {
      if (isFavourite) {
        const { data } = await api.get('/me/favourites', { params: { target_type: 'excerpt' } });
        const fav = (data?.data ?? []).find((f) => String(f.target_id) === idKey);
        if (fav) {
          await api.delete(`/me/favourites/${fav.id}`);
        }
      } else {
        await api.post('/me/favourites', { target_type: 'excerpt', target_id: Number(excerptId) });
      }
      setFavouriteExcerptIds((prev) => {
        const next = new Set(prev);
        if (isFavourite) next.delete(idKey);
        else next.add(idKey);
        return next;
      });
    } catch {
      // ignore
    }
  };

  const toggleRuleFavourite = async () => {
    try {
      if (ruleFavouriteId) {
        await api.delete(`/me/favourites/${ruleFavouriteId}`);
        setRuleFavouriteId(null);
      } else {
        const { data } = await api.post('/me/favourites', { target_type: 'rule', target_id: Number(ruleId) });
        setRuleFavouriteId(data?.data?.id ?? null);
      }
    } catch {
      // ignore
    }
  };

  if (loading) return <Spinner />;
  if (!rule) return <p className="text-center text-gray-500">{t('common.error')}</p>;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Rule header */}
      <div className="ui-hero p-6 mb-8 ui-fade-in ui-glow-hover">
        <h1 className="ui-page-title text-3xl mb-4">{rule.title}</h1>

        {isAuthenticated && (
          <div className="mb-4 flex items-center gap-2">
            <select
              value={status || 'not_started'}
              onChange={(e) => updateStatus(e.target.value)}
              className="ui-input !w-auto !py-1.5 text-sm"
            >
              <option value="not_started">{t('progress.notStarted')}</option>
              <option value="in_progress">{t('progress.inProgress')}</option>
              <option value="completed">{t('progress.completed')}</option>
            </select>
            <button
              onClick={toggleRuleFavourite}
              className={`text-xs px-2 py-1 rounded ${
                ruleFavouriteId ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-primary-100 text-primary-700 border border-primary-200'
              }`}
            >
              {ruleFavouriteId ? t('favourites.removeFromFavourites') : t('favourites.addToFavourites')}
            </button>
          </div>
        )}

        <div className="bg-white/85 border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-primary-700 mb-2">{t('rules.summary')}</h2>
          <p className="text-slate-700 leading-relaxed">{rule.summary}</p>
        </div>
      </div>

      {/* Excerpts */}
      <h2 className="text-xl font-semibold text-slate-800 mb-4">{t('rules.excerpts')}</h2>
      {excerpts.length === 0 ? (
        <p className="text-slate-500">{t('rules.noExcerpts')}</p>
      ) : (
        <div className="space-y-4">
          {excerpts.map((excerpt) => (
            <div key={excerpt.id} className="ui-card ui-fade-in p-5">
              <div className="mb-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{t('excerpts.passage')}</p>
                <div className="ui-excerpt-box">
                  <HighlightedPassage passage={excerpt.passage} highlight={excerpt.highlight} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                  <span className="text-slate-500 mr-1">{t('excerpts.book')}:</span>
                  <span className="text-slate-800">{excerpt.book_title}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                  <span className="text-slate-500 mr-1">{t('excerpts.author')}:</span>
                  <span className="text-slate-800">{excerpt.book_author}</span>
                </div>
                {excerpt.chapter && (
                  <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                    <span className="text-slate-500 mr-1">{t('excerpts.chapter')}:</span>
                    <span className="text-slate-800">{excerpt.chapter}</span>
                  </div>
                )}
                {excerpt.page_number && (
                  <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                    <span className="text-slate-500 mr-1">{t('excerpts.page')}:</span>
                    <span className="text-slate-800">{excerpt.page_number}</span>
                  </div>
                )}
              </div>
              {excerpt.context_note && (
                <div className="mt-3 bg-accent-50 border border-accent-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-accent-700 uppercase tracking-wide mb-1">
                    {t('rules.explanation')}
                  </p>
                  <p className="text-sm text-slate-800 leading-relaxed">{excerpt.context_note}</p>
                </div>
              )}
              {isAuthenticated && (
                <div className="mt-3">
                  <button
                    onClick={() => toggleExcerptFavourite(excerpt.id)}
                    className={`text-xs px-2 py-1 rounded ${
                      favouriteExcerptIds.has(String(excerpt.id))
                        ? 'bg-red-100 text-red-700'
                        : 'bg-primary-100 text-primary-700'
                    }`}
                  >
                    {favouriteExcerptIds.has(String(excerpt.id))
                      ? t('favourites.removeFromFavourites')
                      : t('favourites.addToFavourites')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
