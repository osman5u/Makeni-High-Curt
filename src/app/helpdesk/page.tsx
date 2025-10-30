'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import './helpdesk.css';

interface Ticket {
  id: number;
  subject: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  last_message?: string | null;
  last_message_at?: string | null;
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

export default function HelpdeskPage() {
  const { user, token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  const isClientOrLawyer = user?.role === 'client' || user?.role === 'lawyer';

  const fetchTickets = async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/helpdesk/tickets', { headers: { Authorization: `Bearer ${token}` }, signal });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        let list: Ticket[] = Array.isArray(data?.tickets) ? data.tickets : [];
        if (statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter);
        if (search.trim()) list = list.filter((t) => t.subject.toLowerCase().includes(search.trim().toLowerCase()));
        setTickets(list as any);
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
    if (!isClientOrLawyer || !token) return;
    const controller = new AbortController();
    fetchTickets(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClientOrLawyer, token, statusFilter, search]);

  const submitTicket = async () => {
    if (!token || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/helpdesk/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() })
      });
      if (res.ok) {
        setSubject('');
        setMessage('');
        fetchTickets();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openTicket = async (t: Ticket) => {
    setActiveTicket(t);
    setMessages([]);
    setReply('');
    await fetchMessages(Number(t.id));
  };

  const sendReply = async () => {
    if (!token || !activeTicket || !reply.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: reply.trim() })
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

  if (!isClientOrLawyer) {
    return (
      <div className="helpdesk-container">
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
              Helpdesk
            </h1>
            <p>Facing an issue? Create a ticket and chat with Admin.</p>
          </div>
          <div className="header-right">
            <Link href={user?.role === 'client' ? '/dashboard/client' : '/dashboard/lawyer'} className="btn btn-outline-secondary">
              <i className="fas fa-arrow-left"></i> Back
            </Link>
            <button className="btn btn-primary" onClick={() => fetchTickets()} disabled={loading}>
              <i className="fas fa-sync"></i> Refresh
            </button>
          </div>
        </div>
      </header>

      {/* New Ticket */}
      <motion.div className="helpdesk-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-title">
          <i className="fas fa-plus-circle"></i>
          <span>New Ticket</span>
        </div>
        <div className="ticket-form">
          <input className="form-control" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <input className="form-control" placeholder="Describe your issue" value={message} onChange={(e) => setMessage(e.target.value)} />
          <button className="btn btn-primary" onClick={submitTicket} disabled={submitting || !subject.trim() || !message.trim()}>
            {submitting ? (<><i className="fas fa-spinner fa-spin"></i> Submitting...</>) : (<><i className="fas fa-paper-plane"></i> Submit</>)}
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="filters-bar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="form-select">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <input type="text" className="form-control" placeholder="Search subject" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Tickets */}
      <section className="tickets-section">
        {loading ? (
          <div className="loading-spinner"><div className="spinner"></div><p>Loading tickets...</p></div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📬</div>
            <h3>No tickets yet</h3>
            <p>Submit a ticket above to contact Admin.</p>
          </div>
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
                  <i className="fas fa-comment"></i>
                  <span>{t.last_message || 'No messages yet'}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Thread */}
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
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <h3>No messages yet</h3>
              </div>
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
              <button className="btn btn-primary" onClick={sendReply} disabled={replying || !reply.trim()}>
                {replying ? (<><i className="fas fa-spinner fa-spin"></i> Sending...</>) : (<><i className="fas fa-paper-plane"></i> Send</>)}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}