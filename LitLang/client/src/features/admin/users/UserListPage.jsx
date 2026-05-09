import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../../hooks/useApi';
import Spinner from '../../../components/Spinner';

export default function UserListPage() {
  const { t } = useTranslation();
  const { get, patch, del, loading } = useApi();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    try {
      const res = await get(`/admin/users?page=${page}&limit=${limit}`);
      setUsers(res.data || res);
      setTotal(res.total ?? 0);
    } catch {}
  }, [get, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Change ${user.email} role to ${newRole}?`)) return;
    try {
      await patch(`/admin/users/${user.id}`, { role: newRole });
      fetchUsers();
    } catch {}
  };

  const handleToggleActive = async (user) => {
    try {
      await patch(`/admin/users/${user.id}`, { is_active: !user.is_active });
      fetchUsers();
    } catch {}
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Deactivate ${user.email}?`)) return;
    try {
      await del(`/admin/users/${user.id}`);
      fetchUsers();
    } catch {}
  };

  if (loading && users.length === 0) return <Spinner size="lg" />;

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.users')}</h1>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-sm">{u.email}</td>
                <td className="px-4 py-3 text-sm">{u.display_name}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.role === 'admin' ? 'bg-accent-100 text-accent-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={u.is_active ? 'text-green-600' : 'text-red-600'}>
                    {u.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm space-x-2">
                  <button
                    onClick={() => handleToggleRole(u)}
                    className="text-primary-600 hover:text-primary-800 text-xs"
                  >
                    Toggle Role
                  </button>
                  <button
                    onClick={() => handleToggleActive(u)}
                    className="text-yellow-600 hover:text-yellow-800 text-xs"
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    {t('admin.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            {t('common.previous')}
          </button>
          <span className="px-3 py-1 text-sm">
            {page} {t('common.of')} {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-50"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
