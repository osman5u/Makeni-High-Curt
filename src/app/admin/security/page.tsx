'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface Attempt {
  id: number;
  username: string | null;
  user_id: number | null;
  status: 'success' | 'failure';
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
  location: string | null;
  created_at: string;
}

export default function AdminSecurityPage() {
  const { user, token } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [usernameFilter, setUsernameFilter] = useState('');

  const isAdmin = Boolean(user?.is_superuser || user?.role === 'admin');

  const fetchAttempts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (usernameFilter.trim()) params.set('username', usernameFilter.trim());
      const res = await fetch(`/api/admin/security/login-attempts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.attempts) ? data.attempts : [];
        setAttempts(list as Attempt[]);
      } else {
        setAttempts([]);
      }
    } catch {
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !token) return;
    fetchAttempts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  if (!isAdmin) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Checking access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Security — Login Attempts</h1>
            <p>Monitor successful and failed logins with IP, location, and time.</p>
          </div>
          <div className="header-right" style={{ display: 'flex', gap: 8 }}>
            <Link href="/dashboard/admin" className="btn btn-outline-secondary">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <button className="btn btn-primary" onClick={() => fetchAttempts()} disabled={loading}>
              <i className="fas fa-sync"></i> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="charts-section">
        <div className="chart-card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="form-select"
              style={{ maxWidth: 200 }}
            >
              <option value="all">All statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
            <input
              type="text"
              placeholder="Filter by username"
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              className="form-control"
              style={{ maxWidth: 260 }}
            />
            <button className="btn btn-secondary" onClick={() => fetchAttempts()} disabled={loading}>
              Apply Filters
            </button>
          </div>

          {loading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading attempts...</p>
            </div>
          ) : attempts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>No login attempts</h3>
              <p>There are no attempts matching the current filters.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>IP</th>
                    <th>Location</th>
                    <th>User Agent</th>
                    <th>User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td>{formatTime(a.created_at)}</td>
                      <td>{a.username || '-'}</td>
                      <td style={{ fontWeight: 600, color: a.status === 'success' ? '#2e7d32' : '#c62828' }}>{a.status}</td>
                      <td>{a.reason || '-'}</td>
                      <td>{a.ip || '-'}</td>
                      <td>{a.location || '-'}</td>
                      <td style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.user_agent || '-'}</td>
                      <td>{a.user_id ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}