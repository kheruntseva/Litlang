import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import Spinner from '../../components/Spinner';

export default function CategoryListPage() {
  const { langId } = useParams();
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/languages/${langId}/categories`)
      .then(({ data }) => setCategories(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [langId]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="ui-hero p-6 mb-6 ui-fade-in ui-glow-hover">
        <h1 className="ui-page-title text-3xl mb-2">{t('categories.title')}</h1>
        <p className="text-slate-600 text-sm">{t('categories.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/categories/${cat.id}/rules`}
            className="ui-card ui-card-hover ui-fade-in p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800">{cat.title}</h3>
          </Link>
        ))}
      </div>
      {categories.length === 0 && (
        <p className="text-slate-400 text-center py-8">{t('common.noData')}</p>
      )}
    </div>
  );
}
