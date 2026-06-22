import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncUser = useCallback((profileUpdate) => {
    const savedUser = localStorage.getItem('user');
    let currentUser = {};

    if (savedUser && savedUser !== 'undefined') {
      try {
        currentUser = JSON.parse(savedUser);
      } catch {
        currentUser = {};
      }
    }

    const nextUser = {
      ...currentUser,
      ...profileUpdate,
      token: profileUpdate?.token || currentUser.token,
    };

    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && savedUser !== 'undefined') {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Auth sync error:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const register = async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    return data;
  };

  const updateProfile = async (userData) => {
    const { data } = await api.put('/guards/me', userData);
    // Only update token if a new one is issued
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    return syncUser(data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/'; // Force a clean redirect to landing page
  };

  return (
    <AuthContext.Provider value={{ 
      user, login, register, updateProfile, logout, 
      syncUser,
      isAuthenticated: !!user, loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
