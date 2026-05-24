import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';

import { authService } from './auth';
import { server } from '../test/setup';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

describe('authService', () => {
  it('submits login as form-urlencoded with username/password fields', async () => {
    let contentType = '';
    let bodyText = '';
    server.use(
      http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
        contentType = request.headers.get('content-type') ?? '';
        bodyText = await request.text();
        return HttpResponse.json({ access_token: 'token' });
      }),
    );

    const res = await authService.login('u@example.com', 'secret');
    expect(res.access_token).toBe('token');
    expect(contentType).toContain('application/x-www-form-urlencoded');
    expect(bodyText).toContain('username=u%40example.com');
    expect(bodyText).toContain('password=secret');
  });

  it('registers using JSON payload', async () => {
    let payload: Record<string, unknown> | null = null;
    server.use(
      http.post(`${BASE_URL}/auth/register`, async ({ request }) => {
        payload = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    const res = await authService.register('e@example.com', 'pw', 'name');
    expect(res.ok).toBe(true);
    expect(payload).toEqual({
      email: 'e@example.com',
      password: 'pw',
      username: 'name',
    });
  });

  it('checks auth via /auth/me', async () => {
    server.use(
      http.get(`${BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          public_id: 'p1',
          email: 'e@example.com',
          username: 'name',
          is_active: true,
        }),
      ),
    );

    const user = await authService.checkAuth();
    expect(user.username).toBe('name');
  });

  it('logs out via /auth/logout', async () => {
    let called = 0;
    server.use(
      http.post(`${BASE_URL}/auth/logout`, () => {
        called += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await authService.logout();
    expect(called).toBe(1);
  });
});
