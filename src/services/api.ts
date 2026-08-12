import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { reportException } from '../lib/analytics';

// ─── Axios instance ───────────────────────────────────────────────────────────

const baseURL = import.meta.env.VITE_API_URL;
if (import.meta.env.PROD && !baseURL) {
  throw new Error('VITE_API_URL must be configured in production/staging environments');
}

const api = axios.create({
  baseURL: baseURL ?? 'http://localhost:8000/v1',
  withCredentials: true, // Send HttpOnly cookies on every request
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
  _csrfTokenMirrored?: boolean;
  _retryCount?: number;
};

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  if (typeof document.cookie !== 'string') return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`));
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const requestConfig = config as RetryableRequestConfig;
  const headers = AxiosHeaders.from(config.headers);
  config.headers = headers;
  const method = config.method?.toLowerCase();
  if (method && MUTATING_METHODS.has(method)) {
    const csrfToken = readCookie('csrf_token');
    if (!headers.has('X-CSRF-Token') && csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
      requestConfig._csrfTokenMirrored = true;
    }
  }

  if (config.data instanceof FormData) {
    headers.delete('Content-Type');
    return config;
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return config;
});

// ─── Auth observers ───────────────────────────────────────────────────────────
// Components subscribe to these to react to session changes without coupling
// the API layer to the React component tree.

type EventCallback = () => void;
const unauthorizedCallbacks: EventCallback[] = [];
const sessionExtendedCallbacks: EventCallback[] = [];

export const onUnauthorized = (cb: EventCallback) => {
  unauthorizedCallbacks.push(cb);
  return () => {
    const i = unauthorizedCallbacks.indexOf(cb);
    if (i > -1) unauthorizedCallbacks.splice(i, 1);
  };
};

export const onSessionExtended = (cb: EventCallback) => {
  sessionExtendedCallbacks.push(cb);
  return () => {
    const i = sessionExtendedCallbacks.indexOf(cb);
    if (i > -1) sessionExtendedCallbacks.splice(i, 1);
  };
};

// ─── Refresh mutex ────────────────────────────────────────────────────────────
// Coalesces concurrent 401s into a single refresh request. All waiting
// requests retry once the single refresh resolves.

let refreshPromise: Promise<void> | null = null;
let refreshFailed = false;

const attemptRefresh = (): Promise<void> => {
  if (refreshFailed) {
    return Promise.reject(new Error('Refresh already failed'));
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = api
    .post('/auth/refresh')
    .then(() => {
      refreshFailed = false;
      [...sessionExtendedCallbacks].forEach((cb) => {
        try {
          cb();
        } catch (e) {
          reportException(e, 'session_extended_callback');
        }
      });
    })
    .catch((err: AxiosError) => {
      // Only force logout on definitive auth failures (401/403).
      // Network errors let the original request fail naturally.
      if (err.response?.status === 401 || err.response?.status === 403) {
        refreshFailed = true;
        [...unauthorizedCallbacks].forEach((cb) => {
          try {
            cb();
          } catch (e) {
            reportException(e, 'unauthorized_callback');
          }
        });
      }
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// ─── Response interceptor ─────────────────────────────────────────────────────

const isNetworkError = (error: AxiosError) => {
  return (
    error.code === 'ERR_NETWORK' ||
    error.code === 'NETWORK_ERROR' ||
    error.message === 'Network Error' ||
    (!error.response && error.code !== 'ECONNABORTED')
  );
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(
  (response) => {
    refreshFailed = false;
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as RetryableRequestConfig | undefined;

    // Retry network errors with exponential backoff (up to 2 retries) - GET requests only
    if (original && isNetworkError(error) && original.method?.toLowerCase() === 'get') {
      const retryCount = original._retryCount || 0;
      if (retryCount < 2) {
        original._retryCount = retryCount + 1;
        const backoffDelay = retryCount === 0 ? 500 : 1000;
        await delay(backoffDelay);
        return api(original);
      }
    }

    // Only intercept 401s — and never retry the refresh call itself to avoid loops.
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !refreshFailed &&
      !original.url?.endsWith('/auth/refresh')
    ) {
      original._retried = true;
      try {
        await attemptRefresh();
        if (original._csrfTokenMirrored) {
          const headers = AxiosHeaders.from(original.headers);
          headers.delete('X-CSRF-Token');
          original.headers = headers;
          original._csrfTokenMirrored = false;
        }
        return api(original); // Retry the original request
      } catch {
        // Refresh failed — propagate the original 401
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
