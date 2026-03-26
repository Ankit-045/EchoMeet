import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('echomeet_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const res = await getMe();
          setUser(res.data.user);
        } catch {
          localStorage.removeItem('echomeet_token');
          localStorage.removeItem('echomeet_user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  const loginUser = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('echomeet_token', authToken);
    localStorage.setItem('echomeet_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('echomeet_token');
    localStorage.removeItem('echomeet_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
