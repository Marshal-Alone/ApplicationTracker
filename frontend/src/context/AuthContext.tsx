import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AiServiceStatus, FresherProfile, ResumeContext } from '@/types/tracker';

export interface User {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  skills?: string[];
  targetRoles?: string[];
  experienceYears?: number;
  resumeContext?: ResumeContext | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
  code?: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  skills?: string[];
  targetRoles?: string[];
  experienceYears?: number;
  resumeContext?: ResumeContext | null;
}

export interface BuildResumeContextInput {
  fileName?: string;
  mimeType?: string;
  fileDataBase64?: string;
  resumeText?: string;
  targetRolesHint?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  backendUrl: string;
  setBackendUrl: (nextUrl: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (nextKey: string) => void;
  aiStatus: AiServiceStatus;
  fresherProfile: FresherProfile;
  saveFresherProfile: (updates: Partial<FresherProfile>) => Promise<AuthResult>;
  buildAiResumeContext: (input: BuildResumeContextInput) => Promise<AuthResult & { resumeContext?: ResumeContext }>;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  updateProfile: (payload: string | ProfileUpdatePayload) => Promise<AuthResult>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  regenerateApiKey: () => Promise<string | null>;
  deleteAccount: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL_STORAGE_KEY = 'at_backend_url';
const TOKEN_STORAGE_KEY = 'jt_token';
const USER_STORAGE_KEY = 'jt_user';
const FRESHER_PROFILE_STORAGE_KEY = 'appTracker_fresherProfile';
const GEMINI_KEY_STORAGE_KEY = 'at_gemini_api_key';

function readStoredGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_KEY_STORAGE_KEY) || '';
}

function readStoredFresherProfile(): FresherProfile {
  if (typeof window === 'undefined') {
    return { skills: [], targetRoles: [], experienceYears: 0, resumeContext: null };
  }
  try {
    const raw = localStorage.getItem(FRESHER_PROFILE_STORAGE_KEY);
    if (!raw) return { skills: [], targetRoles: [], experienceYears: 0, resumeContext: null };
    const parsed = JSON.parse(raw);
    return {
      skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
      targetRoles: Array.isArray(parsed?.targetRoles) ? parsed.targetRoles : [],
      experienceYears: Number.isFinite(Number(parsed?.experienceYears))
        ? Math.max(0, Number(parsed.experienceYears))
        : 0,
      resumeContext: parsed?.resumeContext || null,
    };
  } catch {
    return { skills: [], targetRoles: [], experienceYears: 0, resumeContext: null };
  }
}

export function resolveDefaultBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (override && /^https?:\/\//i.test(override.trim())) {
      return override.trim().replace(/\/+$/, '');
    }
  }
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && /^https?:\/\//i.test(envUrl.trim())) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return 'http://localhost:3001';
  }
  return 'https://job-hunter-backend-sigma.vercel.app';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backendUrl, setBackendUrlState] = useState<string>(() => resolveDefaultBackendUrl());
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [localProfile, setLocalProfile] = useState<FresherProfile>(() => readStoredFresherProfile());
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => readStoredGeminiKey());
  const [aiStatus, setAiStatus] = useState<AiServiceStatus>({
    serverConfigured: false,
    model: 'gemini-4-hydrogen',
  });

  const setGeminiApiKey = useCallback((nextKey: string) => {
    const clean = nextKey.trim();
    if (!clean) {
      localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
      setGeminiApiKeyState('');
    } else {
      localStorage.setItem(GEMINI_KEY_STORAGE_KEY, clean);
      setGeminiApiKeyState(clean);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${backendUrl}/api/ai/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) {
          setAiStatus({
            serverConfigured: Boolean(data.serverConfigured),
            model: data.model || 'gemini-4-hydrogen',
          });
        }
      })
      .catch(() => {
        // Offline
      });
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  const setBackendUrl = useCallback((nextUrl: string) => {
    const trimmed = nextUrl.trim().replace(/\/+$/, '');
    if (!trimmed) {
      localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
      setBackendUrlState(resolveDefaultBackendUrl());
      return;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      localStorage.setItem(BACKEND_URL_STORAGE_KEY, trimmed);
      setBackendUrlState(trimmed);
    }
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);

    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    setToken(savedToken);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    fetch(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${savedToken}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401 || res.status === 404) {
          clearSession();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.success && data.user) {
            setUser(data.user);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
          }
        }
      })
      .catch(() => {
        // Keep cached offline identity if server is temporarily unreachable
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setIsLoading(false);
      });

    // Only flip cancelled flag on cleanup so StrictMode remounts do not trigger spurious ERR_ABORTED logs
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [backendUrl, clearSession]);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Invalid email or password' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach server';
      return { success: false, error: msg };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<AuthResult> => {
    try {
      const res = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Could not create account' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach server';
      return { success: false, error: msg };
    }
  };

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const updateProfile = async (payload: string | ProfileUpdatePayload): Promise<AuthResult> => {
    if (!token) return { success: false, error: 'Sign in to update profile' };
    const body = typeof payload === 'string' ? { name: payload } : payload;
    try {
      const res = await fetch(`${backendUrl}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update profile' };
      }
      setUser(data.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error updating profile';
      return { success: false, error: msg };
    }
  };

  const fresherProfile: FresherProfile = {
    skills: token && user ? user.skills || [] : localProfile.skills,
    targetRoles: token && user ? user.targetRoles || [] : localProfile.targetRoles,
    experienceYears: token && user ? user.experienceYears ?? 0 : localProfile.experienceYears,
    resumeContext: token && user ? user.resumeContext || null : localProfile.resumeContext || null,
  };

  const saveFresherProfile = async (updates: Partial<FresherProfile>): Promise<AuthResult> => {
    const merged: FresherProfile = {
      skills: updates.skills !== undefined ? updates.skills : fresherProfile.skills,
      targetRoles: updates.targetRoles !== undefined ? updates.targetRoles : fresherProfile.targetRoles,
      experienceYears:
        updates.experienceYears !== undefined ? updates.experienceYears : fresherProfile.experienceYears,
      resumeContext:
        updates.resumeContext !== undefined ? updates.resumeContext : fresherProfile.resumeContext,
    };

    if (token && user) {
      return await updateProfile(merged);
    }

    setLocalProfile(merged);
    localStorage.setItem(FRESHER_PROFILE_STORAGE_KEY, JSON.stringify(merged));
    return { success: true };
  };

  const buildAiResumeContext = async (
    input: BuildResumeContextInput
  ): Promise<AuthResult & { resumeContext?: ResumeContext }> => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (geminiApiKey) headers['x-gemini-api-key'] = geminiApiKey;

      const res = await fetch(`${backendUrl}/api/ai/resume-context`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          code: data.code,
          error: data.error || 'Could not synthesize AI resume context',
        };
      }

      if (data.user && token) {
        setUser(data.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      } else if (data.resumeContext) {
        const mergedSkills = Array.from(
          new Set([...(data.resumeContext.technicalSkills || []), ...localProfile.skills])
        );
        const nextLocal: FresherProfile = {
          ...localProfile,
          skills: mergedSkills,
          experienceYears:
            typeof data.resumeContext.experienceYears === 'number'
              ? data.resumeContext.experienceYears
              : localProfile.experienceYears,
          resumeContext: data.resumeContext,
        };
        setLocalProfile(nextLocal);
        localStorage.setItem(FRESHER_PROFILE_STORAGE_KEY, JSON.stringify(nextLocal));
      }

      return { success: true, resumeContext: data.resumeContext };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI resume service';
      return { success: false, error: msg };
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    if (!token) return { success: false, error: 'Sign in to update password' };
    try {
      const res = await fetch(`${backendUrl}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update password' };
      }
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error updating password';
      return { success: false, error: msg };
    }
  };

  const regenerateApiKey = async (): Promise<string | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${backendUrl}/api/auth/api-key`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.apiKey) {
        const updatedUser = user ? { ...user, apiKey: data.apiKey } : null;
        setUser(updatedUser);
        if (updatedUser) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
        }
        return data.apiKey;
      }
      return null;
    } catch {
      return null;
    }
  };

  const deleteAccount = async (): Promise<AuthResult> => {
    if (!token) return { success: false, error: 'Sign in first' };
    try {
      const res = await fetch(`${backendUrl}/api/auth/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to delete account' };
      }
      if (user?.id) {
        localStorage.removeItem(`at_apps_cache_${user.id}`);
        localStorage.removeItem(`at_interviews_cache_${user.id}`);
      }
      clearSession();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error deleting account';
      return { success: false, error: msg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        backendUrl,
        setBackendUrl,
        geminiApiKey,
        setGeminiApiKey,
        aiStatus,
        fresherProfile,
        saveFresherProfile,
        buildAiResumeContext,
        login,
        register,
        logout,
        updateProfile,
        updatePassword,
        regenerateApiKey,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
