import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import api from '../../../lib/axiosInstance';
import Spinner from '../../../components/Spinner';

export default function RuleCRUD() {
  const { t } = useTranslation();
  const { get, post, put, del, loading } = useApi();
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    category_id: '', slug: '', sort_order: 0,
    title_en: '', summary_en: '', title_ru: '', summary_ru: '',
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
      setRules(res.data || res);
    } catch {}
  }, [get, selectedCat]);

  useEffect(() => { fetchLanguages(); }, [fetchLanguages]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchRules(); }, [fetchRules]);

  const resetForm = () => {
    setForm({ category_id: selectedCat, slug: '', sort_order: 0, title_en: '', summary_en: '', title_ru: '', summary_ru: '' });
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Always include EN; only include RU if title is non-empty
    const translations = [
      { locale: 'en', title: form.title_en, summary: form.summary_en },
    ];
    if (form.title_ru.trim()) {
      translations.push({
        locale: 'ru',
        title: form.title_ru.trim(),
        summary: form.summary_ru.trim() || form.summary_en,
      });
    }
    const payload = {
      category_id: Number(form.category_id || selectedCat),
      slug: form.slug,
      sort_order: Number(form.sort_order),
      translations,
    };
    try {
      if (editing) {
        await put(`/admin/rules/${editing}`, payload);
      } else {
        await post('/admin/rules', payload);
      }
      resetForm();
      fetchRules();
    } catch {}
  };

  const handleEdit = async (rule) => {
    setEditing(rule.id);
    // Fetch both locale translations to pre-fill all fields correctly
    try {
      const [enRes, ruRes] = await Promise.all([
        api.get(`/rules/${rule.id}`, { headers: { 'Accept-Language': 'en' } }),
        api.get(`/rules/${rule.id}`, { headers: { 'Accept-Language': 'ru' } }),
      ]);
      const en = enRes.data?.data ?? enRes.data ?? {};
      const ru = ruRes.data?.data ?? ruRes.data ?? {};
      setForm({
        category_id: String(rule.category_id),
        slug: rule.slug || '',
        sort_order: rule.sort_order || 0,
        title_en: en.title || '',
        summary_en: en.summary || '',
        title_ru: ru.title || '',
        summary_ru: ru.summary || '',
      });
    } catch {
      setForm({
        category_id: String(rule.category_id),
        slug: rule.slug || '',
        sort_order: rule.sort_order || 0,
        title_en: rule.title || '',
        summary_en: rule.summary || '',
        title_ru: '',
        summary_ru: '',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.confirm'))) return;
    try {
      await del(`/admin/rules/${id}`);
      fetchRules();
    } catch {}
  };

  if (loading && rules.length === 0 && languages.length === 0) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.rules')}</h1>

      <div className="flex gap-4 mb-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Language:</label>
          <select
            value={selectedLang}
            onChange={(e) => { setSelectedLang(e.target.value); setSelectedCat(''); }}
            className="border rounded-md px-3 py-2 text-sm"
          >
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">Category:</label>
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.title}</option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {editing ? t('admin.edit') : t('admin.create')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="definite-article-the"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (EN)</label>
            <input
              type="text"
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (RU)</label>
            <input
              type="text"
              value={form.title_ru}
              onChange={(e) => setForm({ ...form, title_ru: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Summary (EN)</label>
            <textarea
              value={form.summary_en}
              onChange={(e) => setForm({ ...form, summary_en: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              rows={4}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Summary (RU) <span className="text-gray-400 text-xs">(optional — falls back to EN if blank)</span>
            </label>
            <textarea
              value={form.summary_ru}
              onChange={(e) => setForm({ ...form, summary_ru: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              rows={4}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700">
            {t('admin.save')}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm">
              {t('admin.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-4 py-3 text-sm">{rule.id}</td>
                <td className="px-4 py-3 text-sm font-mono">{rule.slug}</td>
                <td className="px-4 py-3 text-sm">{rule.title}</td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <button onClick={() => handleEdit(rule)} className="text-primary-600 hover:text-primary-800 text-xs">
                    {t('admin.edit')}
                  </button>
                  <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-800 text-xs">
                    {t('admin.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
