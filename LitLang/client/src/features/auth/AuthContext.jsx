import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import api from '../../lib/axiosInstance';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: true, isLoading: false };
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const setToken = useCallback((token) => {
    window.__litlang_access_token = token;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    setToken(null);
    dispatch({ type: 'LOGOUT' });
  }, [setToken]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.data.accessToken);
    dispatch({ type: 'SET_USER', payload: data.data.user });
    return data.data.user;
  }, [setToken]);

  const register = useCallback(async (email, password, display_name) => {
    const { data } = await api.post('/auth/register', { email, password, display_name });
    setToken(data.data.accessToken);
    dispatch({ type: 'SET_USER', payload: data.data.user });
    return data.data.user;
  }, [setToken]);

  // Silent refresh on mount
  useEffect(() => {
    const tryRefresh = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setToken(data.data.accessToken);
        dispatch({ type: 'SET_USER', payload: data.data.user });
      } catch {
        dispatch({ type: 'LOGOUT' });
      }
    };
    tryRefresh();
  }, [setToken]);

  // Listen for forced logout from axios interceptor
  useEffect(() => {
    const handleLogout = () => {
      setToken(null);
      dispatch({ type: 'LOGOUT' });
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [setToken]);

  const value = {
    ...state,
    isAdmin: state.user?.role === 'admin',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
