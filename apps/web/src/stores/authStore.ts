import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;

  // Actions
  login: (user: User, token: string, refreshToken: string, expiresIn?: number) => void;
  setTokens: (token: string, refreshToken: string, expiresIn?: number) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
  isTokenValid: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      tokenExpiry: null,
      isAuthenticated: false,
      _hasHydrated: false,

      login: (user, token, refreshToken, expiresIn = 86400) => {
        const tokenExpiry = Date.now() + expiresIn * 1000;
        set({
          user,
          token,
          refreshToken,
          tokenExpiry,
          isAuthenticated: true,
        });
      },

      setTokens: (token, refreshToken, expiresIn = 86400) => {
        const tokenExpiry = Date.now() + expiresIn * 1000;
        set({
          token,
          refreshToken,
          tokenExpiry,
        });
      },

      setUser: (user) =>
        set({
          user,
        }),

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          tokenExpiry: null,
          isAuthenticated: false,
        });
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      isTokenValid: () => {
        const { token, tokenExpiry } = get();
        if (!token || !tokenExpiry) return false;
        // Consider token invalid if it expires in less than 5 minutes
        return tokenExpiry > Date.now() + 5 * 60 * 1000;
      },
    }),
    {
      name: 'ordermind-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        tokenExpiry: state.tokenExpiry,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Check if token is still valid on rehydration
        if (state) {
          const isValid = state.token && state.tokenExpiry && state.tokenExpiry > Date.now();
          if (!isValid && state.isAuthenticated) {
            // Token expired, clear auth state
            state.logout();
          }
          state.setHasHydrated(true);
        }
      },
    }
  )
);

// Hook to wait for hydration
export const useAuthHydration = () => {
  return useAuthStore((state) => state._hasHydrated);
};
