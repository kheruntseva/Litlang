import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import Spinner from '../../components/Spinner';

export default function RuleListPage() {
  const { catId } = useParams();
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/categories/${catId}/rules`)
      .then(({ data }) => setRules(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [catId]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="ui-hero p-6 mb-6 ui-fade-in ui-glow-hover">
        <h1 className="ui-page-title text-3xl mb-2">{t('rules.title')}</h1>
        <p className="text-slate-600 text-sm">{t('rules.subtitle')}</p>
      </div>
      <div className="space-y-3">
        {rules.map((rule) => (
          <Link
            key={rule.id}
            to={`/rules/${rule.id}`}
            className="block ui-card ui-card-hover ui-fade-in p-5"
          >
            <h3 className="text-lg font-semibold text-slate-800">{rule.title}</h3>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{rule.summary}</p>
          </Link>
        ))}
      </div>
      {rules.length === 0 && (
        <p className="text-slate-400 text-center py-8">{t('common.noData')}</p>
      )}
    </div>
  );
}
