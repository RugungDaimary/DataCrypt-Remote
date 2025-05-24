import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  publicKey?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithOTP: (email: string, otp: string) => Promise<void>;
  register: (name: string, email: string, password: string, publicKey?: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  logout: () => void;
  updatePublicKey: (publicKey: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await axios.get('/api/auth/user');
          setUser(response.data);
        }
      } catch (err) {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      setUser(response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    }
  };

  const loginWithOTP = async (email: string, otp: string) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/login/otp', { email, otp });
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      setUser(response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || 'OTP login failed');
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string, publicKey?: string) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/register', { name, email, password, publicKey });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    }
  };

  const verifyOTP = async (email: string, otp: string) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/verify-otp', { email, otp });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'OTP verification failed');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updatePublicKey = async (publicKey: string) => {
    try {
      setError(null);
      const response = await axios.put('/api/users/public-key', { publicKey });
      setUser(prev => prev ? { ...prev, publicKey } : null);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update public key');
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      loginWithOTP,
      register,
      verifyOTP,
      logout,
      updatePublicKey
    }}>
      {children}
    </AuthContext.Provider>
  );
};