import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import Spinner from '../../../components/Spinner';

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

export default function GutenbergSearchPanel() {
  const { t } = useTranslation();
  const { get, post, loading, error } = useApi();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [importing, setImporting] = useState(null);
  const [searching, setSearching] = useState(false);

  // Extraction state
  const [importedBooks, setImportedBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [rules, setRules] = useState([]);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [pattern, setPattern] = useState('');
  const [extractedPassages, setExtractedPassages] = useState([]);
  const [extracting, setExtracting] = useState(false);

  const getGutenbergId = (book) => book?.gutenberg_id ?? book?.id;
  const selectedBook = importedBooks.find((b) => String(b.id) === String(selectedBookId));
  const selectedRule = rules.find((r) => String(r.id) === String(selectedRuleId));

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    const term = searchQuery.trim();
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

      const serverPromise = get(`/admin/gutenberg/search?q=${encodeURIComponent(term)}`)
        .then((res) => {
          serverResults = res?.results || res?.data || res || [];
          setSearchResults((prev) => mergeUnique([...prev, ...serverResults]));
        })
        .catch(() => {});

      const browserPromise = browserGutendexSearch(term)
        .then((res) => {
          browserResults = res || [];
          setSearchResults((prev) => mergeUnique([...prev, ...browserResults]));
        })
        .catch(() => {});

      await Promise.allSettled([serverPromise, browserPromise]);
      if (serverResults.length === 0 && browserResults.length === 0) {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (bookCandidate) => {
    const gutenbergId = getGutenbergId(bookCandidate);
    if (!gutenbergId) return;
    setImporting(gutenbergId);
    try {
      const res = await post('/admin/gutenberg/import', {
        gutenberg_id: gutenbergId,
        title: bookCandidate?.title,
        author: Array.isArray(bookCandidate?.authors)
          ? bookCandidate.authors.map((a) => a?.name || a).filter(Boolean).join(', ')
          : undefined,
        language: Array.isArray(bookCandidate?.languages) ? bookCandidate.languages[0] : undefined,
      });
      const book = res.book || res.data || res;
      setImportedBooks((prev) => {
        const exists = prev.some((b) => Number(b.id) === Number(book.id));
        if (exists) return prev;
        return [book, ...prev];
      });
      // Mark in search results
      setSearchResults((prev) =>
        prev.map((r) => (getGutenbergId(r) === gutenbergId ? { ...r, imported: true } : r))
      );
      if (!selectedBookId) setSelectedBookId(String(book.id));
    } catch {} finally {
      setImporting(null);
    }
  };

  const fetchImportedBooks = useCallback(async () => {
    try {
      const res = await get('/admin/gutenberg/imported-books');
      const allBooks = res.data || res || [];
      setImportedBooks(allBooks);
    } catch {
      // ignore
    }
  }, [get]);

  const fetchRules = useCallback(async () => {
    try {
      // Get all languages, then all categories, then all rules
      const langRes = await get('/languages');
      const langs = langRes.data || langRes;
      const allRules = [];
      for (const lang of langs) {
        const catRes = await get(`/languages/${lang.id}/categories`);
        const cats = catRes.data || catRes;
        for (const cat of cats) {
          const ruleRes = await get(`/categories/${cat.id}/rules`);
          const r = ruleRes.data || ruleRes;
          allRules.push(...r.map((rule) => ({ ...rule, categoryTitle: cat.title })));
        }
      }
      setRules(allRules);
    } catch {}
  }, [get]);

  const handleExtract = async () => {
    if (!selectedBookId || !selectedRuleId) return;
    setExtracting(true);
    setExtractedPassages([]);
    try {
      const res = await post('/admin/gutenberg/extract', {
        book_id: Number(selectedBookId),
        rule_id: Number(selectedRuleId),
        pattern: pattern || undefined,
        count: 10,
      });
      setExtractedPassages(res.data || res.passages || res || []);
    } catch {} finally {
      setExtracting(false);
    }
  };

  const handleSavePassage = async (passage) => {
    try {
      await post('/admin/excerpts', {
        rule_id: Number(selectedRuleId),
        book_id: Number(selectedBookId),
        passage: passage.text || passage.passage,
        highlight: passage.highlight || null,
        page_number: passage.page_number || (passage.paragraph_number ? `¶${passage.paragraph_number}` : null),
        chapter: passage.chapter || null,
        context_note: passage.context_note || null,
        sort_order: 0,
      });
      setExtractedPassages((prev) =>
        prev.map((p) => p === passage ? { ...p, saved: true } : p)
      );
    } catch {}
  };

  useEffect(() => {
    fetchImportedBooks();
    fetchRules();
  }, [fetchImportedBooks, fetchRules]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.gutenberg')}</h1>

      {/* Search */}
      <section className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Search Project Gutenberg</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 border rounded-md px-3 py-2 text-sm"
            placeholder="Search books by title or author..."
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

        {searching && searchResults.length === 0 && <div className="mt-4"><Spinner /></div>}

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
            {searchResults.map((book) => (
              <div key={getGutenbergId(book)} className="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{book.title}</p>
                  <p className="text-xs text-gray-500">
                    {Array.isArray(book.authors)
                      ? book.authors.map((a) => a.name || a).join(', ')
                      : book.author || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-400">Gutenberg ID: {getGutenbergId(book)}</p>
                </div>
                {book.imported ? (
                  <span className="text-green-600 text-xs font-medium">Imported</span>
                ) : (
                  <button
                    onClick={() => handleImport(book)}
                    disabled={importing === getGutenbergId(book)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                  >
                    {importing === getGutenbergId(book) ? 'Importing...' : t('admin.import')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Extract */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{t('admin.extract')}</h2>
        <p className="text-sm text-gray-600 mb-4">
          Find passages in imported Gutenberg texts that demonstrate a grammar rule.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book (imported)</label>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Select book —</option>
              {importedBooks.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rule</label>
            {rules.length === 0 ? (
              <button onClick={fetchRules} className="text-primary-600 text-sm hover:underline">
                Load rules...
              </button>
            ) : (
              <select
                value={selectedRuleId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="">— Select rule —</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>{r.categoryTitle}: {r.title}</option>
                ))}
              </select>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pattern (regex, optional)</label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder='e.g. \\bthe\\b \\w+'
            />
          </div>
        </div>

        <button
          onClick={handleExtract}
          disabled={extracting || !selectedBookId || !selectedRuleId}
          className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          {extracting ? t('common.loading') : t('admin.extract')}
        </button>

        {extracting && <div className="mt-4"><Spinner /></div>}

        {extractedPassages.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-medium text-sm text-gray-700">Found {extractedPassages.length} passages:</h3>
            {extractedPassages.map((p, i) => (
              <div key={i} className={`border rounded-lg p-4 border-l-4 ${p.saved ? 'border-l-green-500' : 'border-l-primary-500'}`}>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Passage</p>
                <p className="text-sm text-gray-800">{p.text || p.passage}</p>
                {p.highlight && (
                  <p className="text-xs mt-2">
                    <span className="bg-accent-100 text-accent-800 px-1 rounded">{p.highlight}</span>
                  </p>
                )}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    <span className="text-gray-500 mr-1">Book:</span>
                    <span className="text-gray-700">{selectedBook?.title || '-'}</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    <span className="text-gray-500 mr-1">Author:</span>
                    <span className="text-gray-700">{selectedBook?.author || '-'}</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    <span className="text-gray-500 mr-1">Page:</span>
                    <span className="text-gray-700">
                      {p.page_number || (p.paragraph_number ? `¶${p.paragraph_number}` : p.paragraph ? `¶${p.paragraph}` : '-')}
                    </span>
                  </div>
                  <div className="bg-primary-50 border border-primary-200 rounded px-2 py-1">
                    <span className="text-primary-700 mr-1">Rule:</span>
                    <span className="text-gray-800">{selectedRule?.title || '-'}</span>
                  </div>
                </div>
                {(p.context_note || selectedRule?.summary) && (
                  <div className="mt-2 bg-accent-50 border border-accent-200 rounded p-2">
                    <p className="text-[11px] uppercase tracking-wide text-accent-700 mb-1">Rule explanation</p>
                    <p className="text-xs text-gray-800">{p.context_note || selectedRule.summary}</p>
                  </div>
                )}
                <div className="mt-2">
                  {p.saved ? (
                    <span className="text-green-600 text-xs font-medium">Saved as excerpt</span>
                  ) : (
                    <button
                      onClick={() => handleSavePassage(p)}
                      className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                    >
                      Save as Excerpt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
