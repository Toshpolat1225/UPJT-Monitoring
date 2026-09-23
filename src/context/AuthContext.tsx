import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import axios from 'axios';
import apiClient, { IDLE_TIMEOUT_MS, markSessionActivity } from '../lib/client';
import type { AppRole } from '../types';

interface LocalSession {
  access_token: string;
  token_type: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  department_id: string | null;
  company_id: string | null;
  created_at: string;
  roles?: AppRole[];
}

interface AuthState {
  user: Profile | null;
  session: LocalSession | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  companyId: string | null;
  isAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  hasAny: (r: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: true,
  companyId: null,
  isAdmin: false,
  hasRole: () => false,
  hasAny: () => false,
  signOut: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LocalSession | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('lastActivityAt');
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setLoading(false);
  }, []);

  const loadProfile = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken');

    if (!accessToken) {
      clearAuthState();
      return;
    }

    try {
      const { data } = await apiClient.get('/users/me');
      const normalizedProfile: Profile = {
        id: data.id,
        full_name: data.full_name ?? null,
        email: data.email ?? null,
        department_id: data.department_id ?? null,
        company_id: data.company_id ?? null,
        created_at: data.created_at,
        roles: Array.isArray(data.roles) ? data.roles : [],
      };

      markSessionActivity();
      setSession({ access_token: accessToken, token_type: 'bearer' });
      setUser(normalizedProfile);
      setProfile(normalizedProfile);
      setRoles(normalizedProfile.roles ?? []);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearAuthState();
      } else {
        console.error('Failed to load local profile:', error);
        setSession({ access_token: accessToken, token_type: 'bearer' });
      }
    } finally {
      setLoading(false);
    }
  }, [clearAuthState]);

  const signOut = useCallback(async () => {
    clearAuthState();
  }, [clearAuthState]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const handleActivity = () => {
      markSessionActivity();
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    for (const event of events) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    const timer = window.setInterval(() => {
      const lastActivityAt = Number(localStorage.getItem('lastActivityAt') ?? 0);
      if (!lastActivityAt || Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) {
        void signOut();
      }
    }, 30_000);

    return () => {
      for (const event of events) {
        window.removeEventListener(event, handleActivity);
      }
      window.clearInterval(timer);
    };
  }, [session, signOut]);

  const value: AuthState = {
    user,
    session,
    profile,
    roles,
    loading,
    companyId: profile?.company_id ?? null,
    isAdmin: roles.includes('admin'),
    hasRole: (r) => roles.includes(r),
    hasAny: (rs) => rs.some((r) => roles.includes(r)),
    signOut,
    refresh: async () => {
      await loadProfile();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
