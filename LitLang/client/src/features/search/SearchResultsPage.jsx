import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import { useDebounce } from '../../hooks/useDebounce';
import Spinner from '../../components/Spinner';

export default function SearchResultsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setSearchParams({ q: debouncedQuery });
    api.get('/search', { params: { q: debouncedQuery } })
      .then(({ data }) => setResults(data.data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, setSearchParams]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="ui-hero p-6 mb-6 ui-fade-in ui-glow-hover">
        <h1 className="ui-page-title text-3xl mb-2">{t('search.title')}</h1>
        <p className="text-slate-600 text-sm">{t('search.placeholder')}</p>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('search.placeholder')}
        className="ui-input text-lg mb-6"
      />

      {loading ? (
        <Spinner />
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((r) => (
            <Link
              key={r.id}
              to={`/rules/${r.rule_id}`}
              className="block ui-card ui-card-hover p-4"
            >
              <div className="ui-excerpt-box">
                <p className="text-slate-800 line-clamp-3">{r.passage}</p>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                {r.book_title} &mdash; {r.book_author}
              </p>
            </Link>
          ))}
        </div>
      ) : debouncedQuery.trim() ? (
        <p className="text-gray-500 text-center">{t('search.noResults')}</p>
      ) : null}
    </div>
  );
}
