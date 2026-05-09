import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import Spinner from '../../components/Spinner';

export default function HomePage() {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/languages')
      .then(({ data }) => setLanguages(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="ui-hero p-8 md:p-12 text-center mb-10 ui-fade-in ui-glow-hover">
        <div className="mb-6 overflow-hidden rounded-xl border border-primary-200">
          <img
            src="https://i.pinimg.com/1200x/0c/69/06/0c6906e4a2b62dd70ca0266cb79db42e.jpg"
            alt="Calm library aesthetic"
            className="w-full h-56 md:h-72 object-cover"
          />
        </div>
        <h1 className="ui-page-title text-4xl md:text-5xl mb-4">
          {t('home.hero')}
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
          {t('home.description')}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 border border-amber-300/30 text-sm text-amber-700 font-medium">
          {t('home.languagesAvailable')}: {languages.length || '...'}
        </div>
      </div>

      {/* Language selection */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-slate-800 mb-6 text-center">
          {t('languages.title')}
        </h2>
        {loading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {languages.map((lang) => (
              <Link
                key={lang.id}
                to={`/languages/${lang.id}`}
                className="ui-card ui-card-hover ui-fade-in p-6 text-center"
              >
                <h3 className="text-xl font-semibold text-slate-800">{lang.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{lang.code.toUpperCase()}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
