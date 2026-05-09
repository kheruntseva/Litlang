import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import Spinner from '../../components/Spinner';

async function browserGutendexSearch(query) {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gutendex browser fetch failed');
  const payload = await res.json();
  return (payload?.results || []).map((book) => ({
    gutenberg_id: book.id,
    title: book.title,
    authors: (book.authors || []).map((a) => a?.name || '').filter(Boolean),
    languages: book.languages || [],
    formats: Object.keys(book.formats || {}),
    source: 'browser_gutendex',
  }));
}

export default function BookCatalogPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [books, setBooks] = useState([]);
  const [bookFavs, setBookFavs] = useState([]);
  const [excerptFavs, setExcerptFavs] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedBookExcerpts, setSelectedBookExcerpts] = useState([]);
  const [loadingExcerpts, setLoadingExcerpts] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const importedIds = useMemo(() => new Set(books.map((b) => b.gutenberg_id).filter(Boolean)), [books]);
  const favouriteBookIds = useMemo(() => new Set(bookFavs.map((f) => String(f.target_id))), [bookFavs]);
  const favouriteExcerptIds = useMemo(() => new Set(excerptFavs.map((f) => String(f.target_id))), [excerptFavs]);

  useEffect(() => {
    Promise.all([
      api.get('/books', { params: { limit: 100 } }),
      api.get('/me/favourites', { params: { target_type: 'book' } }),
      api.get('/me/favourites', { params: { target_type: 'excerpt' } }),
    ])
      .then(([booksRes, favRes, excerptFavRes]) => {
        setBooks(booksRes.data?.data ?? []);
        setBookFavs(favRes.data?.data ?? []);
        setExcerptFavs(excerptFavRes.data?.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const term = query.trim();
    const mergeUnique = (arr) => {
      const map = new Map();
      arr.forEach((r) => {
        if (!r?.gutenberg_id) return;
        if (!map.has(r.gutenberg_id)) map.set(r.gutenberg_id, r);
      });
      return Array.from(map.values());
    };
    try {
      let serverResults = [];
      let browserResults = [];

      const serverPromise = api
        .get(`/me/gutenberg/search?q=${encodeURIComponent(term)}`)
        .then((res) => {
          serverResults = res?.data?.data ?? [];
          setResults((prev) => mergeUnique([...prev, ...serverResults]));
        })
        .catch(() => {});

      const browserPromise = browserGutendexSearch(term)
        .then((res) => {
          browserResults = res ?? [];
          setResults((prev) => mergeUnique([...prev, ...browserResults]));
        })
        .catch(() => {});

      await Promise.allSettled([serverPromise, browserPromise]);

      if (serverResults.length === 0 && browserResults.length === 0) {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const importBook = async (resultBook) => {
    const gutenbergId = resultBook?.gutenberg_id;
    if (!gutenbergId) return;
    setImportingId(gutenbergId);
    try {
      const { data } = await api.post('/me/gutenberg/import', {
        gutenberg_id: gutenbergId,
        title: resultBook?.title,
        author: Array.isArray(resultBook?.authors) ? resultBook.authors.join(', ') : undefined,
        language: Array.isArray(resultBook?.languages) ? resultBook.languages[0] : undefined,
      });
      const book = data?.data;
      if (book) {
        setBooks((prev) => [book, ...prev.filter((b) => b.id !== book.id)]);
      }
    } catch {
      // ignore
    } finally {
      setImportingId(null);
    }
  };

  const toggleBookFavourite = async (bookId) => {
    const fav = bookFavs.find((f) => String(f.target_id) === String(bookId));
    try {
      if (fav) {
        await api.delete(`/me/favourites/${fav.id}`);
        setBookFavs((prev) => prev.filter((x) => x.id !== fav.id));
      } else {
        const { data } = await api.post('/me/favourites', { target_type: 'book', target_id: bookId });
        setBookFavs((prev) => [data.data, ...prev]);
      }
    } catch {
      // ignore
    }
  };

  const loadBookExcerpts = async (bookId) => {
    setSelectedBookId(bookId);
    setLoadingExcerpts(true);
    try {
      const { data } = await api.get(`/books/${bookId}/excerpts`, { params: { limit: 20 } });
      setSelectedBookExcerpts(data?.data ?? []);
    } catch {
      setSelectedBookExcerpts([]);
    } finally {
      setLoadingExcerpts(false);
    }
  };

  const toggleExcerptFavourite = async (excerptId) => {
    const existing = excerptFavs.find((f) => String(f.target_id) === String(excerptId));
    try {
      if (existing) {
        await api.delete(`/me/favourites/${existing.id}`);
        setExcerptFavs((prev) => prev.filter((f) => f.id !== existing.id));
      } else {
        const { data } = await api.post('/me/favourites', {
          target_type: 'excerpt',
          target_id: Number(excerptId),
        });
        setExcerptFavs((prev) => [data.data, ...prev]);
      }
    } catch {
      // ignore
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="ui-hero p-6 mb-6 ui-fade-in ui-glow-hover">
        <h1 className="ui-page-title text-3xl mb-2">{t('catalog.title')}</h1>
        <p className="text-slate-600 text-sm">{t('catalog.subtitle')}</p>
      </div>

      <section className="ui-card p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">{t('catalog.gutenbergSearch')}</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            className="flex-1 border rounded-md px-3 py-2 text-sm"
            placeholder={t('catalog.searchPlaceholder')}
          />
          <button onClick={search} className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm">
            {searching ? t('common.loading') : t('catalog.search')}
          </button>
        </div>

        <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
          {results.map((r) => {
            const imported = importedIds.has(r.gutenberg_id);
            return (
              <div key={r.gutenberg_id} className="border border-slate-200 bg-white rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.title}</p>
                  <p className="text-xs text-slate-500">{Array.isArray(r.authors) ? r.authors.join(', ') : ''}</p>
                  <p className="text-xs text-slate-400">ID: {r.gutenberg_id}</p>
                </div>
                <button
                  onClick={() => importBook(r)}
                  disabled={imported || importingId === r.gutenberg_id}
                  className={`text-xs px-3 py-1 rounded ${
                    imported ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'
                  }`}
                >
                  {imported ? t('catalog.imported') : importingId === r.gutenberg_id ? t('common.loading') : t('catalog.importBook')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="ui-card p-5">
        <h2 className="text-lg font-semibold mb-3">{t('catalog.importedBooks')}</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {books.map((book) => (
            <div key={book.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{book.title}</p>
                  <p className="text-xs text-gray-500">{book.author}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadBookExcerpts(book.id)}
                    className="text-xs px-3 py-1 rounded bg-slate-100 text-slate-700"
                  >
                    {selectedBookId === book.id ? 'Обновить отрывки' : 'Показать отрывки'}
                  </button>
                  <button
                    onClick={() => toggleBookFavourite(book.id)}
                    className={`text-xs px-3 py-1 rounded ${
                      favouriteBookIds.has(String(book.id)) ? 'bg-red-100 text-red-700' : 'bg-primary-600 text-white'
                    }`}
                  >
                    {favouriteBookIds.has(String(book.id)) ? t('favourites.removeFromFavourites') : t('favourites.addToFavourites')}
                  </button>
                </div>
              </div>
              {selectedBookId === book.id && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {loadingExcerpts ? (
                    <Spinner />
                  ) : selectedBookExcerpts.length === 0 ? (
                    <p className="text-xs text-gray-500">Для этой книги пока нет отрывков.</p>
                  ) : (
                    selectedBookExcerpts.map((ex) => (
                      <div key={ex.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{t('excerpts.passage')}</p>
                        <div className="ui-excerpt-box">
                          <p className="text-sm text-slate-800 leading-relaxed">{ex.passage}</p>
                        </div>
                        <div className="mt-2 flex justify-between items-center">
                          <div className="text-[11px] text-slate-600 space-x-2">
                            <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 px-2 py-0.5 font-medium border border-amber-200">
                              {t('excerpts.rule')}: {ex.rule_title || ex.rule_slug || `#${ex.rule_id}`}
                            </span>
                            {ex.chapter && <span>{t('excerpts.chapter')}: {ex.chapter}</span>}
                            {ex.page_number && <span>{t('excerpts.page')}: {ex.page_number}</span>}
                          </div>
                          <button
                            onClick={() => toggleExcerptFavourite(ex.id)}
                            className={`text-[11px] px-2 py-1 rounded ${
                              favouriteExcerptIds.has(String(ex.id))
                                ? 'bg-red-100 text-red-700'
                                : 'bg-primary-100 text-primary-700'
                            }`}
                          >
                            {favouriteExcerptIds.has(String(ex.id))
                              ? t('favourites.removeFromFavourites')
                              : t('favourites.addToFavourites')}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

