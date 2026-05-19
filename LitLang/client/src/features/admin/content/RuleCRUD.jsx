import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import api from '../../../lib/axiosInstance';
import { acceptLanguageForCourse, parseApiId } from '../../../lib/courseLocaleHeaders';
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
  const [formError, setFormError] = useState('');
  const rulesFetchCatRef = useRef(null);
  const categoriesFetchLangRef = useRef(null);
  const prevCategoryRef = useRef('');
  const [form, setForm] = useState({
    category_id: '', slug: '', sort_order: 0,
    title_en: '', summary_en: '', title_ru: '', summary_ru: '',
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
      categoriesFetchLangRef.current = null;
      setCategories([]);
      setSelectedCat('');
      return;
    }
    categoriesFetchLangRef.current = langId;
    try {
      const res = await get(
        `/languages/${langId}/categories`,
        acceptLanguageForCourse(languages, langId)
      );
      const cats = res.data || res;
      const catList = Array.isArray(cats) ? cats : [];
      if (categoriesFetchLangRef.current !== langId) return;
      setCategories(catList);
      if (catList.length > 0 && catList[0]?.id != null && !parseApiId(selectedCat)) {
        setSelectedCat(String(catList[0].id));
      }
    } catch {}
  }, [get, selectedLang, selectedCat, languages]);

  const fetchRules = useCallback(async () => {
    const catId = parseApiId(selectedCat);
    if (!catId) {
      rulesFetchCatRef.current = null;
      setRules([]);
      return;
    }
    rulesFetchCatRef.current = catId;
    setRules([]);
    try {
      const res = await get(
        `/categories/${catId}/rules`,
        acceptLanguageForCourse(languages, selectedLang)
      );
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(res) ? res : [];
      if (rulesFetchCatRef.current !== catId) return;
      setRules(list);
    } catch {}
  }, [get, selectedCat, selectedLang, languages]);

  useEffect(() => { fetchLanguages(); }, [fetchLanguages]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchRules(); }, [fetchRules]);

  useEffect(() => {
    if (!languages.length) return;
    const keys = new Set(languages.map((l) => String(l.id)));
    const cur = parseApiId(selectedLang);
    if (!cur || !keys.has(cur)) setSelectedLang(String(languages[0].id));
  }, [languages, selectedLang]);

  useEffect(() => {
    if (!categories.length) {
      setSelectedCat('');
      return;
    }
    const keys = new Set(categories.map((c) => String(c.id)));
    const cur = parseApiId(selectedCat);
    if (!cur || !keys.has(cur)) setSelectedCat(String(categories[0].id));
  }, [categories, selectedCat]);

  useEffect(() => {
    const cur = parseApiId(selectedCat);
    if (!cur) return;
    if (prevCategoryRef.current && prevCategoryRef.current !== cur) {
      setEditing(null);
      setFormError('');
      setForm({
        category_id: selectedCat,
        slug: '',
        sort_order: 0,
        title_en: '',
        summary_en: '',
        title_ru: '',
        summary_ru: '',
      });
    }
    prevCategoryRef.current = cur;
  }, [selectedCat]);

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
    setForm({ category_id: selectedCat, slug: '', sort_order: 0, title_en: '', summary_en: '', title_ru: '', summary_ru: '' });
    setEditing(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!languages.length) {
      setFormError('Список языков ещё не загрузился — подождите секунду и сохраните снова.');
      return;
    }
    if (!languages.find((l) => String(l.id) === String(parseApiId(selectedLang) || ''))) {
      setFormError('Выберите язык курса в списке.');
      return;
    }
    const titlePrimary = form.title_en.trim();
    const summaryPrimary = form.summary_en.trim();
    const titleSecondary = form.title_ru.trim();
    const summarySecondary = form.summary_ru.trim();

    const { primaryLocale, secondaryLocale } = localeBundle;
    const translations = [{ locale: primaryLocale, title: titlePrimary, summary: summaryPrimary }];
    if (summarySecondary) {
      translations.push({
        locale: secondaryLocale,
        title: titleSecondary || titlePrimary,
        summary: summarySecondary,
      });
    } else if (titleSecondary) {
      translations.push({
        locale: secondaryLocale,
        title: titleSecondary,
        summary: summarySecondary || titleSecondary,
      });
    }

    const payload = {
      category_id: Number(form.category_id || selectedCat),
      slug: form.slug,
      sort_order: Number(form.sort_order),
      translations,
    };
    setFormError('');
    try {
      if (editing) {
        await put(`/admin/rules/${editing}`, payload);
      } else {
        await post('/admin/rules', payload);
      }
      resetForm();
      fetchRules();
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message
        || err?.response?.data?.error?.details?.map?.((d) => d.msg || d.message)?.join?.('; ')
        || err?.message
        || t('common.error');
      setFormError(msg);
    }
  };

  const handleEdit = async (rule) => {
    setEditing(rule.id);
    setFormError('');
    const { primaryLocale, secondaryLocale } = localeBundle;
    const readBody = (settled) => {
      if (settled.status !== 'fulfilled') return {};
      const payload = settled.value?.data;
      return payload?.data ?? payload ?? {};
    };
    const axiosErr = (settled) => {
      if (settled.status !== 'rejected') return '';
      const d = settled.reason?.response?.data;
      return d?.error?.message || settled.reason?.message || '';
    };
    try {
      const [primarySettled, enFallbackSettled, secondarySettled] = await Promise.allSettled([
        api.get(`/rules/${rule.id}`, { headers: { 'Accept-Language': primaryLocale } }),
        api.get(`/rules/${rule.id}`, { headers: { 'Accept-Language': 'en' } }),
        api.get(`/rules/${rule.id}`, { headers: { 'Accept-Language': secondaryLocale } }),
      ]);
      const pRaw = readBody(primarySettled);
      const pEn = readBody(enFallbackSettled);
      const primary = (pRaw.title || pRaw.summary) ? pRaw : pEn;
      const secondary = readBody(secondarySettled);

      const titlePrimary = (primary.title && String(primary.title).trim()) || '';
      const summaryPrimary = (primary.summary && String(primary.summary).trim()) || '';
      setForm({
        category_id: String(rule.category_id),
        slug: rule.slug || '',
        sort_order: rule.sort_order || 0,
        title_en: titlePrimary,
        summary_en: summaryPrimary,
        title_ru: (secondary.title && String(secondary.title).trim()) || '',
        summary_ru: (secondary.summary && String(secondary.summary).trim()) || '',
      });
      if (!titlePrimary && !summaryPrimary) {
        setFormError(
          axiosErr(primarySettled)
            || axiosErr(enFallbackSettled)
            || t('common.error')
        );
      }
    } catch (err) {
      setFormError(err?.response?.data?.error?.message || err?.message || t('common.error'));
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.titleForCourseLanguage', { label: localeBundle.courseLabel })}
            </label>
            <input
              type="text"
              value={form.title_en}
              onChange={(e) => setForm({ ...form, title_en: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
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
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.summaryForCourseLanguage', { label: localeBundle.courseLabel })}
            </label>
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
              {t('admin.summaryForSecondaryLanguage', { label: localeBundle.secondaryLabel })}{' '}
              <span className="text-gray-400 text-xs">
                {t('admin.summarySecondaryHint')}
              </span>
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
          <tbody className="divide-y divide-gray-200" key={parseApiId(selectedCat) || 'none'}>
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
