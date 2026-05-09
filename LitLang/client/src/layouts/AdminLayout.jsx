import { Outlet, Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

const navItems = [
  { key: 'admin.dashboard', path: '/admin', end: true },
  { key: 'admin.languages', path: '/admin/content/languages' },
  { key: 'admin.categories', path: '/admin/content/categories' },
  { key: 'admin.rules', path: '/admin/content/rules' },
  { key: 'admin.books', path: '/admin/content/books' },
  { key: 'admin.excerpts', path: '/admin/content/excerpts' },
  { key: 'admin.users', path: '/admin/users' },
  { key: 'admin.aiTools', path: '/admin/ai' },
  { key: 'admin.gutenberg', path: '/admin/gutenberg' },
];

export default function AdminLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-transparent text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white/90 border-r border-primary-200 shadow-sm flex flex-col backdrop-blur">
        <div className="p-4 border-b border-primary-200">
          <Link to="/" className="text-lg font-bold text-accent-700">
            {t('app.title')}
          </Link>
          <p className="text-xs text-slate-500 mt-1">{t('admin.title')}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ key, path, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm ${
                  isActive
                    ? 'bg-primary-100 text-accent-700 border border-primary-300 font-semibold'
                    : 'text-slate-600 hover:bg-primary-50'
                }`
              }
            >
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-primary-200 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-accent-700 font-medium transition-colors"
          >
            <span>←</span>
            <span>{t('admin.backToSite')}</span>
          </Link>
          <p className="text-xs text-slate-400">{user?.display_name}</p>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button onClick={logout} className="text-xs text-red-600 hover:text-red-700 transition-colors">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
