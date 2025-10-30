'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import '../cases/case-management.css'

interface AlertState {
  show: boolean;
  variant: 'success' | 'danger' | '';
  message: string;
}

export default function AdminAnnouncementsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [targetClients, setTargetClients] = useState(true);
  const [targetLawyers, setTargetLawyers] = useState(true);
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, variant: '', message: '' });

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && !user.is_superuser))) {
      router.push('/');
    }
  }, [user, loading, router]);

  const showAlert = (variant: AlertState['variant'], message: string) => {
    setAlert({ show: true, variant, message });
    setTimeout(() => setAlert({ show: false, variant: '', message: '' }), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      showAlert('danger', 'Announcement message is required');
      return;
    }

    if (!targetClients && !targetLawyers) {
      showAlert('danger', 'Select at least one target role');
      return;
    }

    try {
      setSending(true);
      const token = localStorage.getItem('access');
      const res = await fetch('/api/admin/broadcast-announcement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: message.trim(),
          targetRoles: [
            ...(targetClients ? ['client'] : []),
            ...(targetLawyers ? ['lawyer'] : []),
          ]
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to broadcast');
      }

      const data = await res.json();
      showAlert('success', `Announcement sent to ${data.created} recipients`);
      setMessage('');
    } catch (err: any) {
      console.error(err);
      showAlert('danger', err.message || 'Error sending announcement');
    } finally {
      setSending(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading announcements...</p>
      </div>
    );
  }

  return (
    <div className="case-management-container">
      <header className="management-header">
        <div className="header-content">
          <div className="header-left">
            <Link href="/dashboard/admin" className="btn btn-outline-light me-3">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <h1>Admin Announcements</h1>
          </div>
          <div className="header-right">
            <Button onClick={() => router.refresh()}>
              <i className="fas fa-sync"></i> Refresh
            </Button>
          </div>
        </div>
      </header>

      {alert.show && (
        <div className={`alert alert-${alert.variant} alert-dismissible fade show`} role="alert">
          {alert.message}
          <button type="button" className="btn-close" onClick={() => setAlert({ show: false, variant: '', message: '' })}></button>
        </div>
      )}

      <div className="cases-table-container">
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Announcement Message</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Type the announcement to broadcast to all clients and/or lawyers"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="mb-3 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="targetClients"
                  checked={targetClients}
                  onChange={(e) => setTargetClients(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="targetClients">Clients</label>
              </div>

              <div className="mb-3 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="targetLawyers"
                  checked={targetLawyers}
                  onChange={(e) => setTargetLawyers(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="targetLawyers">Lawyers</label>
              </div>

              <Button type="submit" disabled={sending}>
                {sending ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-bullhorn"></i> Broadcast Announcement
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}