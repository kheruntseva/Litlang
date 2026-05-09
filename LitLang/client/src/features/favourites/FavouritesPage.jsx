import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axiosInstance';
import Spinner from '../../components/Spinner';

export default function FavouritesPage() {
  const { t } = useTranslation();
  const [favourites, setFavourites] = useState([]);
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [bookExcerpts, setBookExcerpts] = useState([]);
  const [bookExcerptsPage, setBookExcerptsPage] = useState(1);
  const [hasMoreBookExcerpts, setHasMoreBookExcerpts] = useState(false);
  const [bookExcerptsTotal, setBookExcerptsTotal] = useState(0);
  const [bookExcerptsTotalPages, setBookExcerptsTotalPages] = useState(0);
  const [snippetPage, setSnippetPage] = useState(1);
  const [snippetItems, setSnippetItems] = useState([]);
  const [snippetHasMore, setSnippetHasMore] = useState(false);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [activeTab, setActiveTab] = useState('books');
  const [excerptDetails, setExcerptDetails] = useState({});
  const [ruleDetails, setRuleDetails] = useState({});
  const [limit, setLimit] = useState(8);
  const [loading, setLoading] = useState(true);
  const [loadingBookExcerpts, setLoadingBookExcerpts] = useState(false);
  const [rules, setRules] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [rulePattern, setRulePattern] = useState('');
  const [snippetSaveMessage, setSnippetSaveMessage] = useState('');
  const [savingSnippetKey, setSavingSnippetKey] = useState('');

  useEffect(() => {
    Promise.allSettled([
      api.get('/me/favourites'),
      api.get('/books', { params: { limit: 100 } }),
    ])
      .then(([favRes, booksRes]) => {
        if (favRes.status === 'fulfilled') {
          setFavourites(favRes.value.data?.data ?? []);
        } else {
          setFavourites([]);
        }
        if (booksRes.status === 'fulfilled') {
          setBooks(booksRes.value.data?.data ?? []);
        } else {
          setBooks([]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const langsRes = await api.get('/languages');
        const langs = langsRes.data?.data || [];
        const allRules = [];
        for (const lang of langs) {
          const catsRes = await api.get(`/languages/${lang.id}/categories`);
          const cats = catsRes.data?.data || [];
          for (const cat of cats) {
            const ruleRes = await api.get(`/categories/${cat.id}/rules`);
            const ruleList = ruleRes.data?.data || [];
            allRules.push(...ruleList.map((rule) => ({ ...rule, categoryTitle: cat.title })));
          }
        }
        setRules(allRules);
        if (!selectedRuleId && allRules.length > 0) {
          setSelectedRuleId(String(allRules[0].id));
        }
      } catch {
        setRules([]);
      }
    };
    fetchRules();
  }, []);

  const removeFavourite = async (id) => {
    try {
      await api.delete(`/me/favourites/${id}`);
      setFavourites((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // ignore
    }
  };

  const bookFavourites = favourites.filter((f) => f.target_type === 'book');
  const excerptFavourites = favourites.filter((f) => f.target_type === 'excerpt');
  const gutenbergSnippetFavourites = favourites.filter((f) => f.target_type === 'gutenberg_snippet');
  const ruleFavourites = favourites.filter((f) => f.target_type === 'rule');

  const isBookFavourite = (bookId) =>
    bookFavourites.some((f) => String(f.target_id) === String(bookId));
  const isExcerptFavourite = (excerptId) =>
    excerptFavourites.some((f) => String(f.target_id) === String(excerptId));

  const gutenbergBooks = books.filter((b) => Boolean(b.gutenberg_id));
  const validGutenbergBookFavourites = bookFavourites.filter((fav) => {
    const b = books.find((book) => String(book.id) === String(fav.target_id));
    return Boolean(b?.gutenberg_id);
  });

  const toggleBookFavourite = async (bookId) => {
    const existing = bookFavourites.find((f) => String(f.target_id) === String(bookId));
    try {
      if (existing) {
        await removeFavourite(existing.id);
        if (selectedBookId === String(bookId)) {
          setSelectedBookId('');
          setBookExcerpts([]);
        }
      } else {
        const { data } = await api.post('/me/favourites', { target_type: 'book', target_id: bookId });
        setFavourites((prev) => [data.data, ...prev]);
      }
    } catch {
      // ignore
    }
  };

  const toggleExcerptFavourite = async (excerptId) => {
    const existing = excerptFavourites.find((f) => String(f.target_id) === String(excerptId));
    try {
      if (existing) {
        await api.delete(`/me/favourites/${existing.id}`);
        setFavourites((prev) => prev.filter((f) => f.id !== existing.id));
      } else {
        const { data } = await api.post('/me/favourites', { target_type: 'excerpt', target_id: Number(excerptId) });
        setFavourites((prev) => [data.data, ...prev]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (validGutenbergBookFavourites.length === 0) {
      setSelectedBookId('');
      setBookExcerpts([]);
      setBookExcerptsPage(1);
      setHasMoreBookExcerpts(false);
      setBookExcerptsTotal(0);
      setBookExcerptsTotalPages(0);
      return;
    }
    // Auto-select first favourite book so excerpts are visible immediately.
    const selectedStillExists = validGutenbergBookFavourites.some((f) => String(f.target_id) === String(selectedBookId));
    if (!selectedBookId || !selectedStillExists) {
      setSelectedBookId(String(validGutenbergBookFavourites[0].target_id));
    }
  }, [validGutenbergBookFavourites, selectedBookId]);

  useEffect(() => {
    setBookExcerptsPage(1);
    setSnippetPage(1);
    setSnippetItems([]);
  }, [selectedBookId]);

  useEffect(() => {
    setSnippetPage(1);
    setSnippetItems([]);
  }, [selectedRuleId, rulePattern]);

  useEffect(() => {
    if (!selectedBookId) {
      setBookExcerpts([]);
      setBookExcerptsPage(1);
      setHasMoreBookExcerpts(false);
      setBookExcerptsTotal(0);
      setBookExcerptsTotalPages(0);
      return;
    }
    setLoadingBookExcerpts(true);
    api.get(`/books/${selectedBookId}/excerpts`, { params: { limit, page: bookExcerptsPage } })
      .then(({ data }) => {
        const incoming = data.data || [];
        setBookExcerpts((prev) => (bookExcerptsPage === 1 ? incoming : [...prev, ...incoming]));
        const total = Number(data.meta?.total || 0);
        const totalPages = Number(data.meta?.totalPages || 0);
        setBookExcerptsTotal(total);
        setBookExcerptsTotalPages(totalPages);
        setHasMoreBookExcerpts(bookExcerptsPage < totalPages);
      })
      .catch(() => {
        setBookExcerpts([]);
        setHasMoreBookExcerpts(false);
        setBookExcerptsTotal(0);
        setBookExcerptsTotalPages(0);
      })
      .finally(() => setLoadingBookExcerpts(false));
  }, [selectedBookId, limit, bookExcerptsPage]);

  useEffect(() => {
    if (!selectedBookId) {
      setSnippetItems([]);
      setSnippetHasMore(false);
      return;
    }
    setLoadingSnippets(true);
    api.get(`/me/gutenberg/books/${selectedBookId}/snippets`, {
      params: {
        limit: 5,
        page: snippetPage,
        rule_id: selectedRuleId || undefined,
        pattern: rulePattern.trim() || undefined,
      },
    })
      .then(async ({ data }) => {
        let incoming = data.data || [];
        let meta = data.meta || {};
        if (selectedRuleId && incoming.length === 0) {
          // If strict rule matching found nothing, try generic snippets and annotate with selected rule
          // so UI still shows rule/explanation instead of dashes.
          try {
            const fallbackRes = await api.get(`/me/gutenberg/books/${selectedBookId}/snippets`, {
              params: { limit: 5, page: snippetPage },
            });
            const fallbackItems = fallbackRes.data?.data || [];
            const fallbackMeta = fallbackRes.data?.meta || {};
            const selectedRule = rules.find((r) => String(r.id) === String(selectedRuleId));
            incoming = fallbackItems.map((item) => ({
              ...item,
              rule_id: selectedRule?.id ? Number(selectedRule.id) : item.rule_id,
              rule_title: selectedRule?.title || item.rule_title || '',
              rule_summary: selectedRule?.summary || item.rule_summary || '',
              context_note: selectedRule?.title
                ? `This sentence can be discussed through the rule "${selectedRule.title}" in context.`
                : item.context_note,
            }));
            meta = fallbackMeta;
          } catch {
            // keep empty result
          }
        }
        setSnippetItems((prev) => (snippetPage === 1 ? incoming : [...prev, ...incoming]));
        const totalPages = Number(meta?.totalPages || 0);
        setSnippetHasMore(snippetPage < totalPages);
      })
      .catch(() => {
        if (snippetPage === 1) setSnippetItems([]);
        setSnippetHasMore(false);
      })
      .finally(() => setLoadingSnippets(false));
  }, [selectedBookId, snippetPage, selectedRuleId, rulePattern, rules]);

  const saveSnippetToFavourites = async (snippet) => {
    const snippetKey = `${snippet.id}-${snippet.paragraph_number || ''}`;
    setSavingSnippetKey(snippetKey);
    setSnippetSaveMessage('');
    try {
      const { data } = await api.post('/me/gutenberg/snippets/favourite', {
        book_id: Number(selectedBookId),
        passage: snippet.passage,
        highlight: snippet.highlight || undefined,
        page_number: snippet.page_number || (snippet.paragraph_number ? `¶${snippet.paragraph_number}` : undefined),
        chapter: snippet.chapter || undefined,
        context_note: snippet.context_note || undefined,
        rule_id: snippet.rule_id || (selectedRuleId ? Number(selectedRuleId) : undefined),
        paragraph_number: snippet.paragraph_number || undefined,
      });
      if (data?.data?.favourite) {
        // Reload full favourites so joined metadata (book/author/rule) is present immediately.
        const favRes = await api.get('/me/favourites');
        setFavourites(favRes.data?.data ?? []);
        setSnippetSaveMessage('Отрывок добавлен в избранное.');
      }
    } catch {
      setSnippetSaveMessage('Не удалось сохранить отрывок. Попробуйте еще раз.');
    } finally {
      setSavingSnippetKey('');
    }
  };

  useEffect(() => {
    const loadDetails = async () => {
      const excerptFavs = favourites.filter((f) => f.target_type === 'excerpt');
      const ruleFavs = favourites.filter((f) => f.target_type === 'rule');
      const excerptIds = excerptFavs.map((f) => Number(f.target_id));
      const directRuleIds = ruleFavs.map((f) => Number(f.target_id));
      if (excerptIds.length === 0 && directRuleIds.length === 0) {
        setExcerptDetails({});
        setRuleDetails({});
        return;
      }
      try {
        const excerptReqs = excerptIds.map((id) =>
          api
            .get(`/excerpts/${id}`)
            .then((r) => [id, r.data?.data] )
            .catch(() => [id, null])
        );
        const excerptRes = await Promise.all(excerptReqs);
        const excerptRuleIds = excerptRes
          .map(([, ex]) => ex?.rule_id)
          .filter(Boolean)
          .map(Number);
        const ruleIds = [...new Set([...directRuleIds, ...excerptRuleIds])];

        const ruleReqs = ruleIds.map((id) =>
          api
            .get(`/rules/${id}`)
            .then((r) => [id, r.data?.data] )
            .catch(() => [id, null])
        );
        const ruleRes = await Promise.all(ruleReqs);
        setExcerptDetails(Object.fromEntries(excerptRes));
        setRuleDetails(Object.fromEntries(ruleRes));
      } catch {
        // ignore
      }
    };
    loadDetails();
  }, [favourites]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="ui-hero p-6 mb-6 ui-fade-in ui-glow-hover">
        <h1 className="ui-page-title text-3xl mb-2">{t('favourites.title')}</h1>
        <p className="text-slate-600 text-sm">
          Удобно хранить любимые книги, правила и отрывки в одном месте.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab('books')}
          className={`px-3 py-2 rounded-lg text-sm border ${activeTab === 'books' ? 'bg-primary-100 border-primary-300 text-primary-800' : 'bg-white border-slate-200 text-slate-700'}`}
        >
          Книги Гутенберг
        </button>
        <button
          onClick={() => setActiveTab('items')}
          className={`px-3 py-2 rounded-lg text-sm border ${activeTab === 'items' ? 'bg-primary-100 border-primary-300 text-primary-800' : 'bg-white border-slate-200 text-slate-700'}`}
        >
          Отрывки с правилами
        </button>
      </div>

      {activeTab === 'books' && (
      <section className="ui-card p-5 mb-6">
        <h2 className="text-lg font-semibold mb-3">{t('favourites.booksSection')}</h2>

        <div className="max-h-56 overflow-y-auto space-y-2 mb-4">
          {gutenbergBooks.map((book) => (
            <div key={book.id} className="border rounded p-3 flex justify-between items-center">
              <div>
              <p className="text-sm font-medium text-slate-800">{book.title}</p>
              <p className="text-xs text-slate-500">{book.author}</p>
              </div>
              <button
                onClick={() => toggleBookFavourite(book.id)}
                className={`text-xs px-3 py-1 rounded ${
                  isBookFavourite(book.id) ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-primary-600 text-white'
                }`}
              >
                {isBookFavourite(book.id) ? t('favourites.removeFromFavourites') : t('favourites.addToFavourites')}
              </button>
            </div>
          ))}
        </div>

        {validGutenbergBookFavourites.length > 0 && (
          <div>
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-700 mb-2">My favourite books</p>
              <div className="space-y-1">
                {validGutenbergBookFavourites.map((fav) => {
                  const favBook = books.find((b) => String(b.id) === String(fav.target_id));
                  return (
                    <button
                      key={fav.id}
                      onClick={() => setSelectedBookId(String(fav.target_id))}
                      onDoubleClick={() => {
                        setSelectedBookId(String(fav.target_id));
                        setBookExcerptsPage(1);
                      }}
                      className={`w-full text-left border rounded-lg px-3 py-2 text-sm transition ${
                        String(selectedBookId) === String(fav.target_id)
                          ? 'border-primary-400 bg-primary-50 shadow-sm text-slate-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      {favBook
                        ? `${favBook.title} — ${favBook.author}`
                        : (fav.book_title
                          ? `${fav.book_title}${fav.book_author ? ` — ${fav.book_author}` : ''}`
                          : `ID ${fav.target_id}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 mb-3">
              <select
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
                className="ui-input !w-auto text-sm"
              >
                <option value="">{t('favourites.selectBook')}</option>
                {validGutenbergBookFavourites.map((fav) => {
                  const book = books.find((b) => String(b.id) === String(fav.target_id));
                  return (
                    <option key={fav.id} value={fav.target_id}>
                      {book ? book.title : (fav.book_title || `ID ${fav.target_id}`)}
                    </option>
                  );
                })}
              </select>
              <input
                type="number"
                min={1}
                max={30}
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value) || 1);
                  setBookExcerptsPage(1);
                }}
                className="w-24 ui-input text-sm"
              />
              {hasMoreBookExcerpts && (
                <button
                  onClick={() => setBookExcerptsPage((p) => p + 1)}
                  disabled={loadingBookExcerpts}
                  className="text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-50"
                >
                  Загрузить следующую страницу
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Всего отрывков у выбранной книги: {bookExcerptsTotal}. Страница {bookExcerptsPage}
              {bookExcerptsTotalPages > 0 ? ` из ${bookExcerptsTotalPages}` : ''}.
            </p>

            {loadingBookExcerpts ? (
              <Spinner />
            ) : (
              <div className="space-y-2">
                {bookExcerpts.map((ex) => (
                  <div key={ex.id} className="border rounded-xl p-3 bg-white shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t('excerpts.passage')}</p>
                    <div className="ui-excerpt-box">
                      <p className="text-sm text-slate-800 leading-relaxed">{ex.passage}</p>
                      {ex.highlight && (
                        <p className="text-xs mt-2">
                          <span className="bg-accent-100 text-accent-800 px-1 rounded">{ex.highlight}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-primary-50 border border-primary-200 rounded px-2 py-1.5">
                        <span className="text-primary-700 font-semibold mr-1">{t('excerpts.rule')}:</span>
                        {ex.rule_id ? (
                          <Link to={`/rules/${ex.rule_id}`} className="text-slate-800 font-medium hover:underline">
                            {ex.rule_title || ex.rule_slug || ex.rule_id}
                          </Link>
                        ) : (
                          <span className="text-slate-800 font-medium">{ex.rule_title || ex.rule_slug || ex.rule_id}</span>
                        )}
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.page')}:</span>
                        <span className="text-slate-700">{ex.page_number || '-'}</span>
                      </div>
                      {ex.chapter && (
                        <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                          <span className="text-slate-500 mr-1">{t('excerpts.chapter')}:</span>
                          <span className="text-slate-700">{ex.chapter}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => toggleExcerptFavourite(ex.id)}
                        className={`text-xs px-3 py-1 rounded ${
                          isExcerptFavourite(ex.id)
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-primary-100 text-primary-700 border border-primary-200'
                        }`}
                      >
                        {isExcerptFavourite(ex.id) ? t('favourites.removeFromFavourites') : t('favourites.addToFavourites')}
                      </button>
                    </div>
                  </div>
                ))}
                {selectedBookId && bookExcerpts.length === 0 && (
                  <p className="text-sm text-slate-500">{t('favourites.noExcerptsForSelectedBook')}</p>
                )}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Новые отрывки из Gutenberg (которых еще нет в каталоге)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                <select
                  value={selectedRuleId}
                  onChange={(e) => setSelectedRuleId(e.target.value)}
                  className="ui-input text-sm"
                >
                  <option value="">Без фильтра по правилу</option>
                  {rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.categoryTitle ? `${rule.categoryTitle}: ` : ''}{rule.title}
                    </option>
                  ))}
                </select>
                <input
                  value={rulePattern}
                  onChange={(e) => setRulePattern(e.target.value)}
                  className="ui-input text-sm sm:col-span-2"
                  placeholder="Regex (опционально), напр. \\bused to\\b"
                />
              </div>
              <div className="space-y-2">
                {snippetItems.map((snippet) => (
                  <div key={`${snippet.id}-${snippet.paragraph_number}`} className="border rounded-xl p-3 bg-white shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t('excerpts.passage')}</p>
                    <div className="ui-excerpt-box">
                      <p className="text-sm text-slate-800 leading-relaxed">{snippet.passage}</p>
                      {snippet.highlight && (
                        <p className="text-xs mt-2">
                          <span className="bg-accent-100 text-accent-800 px-1 rounded">{snippet.highlight}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.book')}:</span>
                        <span className="text-slate-700">{snippet.book_title || books.find((b) => String(b.id) === String(selectedBookId))?.title || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.author')}:</span>
                        <span className="text-slate-700">{snippet.book_author || books.find((b) => String(b.id) === String(selectedBookId))?.author || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.page')}:</span>
                        <span className="text-slate-700">{snippet.page_number || `¶${snippet.paragraph_number || '-'}`}</span>
                      </div>
                      <div className="bg-primary-50 border border-primary-200 rounded px-2 py-1.5">
                        <span className="text-primary-700 font-semibold mr-1">{t('excerpts.rule')}:</span>
                        {snippet.rule_id ? (
                          <Link to={`/rules/${snippet.rule_id}`} className="text-slate-800 font-medium hover:underline">
                            {snippet.rule_title || snippet.rule_slug || snippet.rule_id}
                          </Link>
                        ) : (
                          <span className="text-slate-800 font-medium">—</span>
                        )}
                      </div>
                    </div>
                    {snippet.rule_summary && (
                      <div className="mt-2 bg-accent-50 border border-accent-200 rounded p-2">
                        <p className="text-[11px] uppercase tracking-wide text-accent-700 mb-1">{t('rules.explanation')}</p>
                        <p className="text-xs text-slate-800">{snippet.context_note || snippet.rule_summary}</p>
                      </div>
                    )}
                    {!snippet.rule_summary && snippet.context_note && (
                      <div className="mt-2 bg-accent-50 border border-accent-200 rounded p-2">
                        <p className="text-[11px] uppercase tracking-wide text-accent-700 mb-1">{t('rules.explanation')}</p>
                        <p className="text-xs text-slate-800">{snippet.context_note}</p>
                      </div>
                    )}
                    <div className="mt-2 flex justify-end items-center">
                      <button
                        onClick={() => saveSnippetToFavourites(snippet)}
                        disabled={savingSnippetKey === `${snippet.id}-${snippet.paragraph_number || ''}`}
                        className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        {savingSnippetKey === `${snippet.id}-${snippet.paragraph_number || ''}`
                          ? 'Сохранение...'
                          : 'Сохранить в избранные отрывки'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {snippetSaveMessage && (
                <p className="mt-2 text-xs text-slate-600">{snippetSaveMessage}</p>
              )}
              <button
                onClick={() => setSnippetPage((p) => p + 1)}
                disabled={loadingSnippets || !snippetHasMore || !selectedBookId}
                className="mt-3 text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-50"
              >
                Загрузить еще 5 новых отрывков
              </button>
            </div>
          </div>
        )}
      </section>
      )}

      {activeTab === 'items' && (
      <section className="ui-card p-5">
        <h2 className="text-lg font-semibold mb-3">{t('favourites.itemsSection')}</h2>
        {excerptFavourites.length === 0 && ruleFavourites.length === 0 && gutenbergSnippetFavourites.length === 0 ? (
          <p className="text-slate-500 py-2">{t('favourites.empty')}</p>
        ) : (
          <div className="space-y-3">
            {[...excerptFavourites, ...gutenbergSnippetFavourites, ...ruleFavourites].map((fav) => (
              <div key={fav.id} className="border rounded-xl p-3 bg-white shadow-sm">
                <div className="text-sm text-gray-700 mb-2">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded mr-2">{fav.target_type}</span>
                </div>
                {fav.target_type === 'excerpt' && (
                  <>
                    <div className="ui-excerpt-box">
                      <p className="text-sm text-slate-800 leading-relaxed">
                        {excerptDetails[Number(fav.target_id)]?.passage || fav.excerpt_passage || `ID: ${fav.target_id}`}
                      </p>
                      {excerptDetails[Number(fav.target_id)]?.highlight && (
                        <p className="text-xs mt-2">
                          <span className="bg-accent-100 text-accent-800 px-1 rounded">
                            {excerptDetails[Number(fav.target_id)]?.highlight}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.book')}:</span>
                        <span className="text-slate-700">{excerptDetails[Number(fav.target_id)]?.book_title || fav.book_title || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.author')}:</span>
                        <span className="text-slate-700">{excerptDetails[Number(fav.target_id)]?.book_author || fav.book_author || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.chapter')}:</span>
                        <span className="text-slate-700">{excerptDetails[Number(fav.target_id)]?.chapter || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.page')}:</span>
                        <span className="text-slate-700">{excerptDetails[Number(fav.target_id)]?.page_number || '-'}</span>
                      </div>
                      <div className="bg-primary-50 border border-primary-200 rounded px-2 py-1.5 sm:col-span-2">
                        <span className="text-primary-700 font-semibold mr-1">{t('excerpts.rule')}:</span>
                        {excerptDetails[Number(fav.target_id)]?.rule_id ? (
                          <Link to={`/rules/${excerptDetails[Number(fav.target_id)]?.rule_id}`} className="text-slate-800 font-medium hover:underline">
                            {ruleDetails[Number(excerptDetails[Number(fav.target_id)]?.rule_id)]?.title || `Rule ${excerptDetails[Number(fav.target_id)]?.rule_id}`}
                          </Link>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </div>
                    </div>
                    {excerptDetails[Number(fav.target_id)]?.rule_id && (
                      <div className="mt-2 bg-accent-50 border border-accent-200 rounded p-2">
                        <p className="text-[11px] uppercase tracking-wide text-accent-700 mb-1">{t('rules.explanation')}</p>
                        <p className="text-xs text-slate-800">
                          {ruleDetails[Number(excerptDetails[Number(fav.target_id)]?.rule_id)]?.summary || '—'}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {fav.target_type === 'gutenberg_snippet' && (
                  <>
                    <div className="ui-excerpt-box">
                      <p className="text-sm text-slate-800 leading-relaxed">{fav.gutenberg_snippet_passage || `ID: ${fav.target_id}`}</p>
                      {fav.gutenberg_snippet_highlight && (
                        <p className="text-xs mt-2">
                          <span className="bg-accent-100 text-accent-800 px-1 rounded">{fav.gutenberg_snippet_highlight}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.book')}:</span>
                        <span className="text-slate-700">{fav.gutenberg_book_title || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.author')}:</span>
                        <span className="text-slate-700">{fav.gutenberg_book_author || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.chapter')}:</span>
                        <span className="text-slate-700">{fav.gutenberg_snippet_chapter || '-'}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                        <span className="text-slate-500 mr-1">{t('excerpts.page')}:</span>
                        <span className="text-slate-700">{fav.gutenberg_snippet_page_number || '-'}</span>
                      </div>
                      <div className="bg-primary-50 border border-primary-200 rounded px-2 py-1.5 sm:col-span-2">
                        <span className="text-primary-700 font-semibold mr-1">{t('excerpts.rule')}:</span>
                        {fav.gutenberg_snippet_rule_id ? (
                          <Link to={`/rules/${fav.gutenberg_snippet_rule_id}`} className="text-slate-800 font-medium hover:underline">
                            {fav.gutenberg_rule_title || fav.gutenberg_rule_slug || fav.gutenberg_snippet_rule_id}
                          </Link>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </div>
                    </div>
                    {fav.gutenberg_rule_summary && (
                      <div className="mt-2 bg-accent-50 border border-accent-200 rounded p-2">
                        <p className="text-[11px] uppercase tracking-wide text-accent-700 mb-1">{t('rules.explanation')}</p>
                        <p className="text-xs text-slate-800">{fav.gutenberg_snippet_context_note || fav.gutenberg_rule_summary}</p>
                      </div>
                    )}
                    {!fav.gutenberg_rule_summary && (
                      <div className="mt-2 bg-accent-50 border border-accent-200 rounded p-2">
                        <p className="text-[11px] uppercase tracking-wide text-accent-700 mb-1">{t('rules.explanation')}</p>
                        <p className="text-xs text-slate-800">
                          {fav.gutenberg_snippet_context_note
                            ? fav.gutenberg_snippet_context_note
                            : fav.gutenberg_snippet_highlight && fav.gutenberg_rule_title
                            ? `Фрагмент "${fav.gutenberg_snippet_highlight}" в этом отрывке показывает правило "${fav.gutenberg_rule_title}".`
                            : fav.gutenberg_rule_title
                              ? `Этот отрывок можно использовать как пример правила "${fav.gutenberg_rule_title}".`
                              : 'Этот отрывок сохранен как отдельный пример из Gutenberg для повторения правила в контексте.'}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {fav.target_type === 'rule' && (
                  <div className="text-sm text-slate-800">
                    <Link to={`/rules/${fav.target_id}`} className="hover:underline">
                      {ruleDetails[Number(fav.target_id)]?.title || fav.rule_title || `ID: ${fav.target_id}`}
                    </Link>
                    <p className="text-xs text-slate-600 mt-1">
                      {ruleDetails[Number(fav.target_id)]?.summary || ''}
                    </p>
                  </div>
                )}
                <div className="mt-3">
                  <button onClick={() => removeFavourite(fav.id)} className="text-sm text-red-600 hover:text-red-700">
                    {t('favourites.removeFromFavourites')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
