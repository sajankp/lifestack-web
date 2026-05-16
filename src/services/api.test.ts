import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/setup';
import api, { onUnauthorized, onSessionExtended } from './api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

describe('api — refresh interceptor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('passes withCredentials on every request', async () => {
    server.use(http.get(`${BASE_URL}/v1/auth/me`, () => HttpResponse.json({ username: 'test' })));
    const res = await api.get('/v1/auth/me');
    expect(res.status).toBe(200);
    // axios withCredentials is set at the instance level; we verify no Authorization header is used
    expect(res.config.withCredentials).toBe(true);
    expect(res.config.headers?.Authorization).toBeUndefined();
  });

  it('retries original request once after successful token refresh on 401', async () => {
    let meCallCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/auth/me`, () => {
        meCallCount++;
        if (meCallCount === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ username: 'test' });
      }),
      http.post(`${BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 200 })),
    );

    const res = await api.get('/v1/auth/me');
    expect(res.status).toBe(200);
    expect(meCallCount).toBe(2); // failed + retried
  });

  it('coalesces concurrent 401s into a single refresh call', async () => {
    let refreshCallCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/todos`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshCallCount++;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    // Fire three requests simultaneously — all will 401
    await Promise.allSettled([
      api.get('/v1/todos'),
      api.get('/v1/todos'),
      api.get('/v1/todos'),
    ]);

    // Only one refresh request should have been made
    expect(refreshCallCount).toBe(1);
  });

  it('calls onUnauthorized callbacks when refresh itself returns 401', async () => {
    const cb = vi.fn();
    const unsubscribe = onUnauthorized(cb);

    server.use(
      http.get(`${BASE_URL}/v1/auth/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    );

    await expect(api.get('/v1/auth/me')).rejects.toThrow();
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('calls onSessionExtended callbacks after successful refresh', async () => {
    const cb = vi.fn();
    const unsubscribe = onSessionExtended(cb);
    let meCallCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/auth/me`, () => {
        meCallCount++;
        if (meCallCount === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ username: 'test' });
      }),
      http.post(`${BASE_URL}/auth/refresh`, () => new HttpResponse(null, { status: 200 })),
    );

    await api.get('/v1/auth/me');
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does not retry the refresh endpoint itself (no infinite loop)', async () => {
    let refreshCallCount = 0;

    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshCallCount++;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    await expect(api.post('/auth/refresh')).rejects.toThrow();
    expect(refreshCallCount).toBe(1); // Called exactly once, not retried
  });
});
