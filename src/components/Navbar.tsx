'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import { Scale, Menu, X } from 'lucide-react';
import axiosInstance from '@/utils/axiosInstance';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { notificationCount } = useNotifications();
  const router = useRouter();
  
  // State for client-side authentication check
  const [isClient, setIsClient] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Mobile menu toggle state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Chat unread count
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  // Helpdesk open tickets count (role-aware)
  const [helpdeskCount, setHelpdeskCount] = useState(0);

  // Client-side only effect
  useEffect(() => {
    setIsClient(true);
    // Check if user is authenticated from context or localStorage
    const hasToken = localStorage.getItem('access');
    setIsAuthenticated(!!user || !!hasToken);
  }, [user]);

  // NEW: admin/superuser role check used by the JSX below
  // Safe role derivation: only read localStorage in browser
  const role = user?.role ?? (typeof window !== 'undefined' ? localStorage.getItem('role') : null);
  const isSuperuser = user?.is_superuser ?? (typeof window !== 'undefined' ? localStorage.getItem('is_superuser') === 'true' : false);
  const isAdmin = Boolean(isSuperuser || role === 'admin');

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    // Using window.location.href for consistent navigation behavior
    window.location.href = ROUTES.HOME;
  };

  const getDashboardRoute = () => {
    if (!isAuthenticated || !isClient) return ROUTES.HOME;

    if (isSuperuser || role === 'admin') {
      return ROUTES.DASHBOARD.ADMIN;
    } else if (role === 'lawyer') {
      return ROUTES.DASHBOARD.LAWYER;
    } else if (role === 'client') {
      return ROUTES.DASHBOARD.CLIENT;
    }

    return ROUTES.HOME;
  };

  const getRoleDisplayName = () => {
    if (isSuperuser) return 'Administrator';
    if (role === 'admin') return 'Admin';
    if (role === 'lawyer') return 'Lawyer';
    if (role === 'client') return 'Client';
    return 'User';
  };

  // Fetch chat unread count once (no auto refresh)
  useEffect(() => {
    if (!isAuthenticated || !isClient) {
      setChatUnreadCount(0);
      return;
    }
    (async () => {
      try {
        const { data } = await axiosInstance.get('/chat/rooms');
        const total = Array.isArray(data?.rooms)
          ? data.rooms.reduce((sum: number, r: any) => sum + (Number(r.unread_count) || 0), 0)
          : 0;
        setChatUnreadCount(total);
      } catch {
        setChatUnreadCount(0);
      }
    })();
  }, [isAuthenticated, isClient]);

  // Fetch helpdesk count once (no auto refresh)
  useEffect(() => {
    if (!isAuthenticated || !isClient) {
      setHelpdeskCount(0);
      return;
    }
    (async () => {
      try {
        const { data } = await axiosInstance.get('/helpdesk/count');
        const c = Number(data?.count) || 0;
        setHelpdeskCount(c);
      } catch {
        setHelpdeskCount(0);
      }
    })();
  }, [isAuthenticated, isClient]);

  // Listen for helpdesk-count updates from pages (no polling)
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        // @ts-ignore
        const detail = e?.detail;
        const c = Number(detail?.count);
        if (!Number.isNaN(c)) setHelpdeskCount(c);
      } catch {}
    };
    window.addEventListener('helpdesk-count', handler as EventListener);
    return () => window.removeEventListener('helpdesk-count', handler as EventListener);
  }, []);

  // Show loading state while checking authentication
  if (!isClient) {
    return (
      <nav className="navbar navbar-expand-lg">
        <Link className="navbar-brand font-weight-bold" href={ROUTES.HOME} prefetch>
          <div className="brand-icon">
            <Scale size={24} />
          </div>
          <span className="brand-text">Legal System</span>
        </Link>
        
        {/* Loading state for navbar */}
        <div className="navbar-nav ms-auto">
          <div className="nav-item">
            <span className="nav-link">Loading...</span>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="navbar navbar-expand-lg">
      <Link className="navbar-brand font-weight-bold" href={ROUTES.HOME} prefetch>
        <div className="brand-icon">
          {/* Replace old SVG icon with system logo */}
          <img src="/ffl-logo.png" alt="FFL" />
        </div>
        <span className="brand-text">Legal System</span>
      </Link>
      
      {/* Mobile menu toggle button */}
      <button
        className="navbar-toggler"
        type="button"
        onClick={toggleMobileMenu}
        aria-expanded={isMobileMenuOpen}
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggler-icon">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </span>
      </button>

      {/* Navbar content */}
      <div className={`navbar-collapse ${isMobileMenuOpen ? 'show' : ''}`}>
        {!isAuthenticated ? (
          // Not authenticated - show public navigation centered
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link href={ROUTES.HOME} className="nav-link" onClick={closeMobileMenu}>Home</Link>
            </li>
            <li className="nav-item">
              <Link href={ROUTES.LOGIN} className="nav-link" onClick={closeMobileMenu}>Login</Link>
            </li>
            <li className="nav-item">
              <Link href={ROUTES.REGISTER} className="nav-link" onClick={closeMobileMenu}>Get Started</Link>
            </li>
          </ul>
        ) : (
          <>
            {/* Right-aligned actions: dashboard + notifications + chat + user menu */}
            <ul className="navbar-nav ms-auto align-items-center">
              {!isAdmin && (
                <>
                  {(role === 'client' || role === 'lawyer') && (
                    <li className="nav-item">
                      <Link href={getDashboardRoute()} className="nav-link" onClick={closeMobileMenu}>
                        <i className="fas fa-tachometer-alt"></i>
                        <span className="nav-text">Dashboard</span>
                      </Link>
                    </li>
                  )}
                  <li className="nav-item">
                    <Link href={ROUTES.NOTIFICATIONS} className="nav-link notification-link" onClick={closeMobileMenu}>
                      <i className="fas fa-bell"></i>
                      <span className="nav-text">Notifications</span>
                      {notificationCount > 0 && (
                        <span className="notification-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>
                      )}
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link href={ROUTES.CHAT} className="nav-link notification-link" onClick={closeMobileMenu}>
                      <i className="fas fa-comments"></i>
                      <span className="nav-text">Chat</span>
                      {chatUnreadCount > 0 && (
                        <span className="notification-badge">{chatUnreadCount > 99 ? '99+' : chatUnreadCount}</span>
                      )}
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link href="/helpdesk" className="nav-link notification-link" onClick={closeMobileMenu}>
                      <i className="fas fa-life-ring"></i>
                      <span className="nav-text">Helpdesk</span>
                      {helpdeskCount > 0 && (
                        <span className="notification-badge">{helpdeskCount > 99 ? '99+' : helpdeskCount}</span>
                      )}
                    </Link>
                  </li>
                </>
              )}

              {isAdmin && (
                <li className="nav-item">
                  <Link href="/admin/helpdesk" className="nav-link notification-link" onClick={closeMobileMenu}>
                    <i className="fas fa-life-ring"></i>
                    <span className="nav-text">Helpdesk</span>
                    {helpdeskCount > 0 && (
                      <span className="notification-badge">{helpdeskCount > 99 ? '99+' : helpdeskCount}</span>
                    )}
                  </Link>
                </li>
              )}

              <li className="nav-item dropdown ms-3">
                <div className="user-menu">
                  <div className="user-info">
                    <div 
                      className="user-avatar" 
                      onClick={() => {
                        window.location.href = ROUTES.PROFILE;
                        closeMobileMenu();
                      }} 
                      style={{ cursor: 'pointer' }}
                      title="View Profile"
                    >
                      <div className="profile-hover-overlay">
                        <i className="fas fa-user-edit"></i>
                      </div>
                      {user?.profile_picture ? (
                        <img src={user.profile_picture} alt="Profile" />
                      ) : (
                        <i className="fas fa-user"></i>
                      )}
                    </div>
                    <div 
                      className="user-details" 
                      onClick={() => {
                        window.location.href = ROUTES.PROFILE;
                        closeMobileMenu();
                      }} 
                      style={{ cursor: 'pointer' }}
                      title="View Profile"
                    >
                      <div className="user-name">{user?.full_name || localStorage.getItem('full_name') || 'User'}</div>
                      <div className="user-role">{getRoleDisplayName()}</div>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => {
                    handleLogout();
                    closeMobileMenu();
                  }}>
                    <i className="fas fa-sign-out-alt"></i> 
                    <span className="btn-text">Logout</span>
                  </Button>
                </div>
              </li>
            </ul>
          </>
        )}
      </div>
    </nav>
  );
}
