import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../services/auth';

interface AuthState {
  isAuthenticated: boolean;
  isAuthResolved: boolean;
  user: AuthUser | null;
  setAuthResolved: (value: boolean) => void;
  setSession: (user: AuthUser | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isAuthResolved: false,
      user: null,
      setAuthResolved: (value) => {
        set({ isAuthResolved: value });
      },
      setSession: (user) => {
        set({ isAuthenticated: true, isAuthResolved: true, user });
      },
      clearSession: () => {
        set({ isAuthenticated: false, isAuthResolved: true, user: null });
      },
    }),
    {
      name: 'lifestack-auth-session',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    },
  ),
);
