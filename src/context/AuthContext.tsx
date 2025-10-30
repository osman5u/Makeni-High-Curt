'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { User } from '@/lib/auth';

// Interface updates in this file
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<boolean>;
  // Add token to context so consumers (e.g., chat page) can send Authorization headers
  token: string | null;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: 'client' | 'lawyer' | 'admin';
  contact_address?: string;
  profile_picture?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Track JWT access token for API calls that require Authorization headers
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  const fetchProfile = async () => {
    try {
      // Read token from localStorage and keep it in sync with context
      const tokenLocal = localStorage.getItem('access');
      setToken(tokenLocal);
      if (!tokenLocal) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${tokenLocal}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('role');
        localStorage.removeItem('is_superuser');
        localStorage.removeItem('full_name');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('role');
      localStorage.removeItem('is_superuser');
      localStorage.removeItem('full_name');
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('access', data.access);
        localStorage.setItem('refresh', data.refresh);
        localStorage.setItem('role', data.role);
        localStorage.setItem('is_superuser', data.is_superuser.toString());
        localStorage.setItem('full_name', data.full_name || 'User');

        // Keep token in context so consumers can use it immediately
        setToken(data.access);
        // Set user immediately to avoid race conditions
        setUser(data.user);
        toast.success('Login successful!');
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || 'Login failed');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed');
      return false;
    }
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        toast.success('Registration successful! Please check your email to verify your account before logging in.');
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || 'Registration failed');
        return false;
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed');
      return false;
    }
  };

  const updateProfile = async (userData: Partial<User>): Promise<boolean> => {
    try {
      const token = localStorage.getItem('access');
      if (!token) return false;

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        toast.success('Profile updated successfully!');
        return true;
      } else {
        const error = await response.json();
        toast.error(error.error || 'Profile update failed');
        return false;
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Profile update failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('role');
    localStorage.removeItem('is_superuser');
    localStorage.removeItem('full_name');
    // Clear token from context
    setToken(null);
    setUser(null);
    // Use window.location for hard navigation instead of router.push to avoid RSC errors
    window.location.href = '/';
    toast.success('Logged out successfully!');
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    fetchProfile,
    updateProfile,
    // Expose token to consumers
    token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
