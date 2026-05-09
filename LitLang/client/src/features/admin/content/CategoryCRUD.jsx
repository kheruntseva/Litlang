import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import api from '../../../lib/axiosInstance';
import Spinner from '../../../components/Spinner';

export default function CategoryCRUD() {
  const { t } = useTranslation();
  const { get, post, put, del, loading } = useApi();
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    language_id: '', slug: '', sort_order: 0,
    title_en: '', title_ru: '',
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
      setCategories(res.data || res);
    } catch {}
  }, [get, selectedLang]);

  useEffect(() => { fetchLanguages(); }, [fetchLanguages]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const resetForm = () => {
    setForm({ language_id: selectedLang, slug: '', sort_order: 0, title_en: '', title_ru: '' });
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Always send EN; only include RU if non-empty
    const translations = [{ locale: 'en', title: form.title_en }];
    if (form.title_ru.trim()) translations.push({ locale: 'ru', title: form.title_ru.trim() });

    const payload = {
      language_id: Number(form.language_id || selectedLang),
      slug: form.slug,
      sort_order: Number(form.sort_order),
      translations,
    };
    try {
      if (editing) {
        await put(`/admin/categories/${editing}`, payload);
      } else {
        await post('/admin/categories', payload);
      }
      resetForm();
      fetchCategories();
    } catch {}
  };

  const handleEdit = async (cat) => {
    setEditing(cat.id);
    // Fetch both locale translations explicitly so neither field shows the wrong language
    try {
      const [enRes, ruRes] = await Promise.all([
        api.get(`/languages/${cat.language_id}/categories`, { headers: { 'Accept-Language': 'en' } }),
        api.get(`/languages/${cat.language_id}/categories`, { headers: { 'Accept-Language': 'ru' } }),
      ]);
      const enList = enRes.data?.data ?? enRes.data ?? [];
      const ruList = ruRes.data?.data ?? ruRes.data ?? [];
      const enCat = enList.find((c) => c.id === cat.id);
      const ruCat = ruList.find((c) => c.id === cat.id);
      setForm({
        language_id: String(cat.language_id),
        slug: cat.slug || '',
        sort_order: cat.sort_order || 0,
        title_en: enCat?.title || '',
        title_ru: ruCat?.title || '',
      });
    } catch {
      setForm({
        language_id: String(cat.language_id),
        slug: cat.slug || '',
        sort_order: cat.sort_order || 0,
        title_en: cat.title || '',
        title_ru: '',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.confirm'))) return;
    try {
      await del(`/admin/categories/${id}`);
      fetchCategories();
    } catch {}
  };

  if (loading && categories.length === 0 && languages.length === 0) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.categories')}</h1>

      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mr-2">Language:</label>
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          {languages.map((lang) => (
            <option key={lang.id} value={lang.id}>{lang.name} ({lang.code})</option>
          ))}
        </select>
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
              placeholder="articles"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (EN) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Articles"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (RU) <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={form.title_ru}
              onChange={(e) => setForm({ ...form, title_ru: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Артикли"
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="px-4 py-3 text-sm">{cat.id}</td>
                <td className="px-4 py-3 text-sm font-mono">{cat.slug}</td>
                <td className="px-4 py-3 text-sm">{cat.title}</td>
                <td className="px-4 py-3 text-sm">{cat.sort_order}</td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <button onClick={() => handleEdit(cat)} className="text-primary-600 hover:text-primary-800 text-xs">
                    {t('admin.edit')}
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:text-red-800 text-xs">
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
