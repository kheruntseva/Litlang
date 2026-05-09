import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import api from '../../../lib/axiosInstance';
import Spinner from '../../../components/Spinner';

function HighlightedPassage({ passage, highlight }) {
  if (!highlight) return <p className="text-sm text-gray-800 mb-2">{passage}</p>;
  const idx = passage.indexOf(highlight);
  if (idx === -1) return <p className="text-sm text-gray-800 mb-2">{passage}</p>;
  return (
    <p className="text-sm text-gray-800 mb-2">
      {passage.substring(0, idx)}
      <mark className="bg-yellow-100 px-1 rounded">{highlight}</mark>
      {passage.substring(idx + highlight.length)}
    </p>
  );
}

export default function AISuggestPanel() {
  const { t } = useTranslation();
  const { get, post, put, loading, error } = useApi();
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedRule, setSelectedRule] = useState('');
  const [excerptCount, setExcerptCount] = useState(5);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const [summaryActionMsg, setSummaryActionMsg] = useState('');

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await get('/languages');
      const langs = res.data || res;
      setLanguages(langs);
      if (langs.length > 0 && !selectedLang) setSelectedLang(String(langs[0].id));
    } catch {}
  }, [get, selectedLang]);

  const fetchCategories = useCallback(async () => {
    if (!selectedLang) return;
    try {
      const res = await get(`/languages/${selectedLang}/categories`);
      const cats = res.data || res;
      setCategories(cats);
      if (cats.length > 0 && !selectedCat) setSelectedCat(String(cats[0].id));
    } catch {}
  }, [get, selectedLang, selectedCat]);

  const fetchRules = useCallback(async () => {
    if (!selectedCat) return;
    try {
      const res = await get(`/categories/${selectedCat}/rules`);
      const r = res.data || res;
      setRules(r);
      if (r.length > 0 && !selectedRule) setSelectedRule(String(r[0].id));
    } catch {}
  }, [get, selectedCat, selectedRule]);

  useEffect(() => { fetchLanguages(); }, [fetchLanguages]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSuggestExcerpts = async () => {
    if (!selectedRule) return;
    setGenerating(true);
    setSuggestions([]);
    try {
      const res = await post('/admin/ai/suggest-excerpts', {
        rule_id: Number(selectedRule),
        count: excerptCount,
      });
      setSuggestions(res.data || res.suggestions || res || []);
    } catch {} finally {
      setGenerating(false);
    }
  };

  const handleSuggestSummary = async () => {
    if (!selectedRule) return;
    setGenerating(true);
    setSummary('');
    try {
      const res = await post('/admin/ai/suggest-summary', {
        rule_id: Number(selectedRule),
      });
      setSummary(res.data?.summary ?? res.summary ?? '');
    } catch {} finally {
      setGenerating(false);
    }
  };

  const handleCopySummary = async () => {
    setSummaryActionMsg('');
    try {
      await navigator.clipboard.writeText(summary);
      setSummaryActionMsg(t('admin.summaryCopied'));
    } catch {
      setSummaryActionMsg(t('admin.summaryCopyFailed'));
    }
  };

  const handleApplySummaryToRule = async () => {
    if (!selectedRule || !summary.trim()) return;
    setSummaryActionMsg('');
    try {
      const ruleId = Number(selectedRule);
      const { data: en } = await api.get(`/rules/${ruleId}`, { headers: { 'Accept-Language': 'en' } });
      const enRule = en?.data;
      if (!enRule?.title) return;

      const translations = [{ locale: 'en', title: enRule.title, summary: summary.trim() }];
      try {
        const { data: ruPayload } = await api.get(`/rules/${ruleId}`, { headers: { 'Accept-Language': 'ru' } });
        const ruRule = ruPayload?.data;
        if (ruRule?.title?.trim()) {
          translations.push({
            locale: 'ru',
            title: ruRule.title,
            summary: ruRule.summary?.trim() || summary.trim(),
          });
        }
      } catch {
        // optional locale
      }

      await put(`/admin/rules/${ruleId}`, {
        category_id: enRule.category_id,
        slug: enRule.slug,
        sort_order: Number(enRule.sort_order) || 0,
        translations,
      });
      setSummaryActionMsg(t('admin.summaryApplied'));
    } catch {
      setSummaryActionMsg(t('common.error'));
    }
  };

  const handleSaveExcerpt = async (suggestion) => {
    try {
      // First, ensure book exists or create it
      let bookRes;
      try {
        bookRes = await post('/admin/books', {
          title: suggestion.book_title,
          author: suggestion.author,
        });
      } catch {
        // Book might already exist, try to find it
        const booksRes = await get('/books');
        const books = booksRes.data || booksRes;
        bookRes = books.find((b) => b.title === suggestion.book_title);
      }
      const bookId = bookRes?.id || bookRes?.data?.id;
      if (!bookId) return;

      await post('/admin/excerpts', {
        rule_id: Number(selectedRule),
        book_id: bookId,
        passage: suggestion.passage,
        highlight: suggestion.highlight,
        page_number: suggestion.page_hint || null,
        context_note: suggestion.context_note || null,
        sort_order: 0,
      });
      // Mark as saved
      setSuggestions((prev) =>
        prev.map((s) => s === suggestion ? { ...s, saved: true } : s)
      );
    } catch {}
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.aiTools')}</h1>

      {/* Rule selector */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Rule</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Language:</label>
            <select value={selectedLang} onChange={(e) => { setSelectedLang(e.target.value); setSelectedCat(''); setSelectedRule(''); }} className="border rounded-md px-3 py-2 text-sm">
              {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Category:</label>
            <select value={selectedCat} onChange={(e) => { setSelectedCat(e.target.value); setSelectedRule(''); }} className="border rounded-md px-3 py-2 text-sm">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Rule:</label>
            <select value={selectedRule} onChange={(e) => setSelectedRule(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              {rules.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* AI Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Suggest Excerpts */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">{t('admin.suggestExcerpts')}</h3>
          <p className="text-sm text-gray-600 mb-4">
            Use AI to generate literary excerpts that demonstrate the selected grammar rule.
          </p>
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Count</label>
              <input
                type="number"
                min={1}
                max={10}
                value={excerptCount}
                onChange={(e) => setExcerptCount(Number(e.target.value))}
                className="w-20 border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleSuggestExcerpts}
              disabled={generating || !selectedRule}
              className="px-4 py-2 bg-accent-700 text-white rounded-md text-sm hover:bg-accent-800 disabled:opacity-50"
            >
              {generating ? t('common.loading') : t('admin.suggestExcerpts')}
            </button>
          </div>
        </div>

        {/* Suggest Summary */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">{t('admin.suggestSummary')}</h3>
          <p className="text-sm text-gray-600 mb-4">
            Use AI to generate a concise grammar explanation for the selected rule.
          </p>
          <button
            onClick={handleSuggestSummary}
            disabled={generating || !selectedRule}
            className="px-4 py-2 bg-accent-700 text-white rounded-md text-sm hover:bg-accent-800 disabled:opacity-50"
          >
            {generating ? t('common.loading') : t('admin.suggestSummary')}
          </button>
        </div>
      </div>

      {generating && <div className="flex justify-center my-8"><Spinner size="lg" /></div>}

      {/* Summary result */}
      {summary && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Generated Summary</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary}</p>
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 bg-white border border-green-300 text-green-900 rounded-md text-sm hover:bg-green-100"
            >
              {t('admin.copySummary')}
            </button>
            <button
              type="button"
              onClick={handleApplySummaryToRule}
              disabled={!selectedRule}
              className="px-3 py-2 bg-accent-700 text-white rounded-md text-sm hover:bg-accent-800 disabled:opacity-50"
            >
              {t('admin.applySummaryToRule')}
            </button>
            <Link
              to="/admin/content/rules"
              className="text-sm text-primary-700 hover:underline"
            >
              {t('admin.openRuleEditor')}
            </Link>
          </div>
          {summaryActionMsg && (
            <p className="text-xs text-gray-600 mt-2">{summaryActionMsg}</p>
          )}
        </div>
      )}

      {/* Excerpt suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Suggested Excerpts</h3>
          <div className="space-y-4">
            {suggestions.map((s, i) => (
              <div key={i} className={`bg-white shadow rounded-lg p-5 border-l-4 ${s.saved ? 'border-green-500' : 'border-accent-500'}`}>
                <HighlightedPassage passage={s.passage} highlight={s.highlight} />
                {s.highlight && (
                  <p className="text-xs text-yellow-700 mb-2">
                    Highlight: <span className="bg-yellow-100 px-1 rounded">{s.highlight}</span>
                  </p>
                )}
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 italic">{s.book_title} — {s.author}</p>
                    {s.page_hint && <p className="text-xs text-gray-400">{s.page_hint}</p>}
                    {s.context_note && <p className="text-xs text-gray-500 mt-1">{s.context_note}</p>}
                  </div>
                  {s.saved ? (
                    <span className="text-green-600 text-xs font-medium">Saved</span>
                  ) : (
                    <button
                      onClick={() => handleSaveExcerpt(s)}
                      className="px-3 py-1 bg-primary-600 text-white rounded text-xs hover:bg-primary-700"
                    >
                      {t('admin.save')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
