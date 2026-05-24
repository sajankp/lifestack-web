import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      isAuthResolved: false,
      user: null,
    });
  });

  it('sets auth resolved flag', () => {
    useAuthStore.getState().setAuthResolved(true);
    expect(useAuthStore.getState().isAuthResolved).toBe(true);
  });

  it('sets session and marks authenticated/resolved', () => {
    useAuthStore.getState().setSession({
      public_id: 'p1',
      email: 'user@example.com',
      username: 'user',
      is_active: true,
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isAuthResolved).toBe(true);
    expect(state.user?.username).toBe('user');
  });

  it('clears session and keeps auth resolved', () => {
    useAuthStore.getState().setSession({
      public_id: 'p1',
      email: 'user@example.com',
      username: 'user',
      is_active: true,
    });

    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isAuthResolved).toBe(true);
    expect(state.user).toBeNull();
  });
});
