import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserPreferences, DbStatusResponse } from '../types/diet';
import { api, getAuthToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  preferences: UserPreferences | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  dbStatus: DbStatusResponse | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<UserPreferences>;
  refreshDbStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<DbStatusResponse | null>(null);

  const refreshDbStatus = useCallback(async () => {
    try {
      const status = await api.getDbStatus();
      setDbStatus(status);
    } catch {}
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setPreferences(null);
      setIsLoading(false);
      return;
    }

    try {
      const me = await api.getMe();
      if (me.success && me.user) {
        setUser(me.user);
        if (me.preferences) {
          setPreferences(me.preferences);
        }
      } else {
        setUser(null);
        setPreferences(null);
      }
    } catch (err) {
      console.warn('Auth verification failed:', err);
      setUser(null);
      setPreferences(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    refreshDbStatus();
  }, [refreshUser, refreshDbStatus]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      if (res.user) setUser(res.user);
      if (res.preferences) setPreferences(res.preferences);
      refreshDbStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.register({ name, email, password });
      if (res.user) setUser(res.user);
      if (res.preferences) setPreferences(res.preferences);
      refreshDbStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setPreferences(null);
    refreshDbStatus();
  };

  const updatePreferences = async (newPrefs: Partial<UserPreferences>): Promise<UserPreferences> => {
    const updated = await api.updateUserPreferences(newPrefs);
    setPreferences(updated);
    return updated;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        preferences,
        isAuthenticated: !!user,
        isLoading,
        dbStatus,
        login,
        register,
        logout,
        updatePreferences,
        refreshDbStatus,
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
