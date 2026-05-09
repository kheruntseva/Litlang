import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import Spinner from '../../../components/Spinner';

export default function LanguageCRUD() {
  const { t } = useTranslation();
  const { get, post, put, del, loading } = useApi();
  const [languages, setLanguages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '' });

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await get('/languages');
      setLanguages(res.data || res);
    } catch {}
  }, [get]);

  useEffect(() => { fetchLanguages(); }, [fetchLanguages]);

  const resetForm = () => { setForm({ code: '', name: '' }); setEditing(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await put(`/admin/languages/${editing}`, form);
      } else {
        await post('/admin/languages', form);
      }
      resetForm();
      fetchLanguages();
    } catch {}
  };

  const handleEdit = (lang) => {
    setEditing(lang.id);
    setForm({ code: lang.code, name: lang.name });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.confirm'))) return;
    try {
      await del(`/admin/languages/${id}`);
      fetchLanguages();
    } catch {}
  };

  if (loading && languages.length === 0) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.languages')}</h1>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {editing ? t('admin.edit') : t('admin.create')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code (ISO 639-1)</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="en"
              required
              maxLength={10}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="English"
              required
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {languages.map((lang) => (
              <tr key={lang.id}>
                <td className="px-4 py-3 text-sm">{lang.id}</td>
                <td className="px-4 py-3 text-sm font-mono">{lang.code}</td>
                <td className="px-4 py-3 text-sm">{lang.name}</td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <button onClick={() => handleEdit(lang)} className="text-primary-600 hover:text-primary-800 text-xs">
                    {t('admin.edit')}
                  </button>
                  <button onClick={() => handleDelete(lang.id)} className="text-red-600 hover:text-red-800 text-xs">
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
