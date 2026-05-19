import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import { acceptLanguageForCourse, parseApiId } from '../../../lib/courseLocaleHeaders';
import Spinner from '../../../components/Spinner';

export default function CategoryCRUD() {
  const { t } = useTranslation();
  const { get, post, put, del, loading } = useApi();
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    language_id: '', slug: '', sort_order: 0,
    title_en: '', title_ru: '',
  });

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await get('/languages');
      const langs = res.data || res;
      setLanguages(Array.isArray(langs) ? langs : []);
      const list = Array.isArray(langs) ? langs : [];
      if (list.length > 0 && list[0]?.id != null && !parseApiId(selectedLang)) {
        setSelectedLang(String(list[0].id));
      }
    } catch {}
  }, [get, selectedLang]);

  const fetchCategories = useCallback(async () => {
    const langId = parseApiId(selectedLang);
    if (!langId) {
      setCategories([]);
      return;
    }
    try {
      const res = await get(
        `/languages/${langId}/categories?all=1`,
        acceptLanguageForCourse(languages, langId)
      );
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(res) ? res : [];
      setCategories(list);
    } catch {}
  }, [get, selectedLang, languages]);

  useEffect(() => { fetchLanguages(); }, [fetchLanguages]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  useEffect(() => {
    if (!languages.length) return;
    const keys = new Set(languages.map((l) => String(l.id)));
    const cur = parseApiId(selectedLang);
    if (!cur || !keys.has(cur)) setSelectedLang(String(languages[0].id));
  }, [languages, selectedLang]);

  const localeBundle = useMemo(() => {
    const lang = languages.find((l) => String(l.id) === String(selectedLang));
    const primaryLocale = String(lang?.code || 'en')
      .trim()
      .toLowerCase()
      .slice(0, 10);
    const secondaryLocale = primaryLocale === 'ru' ? 'en' : 'ru';
    const secMeta = languages.find((l) => String(l.code || '').toLowerCase() === secondaryLocale);
    const courseLabel = lang ? `${lang.name} (${lang.code})` : primaryLocale;
    const secondaryLabel = secMeta ? `${secMeta.name} (${secMeta.code})` : secondaryLocale;
    return { primaryLocale, secondaryLocale, courseLabel, secondaryLabel };
  }, [languages, selectedLang]);

  const resetForm = () => {
    setForm({ language_id: selectedLang, slug: '', sort_order: 0, title_en: '', title_ru: '' });
    setEditing(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!languages.length) {
      setFormError('Список языков ещё не загрузился — подождите секунду и сохраните снова.');
      return;
    }
    const lang = languages.find((l) => String(l.id) === String(selectedLang));
    if (!lang) {
      setFormError('Выберите язык курса в списке.');
      return;
    }
    const { primaryLocale, secondaryLocale } = localeBundle;
    const translations = [{ locale: primaryLocale, title: form.title_en.trim() }];
    if (form.title_ru.trim()) translations.push({ locale: secondaryLocale, title: form.title_ru.trim() });

    const payload = {
      language_id: Number(form.language_id || selectedLang),
      slug: form.slug,
      sort_order: Number(form.sort_order),
      translations,
    };
    setFormError('');
    try {
      if (editing) {
        await put(`/admin/categories/${editing}`, payload);
      } else {
        await post('/admin/categories', payload);
      }
      resetForm();
      fetchCategories();
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message
        || err?.response?.data?.error?.details?.map?.((d) => d.msg || d.message)?.join?.('; ')
        || err?.message
        || t('common.error');
      setFormError(msg);
    }
  };

  const titleForLocale = (cat, loc) => {
    const code = String(loc || '').toLowerCase().slice(0, 10);
    const arr = cat.translations;
    if (Array.isArray(arr)) {
      const row = arr.find((x) => String(x.locale || '').toLowerCase().slice(0, 10) === code);
      if (row?.title != null && String(row.title).trim()) return String(row.title).trim();
    }
    if (String(cat.locale || '').toLowerCase().slice(0, 10) === code && cat.title) {
      return String(cat.title).trim();
    }
    return '';
  };

  const handleEdit = (cat) => {
    setEditing(cat.id);
    setFormError('');
    const lang = languages.find((l) => String(l.id) === String(cat.language_id ?? selectedLang));
    const primaryLocale = String(lang?.code || 'en')
      .trim()
      .toLowerCase()
      .slice(0, 10);
    const secondaryLocale = primaryLocale === 'ru' ? 'en' : 'ru';
    const primaryTitle = titleForLocale(cat, primaryLocale) || (cat.title && String(cat.title).trim()) || '';
    const secondaryTitle = titleForLocale(cat, secondaryLocale);
    setForm({
      language_id: String(cat.language_id ?? selectedLang),
      slug: cat.slug || '',
      sort_order: cat.sort_order || 0,
      title_en: primaryTitle,
      title_ru: secondaryTitle,
    });
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
        {formError ? (
          <p className="text-sm text-red-600 mb-4 whitespace-pre-wrap" role="alert">
            {formError}
          </p>
        ) : null}
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
              {t('admin.titleForCourseLanguage', { label: localeBundle.courseLabel })}{' '}
              <span className="text-red-500">*</span>
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
              {t('admin.titleForSecondaryLanguage', { label: localeBundle.secondaryLabel })}
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.titleForCourseLanguage', { label: localeBundle.courseLabel })}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {t('admin.titleForSecondaryLanguage', { label: localeBundle.secondaryLabel })}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="px-4 py-3 text-sm">{cat.id}</td>
                <td className="px-4 py-3 text-sm font-mono">{cat.slug}</td>
                <td className="px-4 py-3 text-sm">
                  {titleForLocale(cat, localeBundle.primaryLocale) || cat.title || '—'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {titleForLocale(cat, localeBundle.secondaryLocale) || '—'}
                </td>
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
