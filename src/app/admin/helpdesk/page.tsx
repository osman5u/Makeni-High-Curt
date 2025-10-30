'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import '../../helpdesk/helpdesk.css';

interface Ticket {
  id: number;
  subject: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  created_name?: string | null;
  created_role?: string | null;
  last_message?: string | null;
}

interface Message {
  id: number;
  ticket_id: number;
  sender_id: number;
  sender_role: string;
  sender_name?: string | null;
  content: string;
  created_at: string;
}

export default function AdminHelpdeskPage() {
  const { user, token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [search, setSearch] = useState('');

  const isAdmin = Boolean(user?.is_superuser || user?.role === 'admin');

  const fetchTickets = async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/helpdesk/tickets', { headers: { Authorization: `Bearer ${token}` }, signal });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        let list: Ticket[] = Array.isArray(data?.tickets) ? data.tickets : [];
        if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
        if (usernameFilter.trim()) list = list.filter((t) => String(t.created_name || '').toLowerCase().includes(usernameFilter.trim().toLowerCase()));
        if (search.trim()) list = list.filter((t) => t.subject.toLowerCase().includes(search.trim().toLowerCase()));
        setTickets(list);
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(list as any);
        // Refresh helpdesk unread count and dispatch to navbar
        try {
          const cr = await fetch('/api/helpdesk/count', { headers: { Authorization: `Bearer ${token}` } });
          if (cr.ok) {
            const cdata = await cr.json().catch(() => ({}));
            const c = Number(cdata?.count) || 0;
            window.dispatchEvent(new CustomEvent('helpdesk-count', { detail: { count: c } }));
          }
        } catch {}
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!isAdmin || !token) return;
    const controller = new AbortController();
    fetchTickets(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token, statusFilter, usernameFilter, search]);

  const openTicket = async (t: Ticket) => {
    setActiveTicket(t);
    setMessages([]);
    setReply('');
    await fetchMessages(Number(t.id));
  };

  const sendReply = async (statusUpdate?: 'open' | 'closed') => {
    if (!token || !activeTicket || !reply.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: reply.trim(), status: statusUpdate })
      });
      if (res.ok) {
        setReply('');
        await fetchMessages(Number(activeTicket.id));
        await fetchTickets();
      }
    } finally {
      setReplying(false);
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
    <div className="helpdesk-container">
      <header className="helpdesk-header">
        <div className="header-content">
          <div className="header-left">
            <h1>
              <i className="fas fa-life-ring"></i>
              Admin Helpdesk
            </h1>
            <p>View and reply to tickets from Clients and Lawyers.</p>
          </div>
          <div className="header-right">
            <Link href="/dashboard/admin" className="btn btn-outline-secondary">
              <i className="fas fa-arrow-left"></i> Back
            </Link>
            <button className="btn btn-primary" onClick={() => fetchTickets()} disabled={loading}>
              <i className="fas fa-sync"></i> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="filters-bar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="form-select">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <input type="text" className="form-control" placeholder="Filter by name" value={usernameFilter} onChange={(e) => setUsernameFilter(e.target.value)} />
        <input type="text" className="form-control" placeholder="Search subject" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <section className="tickets-section">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div><p>Loading tickets...</p></div>
        ) : tickets.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📭</div><h3>No tickets</h3><p>No tickets matching the current filters.</p></div>
        ) : (
          <div className="tickets-grid">
            {tickets.map((t) => (
              <motion.div key={t.id} className="ticket-card" onClick={() => openTicket(t)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="ticket-header">
                  <span className={`status-pill ${t.status}`}>{t.status}</span>
                  <span className="ticket-time">{new Date(t.updated_at || t.created_at).toLocaleString()}</span>
                </div>
                <div className="ticket-subject">{t.subject}</div>
                <div className="ticket-last">
                  <i className="fas fa-user"></i>
                  <span>{t.created_name || t.created_role}</span>
                </div>
                <div className="ticket-last" style={{ marginTop: 4 }}>
                  <i className="fas fa-comment"></i>
                  <span>{t.last_message || 'No messages yet'}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {activeTicket && (
          <motion.section className="thread-section" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <div className="thread-header">
              <div className="thread-title">
                <i className="fas fa-comments"></i>
                <span>Ticket #{activeTicket.id}: {activeTicket.subject}</span>
              </div>
              <button className="btn btn-outline-secondary" onClick={() => setActiveTicket(null)}>
                <i className="fas fa-times"></i> Close
              </button>
            </div>

            {messages.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">💬</div><h3>No messages yet</h3></div>
            ) : (
              <div className="thread-messages">
                {messages.map((m) => {
                  const isAdminMsg = m.sender_role === 'admin';
                  return (
                    <div key={m.id} className={`bubble-row ${isAdminMsg ? 'right' : 'left'}`}>
                      <div className={`bubble ${isAdminMsg ? 'bubble-admin' : 'bubble-user'}`}>
                        <div className="bubble-author">
                          <i className="fas fa-user-circle"></i>
                          <span>{m.sender_name || m.sender_role}</span>
                        </div>
                        <div className="bubble-content">{m.content}</div>
                        <div className="bubble-time">{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="thread-reply">
              <input className="form-control" placeholder="Type your reply" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={() => sendReply()} disabled={replying || !reply.trim()}>
                  {replying ? (<><i className="fas fa-spinner fa-spin"></i> Sending...</>) : (<><i className="fas fa-paper-plane"></i> Send</>)}
                </button>
                <button className="btn btn-outline-danger" onClick={() => sendReply('closed')} disabled={replying || !reply.trim()}>
                  <i className="fas fa-times"></i> Send & Close
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}