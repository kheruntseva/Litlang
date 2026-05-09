import { Routes, Route } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Public pages
import HomePage from './features/languages/HomePage';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import CategoryListPage from './features/categories/CategoryListPage';
import RuleListPage from './features/rules/RuleListPage';
import RuleDetailPage from './features/rules/RuleDetailPage';
import SearchResultsPage from './features/search/SearchResultsPage';

// User pages
import UserDashboard from './features/dashboard/UserDashboard';
import FavouritesPage from './features/favourites/FavouritesPage';
import BookCatalogPage from './features/catalog/BookCatalogPage';

// Admin pages
import AdminDashboardPage from './features/admin/analytics/AnalyticsDashboard';
import LanguageCRUD from './features/admin/content/LanguageCRUD';
import CategoryCRUD from './features/admin/content/CategoryCRUD';
import RuleCRUD from './features/admin/content/RuleCRUD';
import BookCRUD from './features/admin/content/BookCRUD';
import ExcerptCRUD from './features/admin/content/ExcerptCRUD';
import UserListPage from './features/admin/users/UserListPage';
import AISuggestPanel from './features/admin/ai/AISuggestPanel';
import GutenbergSearchPanel from './features/admin/gutenberg/GutenbergSearchPanel';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/languages/:langId" element={<CategoryListPage />} />
        <Route path="/categories/:catId/rules" element={<RuleListPage />} />
        <Route path="/rules/:ruleId" element={<RuleDetailPage />} />
        <Route path="/search" element={<SearchResultsPage />} />

        {/* Protected user routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/catalog" element={<BookCatalogPage />} />
          <Route path="/favourites" element={<FavouritesPage />} />
        </Route>
      </Route>

      {/* Admin routes */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/content/languages" element={<LanguageCRUD />} />
          <Route path="/admin/content/categories" element={<CategoryCRUD />} />
          <Route path="/admin/content/rules" element={<RuleCRUD />} />
          <Route path="/admin/content/books" element={<BookCRUD />} />
          <Route path="/admin/content/excerpts" element={<ExcerptCRUD />} />
          <Route path="/admin/users" element={<UserListPage />} />
          <Route path="/admin/ai" element={<AISuggestPanel />} />
          <Route path="/admin/gutenberg" element={<GutenbergSearchPanel />} />
        </Route>
      </Route>
    </Routes>
  );
}
