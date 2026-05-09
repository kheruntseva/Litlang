import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Spinner size="lg" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}
