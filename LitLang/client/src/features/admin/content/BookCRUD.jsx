import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import Spinner from '../../../components/Spinner';

export default function BookCRUD() {
  const { t } = useTranslation();
  const { get, post, put, del, loading, error } = useApi();
  const [books, setBooks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [isbnLookup, setIsbnLookup] = useState('');
  const [form, setForm] = useState({
    title: '', author: '', isbn: '', language_id: '', cover_url: '', gutenberg_id: '',
  });
  const [languages, setLanguages] = useState([]);

  const fetchBooks = useCallback(async () => {
    try {
      const res = await get('/books', { params: { limit: 100, page: 1 } });
      setBooks(res.data || res);
    } catch {}
  }, [get]);

  const fetchLanguages = useCallback(async () => {
    try {
      const res = await get('/languages');
      setLanguages(res.data || res);
    } catch {}
  }, [get]);

  useEffect(() => { fetchBooks(); fetchLanguages(); }, [fetchBooks, fetchLanguages]);

  const resetForm = () => {
    setForm({ title: '', author: '', isbn: '', language_id: '', cover_url: '', gutenberg_id: '' });
    setEditing(null);
  };

  const handleIsbnLookup = async () => {
    if (!isbnLookup.trim()) return;
    try {
      const res = await get(`/admin/books/lookup?isbn=${encodeURIComponent(isbnLookup)}`);
      const book = res?.data ?? res;
      if (book) {
        setForm((prev) => ({
          ...prev,
          title: book.title || prev.title,
          author: book.author || prev.author,
          isbn: isbnLookup,
          cover_url: book.cover_url || prev.cover_url,
        }));
      }
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (payload.language_id) payload.language_id = Number(payload.language_id);
    if (payload.gutenberg_id) payload.gutenberg_id = Number(payload.gutenberg_id);
    if (!payload.language_id) delete payload.language_id;
    if (!payload.gutenberg_id) delete payload.gutenberg_id;
    if (!payload.isbn) delete payload.isbn;
    if (!payload.cover_url) delete payload.cover_url;
    try {
      if (editing) {
        await put(`/admin/books/${editing}`, payload);
      } else {
        await post('/admin/books', payload);
      }
      resetForm();
      fetchBooks();
    } catch {}
  };

  const handleEdit = (book) => {
    setEditing(book.id);
    setForm({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      language_id: book.language_id ? String(book.language_id) : '',
      cover_url: book.cover_url || '',
      gutenberg_id: book.gutenberg_id ? String(book.gutenberg_id) : '',
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.confirm'))) return;
    try {
      await del(`/admin/books/${id}`);
      if (editing === id) resetForm();
      fetchBooks();
    } catch {}
  };

  if (loading && books.length === 0) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.books')}</h1>

      {/* ISBN Lookup */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-accent-700 mb-2">ISBN Lookup (Open Library)</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={isbnLookup}
            onChange={(e) => setIsbnLookup(e.target.value)}
            className="flex-1 border rounded-md px-3 py-2 text-sm"
            placeholder="Enter ISBN..."
          />
          <button
            onClick={handleIsbnLookup}
            className="px-4 py-2 bg-accent-700 text-white rounded-md text-sm hover:bg-accent-800"
          >
            Lookup
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {editing ? t('admin.edit') : t('admin.create')}
        </h2>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
            <input
              type="text"
              value={form.isbn}
              onChange={(e) => setForm({ ...form, isbn: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              value={form.language_id}
              onChange={(e) => setForm({ ...form, language_id: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">— None —</option>
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover URL</label>
            <input
              type="text"
              value={form.cover_url}
              onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gutenberg ID</label>
            <input
              type="number"
              value={form.gutenberg_id}
              onChange={(e) => setForm({ ...form, gutenberg_id: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ISBN</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {books.map((book) => (
              <tr key={book.id}>
                <td className="px-4 py-3 text-sm">{book.id}</td>
                <td className="px-4 py-3 text-sm">{book.title}</td>
                <td className="px-4 py-3 text-sm">{book.author}</td>
                <td className="px-4 py-3 text-sm font-mono">{book.isbn || '—'}</td>
                <td className="px-4 py-3 text-sm">
                  <button onClick={() => handleEdit(book)} className="text-primary-600 hover:text-primary-800 text-xs mr-2">
                    {t('admin.edit')}
                  </button>
                  <button onClick={() => handleDelete(book.id)} className="text-red-600 hover:text-red-800 text-xs">
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
