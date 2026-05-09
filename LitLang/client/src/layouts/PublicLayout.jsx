import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/AuthContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function PublicLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isAdmin, logout, user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-clip">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-300/35 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-accent-200/30 blur-3xl" />
      {/* Header */}
      <header className="bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/85 shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold text-accent-700 tracking-tight">
                {t('app.title')}
              </Link>
              <nav className="hidden md:flex gap-4">
                <Link to="/" className="text-slate-600 hover:text-accent-700 text-[15px] font-medium transition-colors">
                  {t('nav.home')}
                </Link>
                <Link to="/search" className="text-slate-600 hover:text-accent-700 text-[15px] font-medium transition-colors">
                  {t('nav.search')}
                </Link>
                {isAuthenticated && (
                  <Link to="/catalog" className="text-slate-600 hover:text-accent-700 text-[15px] font-medium transition-colors">
                    {t('nav.catalog')}
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="text-[15px] text-slate-600 hover:text-accent-700 font-medium transition-colors">
                    {t('nav.dashboard')}
                  </Link>
                  <Link to="/favourites" className="text-[15px] text-slate-600 hover:text-accent-700 font-medium transition-colors">
                    {t('nav.favourites')}
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="text-[15px] text-slate-600 hover:text-accent-700 font-medium transition-colors">
                      {t('nav.admin')}
                    </Link>
                  )}
                  <span className="text-sm text-slate-500">{user?.display_name}</span>
                  <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                  >
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-[15px] text-slate-600 hover:text-accent-700 font-medium transition-colors"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm px-4 py-2 bg-accent-700 text-white rounded-lg hover:bg-accent-800 shadow-sm transition-all"
                  >
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white/90 border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          {t('app.title')} &mdash; {t('app.subtitle')}
        </div>
      </footer>
    </div>
  );
}
