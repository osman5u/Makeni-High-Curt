'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/constants';
import { usePathname } from 'next/navigation';

// Reuse the dashboard styles so the sidebar looks identical
import '../dashboard/admin/dashboard.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Sidebar open/closed for mobile (off-canvas)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Collapsed/expanded (minimized to icon-only)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const handleCollapseSidebar = () => setIsSidebarCollapsed(prev => !prev);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('role');
    localStorage.removeItem('is_superuser');
    window.location.href = ROUTES.LOGIN;
  };

  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!href) return false;
    // Basic check: mark as active when current path starts with the item href
    return pathname?.startsWith(href);
  };

  return (
    <div className={`dashboard-root ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Fixed, full-height sidebar */}
      <aside className={`side-nav ${isSidebarOpen ? 'open' : 'closed'} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="side-nav-header">
          <span>Admin Panel</span>
          <div className="side-nav-actions">
            <button className="side-nav-collapse" onClick={handleCollapseSidebar} aria-label="Collapse sidebar">
              <i className={`fas ${isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>
            <button className="side-nav-toggle" onClick={handleToggleSidebar} aria-label="Toggle sidebar">×</button>
          </div>
        </div>

        <nav className="side-nav-menu">
          {/* Dashboard entry */}
          <Link href="/dashboard/admin" className={`nav-item ${isActive('/dashboard/admin') ? 'active' : ''}`}>
            <i className="fas fa-tachometer-alt"></i>
            <span>Dashboard</span>
          </Link>

          {/* Management pages under /admin */}
          <Link href="/admin/users" className={`nav-item ${isActive('/admin/users') ? 'active' : ''}`}>
            <i className="fas fa-users"></i>
            <span>User Management</span>
          </Link>

          <Link href="/admin/cases" className={`nav-item ${isActive('/admin/cases') ? 'active' : ''}`}>
            <i className="fas fa-gavel"></i>
            <span>Case Management</span>
          </Link>

          <Link href="/admin/documents" className={`nav-item ${isActive('/admin/documents') ? 'active' : ''}`}>
            <i className="fas fa-file-alt"></i>
            <span>Document Management</span>
          </Link>

          <Link href="/admin/announcements" className={`nav-item ${isActive('/admin/announcements') ? 'active' : ''}`}>
            <i className="fas fa-bullhorn"></i>
            <span>Announcements</span>
          </Link>
        </nav>

        <div className="side-nav-footer">
          <button className="nav-item logout" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Right content area */}
      <div className="dashboard-content">
        {/* Optional header (kept minimal so page headers can render their own) */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1>Admin</h1>
              {user?.full_name && <p>Welcome back, {user.full_name}</p>}
            </div>
          </div>
        </header>

        {/* Render the page content */}
        {children}
      </div>
    </div>
  );
}