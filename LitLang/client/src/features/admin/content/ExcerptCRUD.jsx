import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import Spinner from '../../../components/Spinner';

export default function ExcerptCRUD() {
  const { t } = useTranslation();
  const { get, post, put, del, loading, error } = useApi();
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [books, setBooks] = useState([]);
  const [excerpts, setExcerpts] = useState([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedRule, setSelectedRule] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    rule_id: '', book_id: '', passage: '', highlight: '',
    page_number: '', chapter: '', context_note: '', sort_order: 0,
  });

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

  const fetchBooks = useCallback(async () => {
    try {
      const res = await get('/books');
      setBooks(res.data || res);
    } catch {}
  }, [get]);

  const fetchExcerpts = useCallback(async () => {
    if (!selectedRule) return;
    try {
      const res = await get(`/rules/${selectedRule}/excerpts`);
      setExcerpts(res.data || res);
    } catch {}
  }, [get, selectedRule]);

  useEffect(() => { fetchLanguages(); fetchBooks(); }, [fetchLanguages, fetchBooks]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchRules(); }, [fetchRules]);
  useEffect(() => { fetchExcerpts(); }, [fetchExcerpts]);

  const resetForm = () => {
    setForm({
      rule_id: selectedRule, book_id: '', passage: '', highlight: '',
      page_number: '', chapter: '', context_note: '', sort_order: 0,
    });
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ruleId = Number(form.rule_id || selectedRule);
    const bookId = Number(form.book_id);
    if (!Number.isInteger(ruleId) || !Number.isInteger(bookId)) return;
    const payload = {
      rule_id: ruleId,
      book_id: bookId,
      passage: form.passage,
      highlight: form.highlight || null,
      page_number: form.page_number || null,
      chapter: form.chapter || null,
      context_note: form.context_note || null,
      sort_order: Number.isFinite(Number(form.sort_order)) ? Number(form.sort_order) : 0,
    };
    try {
      if (editing) {
        await put(`/admin/excerpts/${editing}`, payload);
      } else {
        await post('/admin/excerpts', payload);
      }
      resetForm();
      fetchExcerpts();
    } catch {}
  };

  const handleEdit = (exc) => {
    setEditing(exc.id);
    setForm({
      rule_id: String(exc.rule_id),
      book_id: String(exc.book_id),
      passage: exc.passage || '',
      highlight: exc.highlight || '',
      page_number: exc.page_number || '',
      chapter: exc.chapter || '',
      context_note: exc.context_note || '',
      sort_order: exc.sort_order || 0,
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.confirm'))) return;
    try {
      await del(`/admin/excerpts/${id}`);
      fetchExcerpts();
    } catch {}
  };

  if (loading && languages.length === 0) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.excerpts')}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{editing ? t('admin.edit') : t('admin.create')}</h2>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Book</label>
            <select
              value={form.book_id}
              onChange={(e) => setForm({ ...form, book_id: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            >
              <option value="">— Select book —</option>
              {books.map((b) => <option key={b.id} value={b.id}>{b.title} — {b.author}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Page</label>
              <input type="text" value={form.page_number} onChange={(e) => setForm({ ...form, page_number: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
              <input type="text" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Passage</label>
            <textarea value={form.passage} onChange={(e) => setForm({ ...form, passage: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" rows={3} required />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Highlight (fragment demonstrating the rule)</label>
            <input type="text" value={form.highlight} onChange={(e) => setForm({ ...form, highlight: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Context Note</label>
            <input type="text" value={form.context_note} onChange={(e) => setForm({ ...form, context_note: e.target.value })} className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700">{t('admin.save')}</button>
          {editing && <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm">{t('admin.cancel')}</button>}
        </div>
      </form>

      {/* List */}
      <div className="space-y-3">
        {excerpts.map((exc) => (
          <div key={exc.id} className="bg-white shadow rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-gray-700">{exc.passage}</p>
                {exc.highlight && (
                  <p className="text-xs text-yellow-700 mt-1">Highlight: <span className="bg-yellow-100 px-1">{exc.highlight}</span></p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {exc.book_title || `Book #${exc.book_id}`} {exc.page_number && `· p. ${exc.page_number}`} {exc.chapter && `· ${exc.chapter}`}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <button onClick={() => handleEdit(exc)} className="text-primary-600 hover:text-primary-800 text-xs">{t('admin.edit')}</button>
                <button onClick={() => handleDelete(exc.id)} className="text-red-600 hover:text-red-800 text-xs">{t('admin.delete')}</button>
              </div>
            </div>
          </div>
        ))}
        {excerpts.length === 0 && <p className="text-gray-500 text-sm">{t('common.noData')}</p>}
      </div>
    </div>
  );
}
