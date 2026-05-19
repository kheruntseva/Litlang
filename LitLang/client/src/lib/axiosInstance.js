import axios from 'axios';
import i18n from '../i18n';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

// Request interceptor: default Accept-Language (do not override per-request locale)
api.interceptors.request.use((config) => {
  const headers = config.headers || {};
  const explicit =
    headers['Accept-Language'] ??
    headers['accept-language'];
  if (explicit === undefined || explicit === null || String(explicit).trim() === '') {
    headers['Accept-Language'] = i18n.language || 'en';
    config.headers = headers;
  }
  // Access token is set dynamically by AuthContext
  const token = window.__litlang_access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 with silent refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const newToken = data.data.accessToken;
        window.__litlang_access_token = newToken;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.__litlang_access_token = null;
        // Dispatch custom event so AuthContext can handle logout
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
