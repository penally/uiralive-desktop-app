import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiUrl } from '@/lib/api/backend';

interface User {
  id: string;
  email: string;
  username?: string;
  avatar?: string;
  isAdmin?: boolean;
  isOwner?: boolean;
  isApproved?: boolean;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
  /** True if user can access content (approved, or staff) */
  canAccessContent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user data from API when token changes
  const fetchUserData = async (authToken: string, fallbackUser: User | null) => {
    try {
      const response = await fetch(apiUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else if (response.status === 401 || response.status === 403) {
        // Token invalid/expired - logout
        logout();
      } else {
        // 5xx, 502, 503, etc. - backend down or temporary error; keep user logged in
        if (fallbackUser) {
          setUser(fallbackUser);
        }
      }
    } catch (error) {
      // Network error (backend down, no connection) - keep user logged in
      console.error('Failed to fetch user data:', error);
      if (fallbackUser) {
        setUser(fallbackUser);
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const parsedUser: User | null = storedUser
        ? (() => {
            try {
              return JSON.parse(storedUser) as User;
            } catch {
              return null;
            }
          })()
        : null;

      if (storedToken) {
        setToken(storedToken);
        if (parsedUser) setUser(parsedUser);
        await fetchUserData(storedToken, parsedUser);
      } else if (parsedUser) {
        localStorage.removeItem('user');
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Revalidate auth every 30s (e.g. account deleted, session revoked)
  useEffect(() => {
    if (!token) return;
    const intervalId = setInterval(async () => {
      const t = localStorage.getItem('token');
      if (!t) return;
      try {
        const res = await fetch(apiUrl('/api/auth/me'), {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        } else if (res.status === 401 || res.status === 403) {
          logout();
        }
      } catch {
        // Network error - keep logged in
      }
    }, 30000);
    return () => clearInterval(intervalId);
  }, [token]);

  const login = async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const isAuthenticated = !!token && !!user;
  const canAccessContent = isAuthenticated && (!!user?.isApproved || !!user?.isAdmin || !!user?.isOwner);

  if (isLoading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser, isAuthenticated, canAccessContent }}>
      {children}
    </AuthContext.Provider>
  );
};