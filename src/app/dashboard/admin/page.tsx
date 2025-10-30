'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import dynamic from 'next/dynamic';
const Line = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false });
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });
const Pie = dynamic(() => import('react-chartjs-2').then(m => m.Pie), { ssr: false });
import './dashboard.css';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { motion, AnimatePresence } from 'framer-motion';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface AdminStats {
  totalUsers: number;
  totalLawyers: number;
  totalClients: number;
  totalCases: number;
  pendingCases: number;
  approvedCases: number;
  rejectedCases: number;
  trackingHistoryCount: number;
  trackedCasesCount: number;
}

interface RecentCase {
  id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  client_name: string;
  lawyer_name: string;
}

interface RecentUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface CaseStats {
  month: string;
  count: number;
}

interface UserStats {
  roleDistribution: Array<{ name: string; value: number }>;
  registrationTrend: Array<{ month: string; count: number }>;
}

function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalLawyers: 0, totalClients: 0,
    totalCases: 0, pendingCases: 0, approvedCases: 0, rejectedCases: 0,
    trackingHistoryCount: 0, trackedCasesCount: 0,
  });
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [caseStats, setCaseStats] = useState<CaseStats[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({ roleDistribution: [], registrationTrend: [] });
  const [loadingData, setLoadingData] = useState(true);

  // Add lightweight spinner state for dashboard button clicks
  const [sectionLoading, setSectionLoading] = useState(false);

  // Add: slide nav state and active section (Dashboard default)
  const [activeSection, setActiveSection] = useState<'dashboard'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // NEW: collapsed (minimized) sidebar state and handler
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const handleCollapseSidebar = () => setIsSidebarCollapsed(prev => !prev);
  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('role');
    localStorage.removeItem('is_superuser');
    window.location.href = ROUTES.LOGIN;
  };

  useEffect(() => {
    if (!loading) {
      // Check authentication from context or localStorage
      const token = localStorage.getItem('access');
      const role = localStorage.getItem('role');
      const isSuperuser = localStorage.getItem('is_superuser') === 'true';
      
      if (!token || (!user && !role)) {
        // No authentication found
        window.location.href = ROUTES.LOGIN;
        return;
      }
      
      // Check if user has admin access
      const hasAdminAccess = (user && (user.role === 'admin' || user.is_superuser)) || 
                            (role === 'admin' || isSuperuser);
      
      if (!hasAdminAccess) {
        window.location.href = ROUTES.LOGIN;
        return;
      }
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.is_superuser)) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoadingData(true);
      const token = localStorage.getItem('access');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [statsResponse, casesResponse, usersResponse, caseStatsResponse, userStatsResponse] = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/recent-cases', { headers }),
        fetch('/api/admin/recent-users', { headers }),
        fetch('/api/admin/case-stats', { headers }),
        fetch('/api/admin/user-statistics', { headers })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (casesResponse.ok) {
        const casesData = await casesResponse.json();
        setRecentCases(casesData);
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setRecentUsers(usersData);
      }

      if (caseStatsResponse.ok) {
        const caseStatsData = await caseStatsResponse.json();
        setCaseStats(caseStatsData);
      }

      if (userStatsResponse.ok) {
        const userStatsData = await userStatsResponse.json();
        setUserStats(userStatsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && !user.is_superuser)) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className={`dashboard-root ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Full-height fixed sidebar */}
      <aside className={`side-nav ${isSidebarOpen ? 'open' : 'closed'} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="side-nav-header">
          <span>Admin Panel</span>
          {/* NEW: collapse/expand + mobile toggle buttons */}
          <div className="side-nav-actions">
            <button className="side-nav-collapse" onClick={handleCollapseSidebar} aria-label="Collapse sidebar">
              <i className={`fas ${isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>
            <button className="side-nav-toggle" onClick={handleToggleSidebar} aria-label="Toggle sidebar">×</button>
          </div>
        </div>

        <nav className="side-nav-menu">
          {/* Dashboard shows counts + analytics + recents */}
          <button
            className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
            onClick={async () => {
              setActiveSection('dashboard');
              setSectionLoading(true);
              try {
                await fetchDashboardData();
              } finally {
                setSectionLoading(false);
              }
            }}
          >
            <i className="fas fa-tachometer-alt"></i>
            <span>Dashboard</span>
          </button>

          {/* External management links like the photo */}
          <Link href="/admin/users" className="nav-item">
            <i className="fas fa-users"></i>
            <span>User Management</span>
          </Link>

          <Link href="/admin/cases" className="nav-item">
            <i className="fas fa-gavel"></i>
            <span>Case Management</span>
          </Link>

+         <Link href="/admin/case-tracking" className="nav-item">
+           <i className="fas fa-tasks"></i>
+           <span>Case Tracking</span>
+         </Link>
+
          <Link href="/admin/documents" className="nav-item">
            <i className="fas fa-file-alt"></i>
            <span>Document Management</span>
          </Link>

          <Link href="/admin/announcements" className="nav-item">
            <i className="fas fa-bullhorn"></i>
            <span>Announcements</span>
          </Link>

          <Link href="/admin/helpdesk" className="nav-item">
            <i className="fas fa-life-ring"></i>
            <span>Helpdesk</span>
          </Link>

          <Link href="/admin/security" className="nav-item">
            <i className="fas fa-shield-alt"></i>
            <span>Security</span>
          </Link>
        </nav>

        <div className="side-nav-footer">
          <button className="nav-item logout" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content shifted by sidebar width */}
      <div className="dashboard-content">
        {/* Optional inline spinner while re-fetching on click */}
        {sectionLoading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading admin dashboard...</p>
          </div>
        )}

        {/* Header */}
        <header className="dashboard-header">
          <div className="header-content">
            <div className="header-left">
              <h1>Admin Dashboard</h1>
              <p>Welcome back, {user.full_name}</p>
            </div>
            <div className="header-right">
              <Link href="/admin/users" className="btn btn-primary">
                <i className="fas fa-users"></i> Manage Users
              </Link>
              <Link href="/admin/cases" className="btn btn-outline-primary">
                <i className="fas fa-gavel"></i> Manage Cases
              </Link>
+             <Link href="/admin/case-tracking" className="btn btn-outline-secondary">
+               <i className="fas fa-tasks"></i> Case Tracking
+             </Link>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Dashboard section: Counts + Analytics + Recents */}
            {activeSection === 'dashboard' && (
              <>
                {/* Counts grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon"><i className="fas fa-users"></i></div>
                    <div className="stat-content"><h3>{stats.totalUsers}</h3><p>Total Users</p></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><i className="fas fa-gavel"></i></div>
                    <div className="stat-content"><h3>{stats.totalCases}</h3><p>Total Cases</p></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><i className="fas fa-user-tie"></i></div>
                    <div className="stat-content"><h3>{stats.totalLawyers}</h3><p>Total Lawyers</p></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><i className="fas fa-user-friends"></i></div>
                    <div className="stat-content"><h3>{stats.totalClients}</h3><p>Total Clients</p></div>
                  </div>

                  {/* NEW: Status counters */}
                  <div className="stat-card pending">
                    <div className="stat-icon"><i className="fas fa-hourglass-half"></i></div>
                    <div className="stat-content"><h3>{stats.pendingCases}</h3><p>Pending Cases</p></div>
                  </div>
                  <div className="stat-card approved">
                    <div className="stat-icon"><i className="fas fa-check-circle"></i></div>
                    <div className="stat-content"><h3>{stats.approvedCases}</h3><p>Approved Cases</p></div>
                  </div>
                  <div className="stat-card rejected">
                    <div className="stat-icon"><i className="fas fa-times-circle"></i></div>
                    <div className="stat-content"><h3>{stats.rejectedCases}</h3><p>Rejected Cases</p></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><i className="fas fa-tasks"></i></div>
                    <div className="stat-content"><h3>{stats.trackedCasesCount}</h3><p>Tracked Cases</p></div>
                  </div>
                </div>

                {/* Dashboard Analytics */}
                <div className="charts-section">
                  <h2>Dashboard Analytics</h2>
                  <div className="charts-grid">
                    {/* Case Trends */}
                    <div className="chart-card">
                      <h3>Case Trends</h3>
                      <div className="chart-container">
                        <Line
                          data={{
                            labels: caseStats.map(item => item.month),
                            datasets: [{
                              label: 'Cases Created',
                              data: caseStats.map(item => item.count),
                              borderColor: '#36A2EB',
                              backgroundColor: 'rgba(77, 119, 100, 0.1)',
                              tension: 0.4,
                              fill: true
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                          }}
                        />
                      </div>
                    </div>

                    {/* User Role Distribution */}
                    <div className="chart-card">
                      <h3>User Role Distribution</h3>
                      <div className="chart-container">
                        <Pie
                          data={{
                            labels: userStats.roleDistribution.map(item => item.name),
                            datasets: [{
                              data: userStats.roleDistribution.map(item => item.value),
                              backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
                              borderWidth: 2,
                              borderColor: '#fff'
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { position: 'bottom' },
                              datalabels: {
                                color: '#2c3e50',
                                formatter: (value: number, context: any) => {
                                  try {
                                    const data = context?.dataset?.data || [];
                                    const total = Array.isArray(data) ? data.reduce((sum: number, v: number) => sum + (Number(v) || 0), 0) : 0;
                                    const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0;
                                    return `${pct}%`;
                                  } catch {
                                    return '';
                                  }
                                },
                                font: {
                                  weight: 'bold',
                                  size: 14,
                                }
                              },
                              tooltip: {
                                callbacks: {
                                  label: (ctx: any) => {
                                    const value = Number(ctx.parsed);
                                    const data = ctx?.dataset?.data || [];
                                    const total = Array.isArray(data) ? data.reduce((sum: number, v: number) => sum + (Number(v) || 0), 0) : 0;
                                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                                    const label = ctx?.label ?? '';
                                    return `${label}: ${pct}% (${value})`;
                                  }
                                }
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                    {/* NEW: User Registration Trend */}
                    <div className="chart-card">
                      <h3>User Registration Trend</h3>
                      <div className="chart-container">
                        <Bar
                          data={{
                            labels: userStats.registrationTrend.map(item => item.month),
                            datasets: [{
                              label: 'Registrations',
                              data: userStats.registrationTrend.map(item => item.count),
                              backgroundColor: 'rgba(118, 75, 162, 0.35)',
                              borderColor: '#764ba2',
                              borderWidth: 1
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: { beginAtZero: true, ticks: { stepSize: 1 } }
                            },
                            plugins: {
                              legend: { display: false },
                              datalabels: {
                                anchor: 'end',
                                align: 'top',
                                color: '#2c3e50',
                                formatter: (value: number) => value
                              }
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Cases */}
                <div className="recent-cases-section">
                  <h2>Recent Cases</h2>
                  {recentCases.length === 0 ? (
                    <p className="empty-state">No recent cases found.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="recent-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Client</th>
                            <th>Lawyer</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentCases.map(c => (
                            <tr key={c.id}>
                              <td className="cell-title"><i className="fas fa-gavel"></i> {c.title}</td>
                              <td><span className={`badge status-${c.status}`}>{c.status}</span></td>
                              <td>{new Date(c.created_at).toLocaleString()}</td>
                              <td>{c.client_name || 'N/A'}</td>
                              <td>{c.lawyer_name || 'N/A'}</td>
                              <td>
                                <Link href="/admin/cases" className="btn-link">
                                  Manage Cases <i className="fas fa-arrow-right"></i>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recent Users */}
                <div className="recent-users-section">
                  <h2>Recent Users</h2>
                  {recentUsers.length === 0 ? (
                    <p className="empty-state">No recent users found.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="recent-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentUsers.map(u => (
                            <tr key={u.id}>
                              <td className="cell-title"><i className="fas fa-user"></i> {u.full_name || u.username}</td>
                              <td><span className={`badge role-${u.role}`}>{u.role}</span></td>
                              <td>@{u.username}</td>
                              <td>{u.email}</td>
                              <td>
                                <span className={`chip ${u.is_active ? 'chip-success' : 'chip-muted'}`}>
                                  {u.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>{new Date(u.created_at).toLocaleString()}</td>
                              <td>
                                <Link href="/admin/users" className="btn-link">
                                  Manage Users <i className="fas fa-arrow-right"></i>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AdminDashboard;