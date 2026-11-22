import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  regenerateApiKey: () => Promise<string | null>;
  backendUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://job-hunter-backend-sigma.vercel.app';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check localStorage for saved credentials
    const savedToken = localStorage.getItem('jt_token');
    const savedUser = localStorage.getItem('jt_user');

    if (savedToken) {
      setToken(savedToken);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          // ignore
        }
      }
      // Verify token with backend
      fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${savedToken}`
        }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('jt_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {
        // keep cached user on network failure
      })
      .finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to sign in' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('jt_token', data.token);
      localStorage.setItem('jt_user', JSON.stringify(data.user));
      window.dispatchEvent(new Event('jobApplicationAdded'));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error signing in' };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create account' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('jt_token', data.token);
      localStorage.setItem('jt_user', JSON.stringify(data.user));
      window.dispatchEvent(new Event('jobApplicationAdded'));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error creating account' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('jt_token');
    localStorage.removeItem('jt_user');
    window.dispatchEvent(new Event('jobApplicationAdded'));
  };

  const regenerateApiKey = async (): Promise<string | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/api-key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.apiKey) {
        const updatedUser = user ? { ...user, apiKey: data.apiKey } : null;
        setUser(updatedUser);
        if (updatedUser) {
          localStorage.setItem('jt_user', JSON.stringify(updatedUser));
        }
        return data.apiKey;
      }
      return null;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        regenerateApiKey,
        backendUrl: BACKEND_URL,
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
