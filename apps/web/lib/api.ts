import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
  : '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,      // include cookies (refresh token)
  timeout: 30_000,
});

// ── Attach access token from cookie/localStorage ─────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = getCookieValue('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auto-refresh on 401 ──────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        const newToken = data.data?.accessToken;
        if (newToken) {
          setCookieValue('accessToken', newToken, 15); // 15 minutes
          original.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(original);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed → force logout
        deleteCookie('accessToken');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ── Cookie helpers ───────────────────────────────────────────────
function getCookieValue(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

function setCookieValue(name: string, value: string, minutes: number) {
  const expires = new Date(Date.now() + minutes * 60_000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export { setCookieValue, deleteCookie };
