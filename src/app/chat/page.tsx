'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
// Replace Pusher client
// import PusherClient from 'pusher-js';
import { useAuth } from '@/context/AuthContext';

type Room = {
  id: number;
  case_id: number;
  case_title: string;
  client_id: number;
  lawyer_id: number;
  last_content?: string | null;
  unread_count: number;
  other_full_name?: string | null;
  other_profile_picture?: string | null;
};

type Message = {
  id: number;
  chat_room_id: number;
  sender_id: number;
  message_type: 'text' | 'file' | 'image' | 'audio';
  content: string;
  file_path?: string | null;
  created_at: string;
};

export default function Page() {
  const { user, token, loading } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);

  // Presence tracking
  const [presenceOnline, setPresenceOnline] = useState<Record<number, boolean>>({});
  const [presenceReady, setPresenceReady] = useState<Record<number, boolean>>({});
  const presenceSubsRef = useRef<Record<number, any>>({});

  const pusherRef = useRef<any | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef<boolean>(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) || null,
    [rooms, activeRoomId]
  );

  const getInitials = (name?: string | null, fallback?: string) => {
    const base = (name && name.trim()) || fallback || '';
    const parts = base.split(' ').filter(Boolean);
    const letters = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    return letters.toUpperCase() || 'U';
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  // Helper formatters for WhatsApp-like UI
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const getDayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date(); y.setDate(today.getDate() - 1);
    const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (isSameDay(d, today)) return 'Today';
    if (isSameDay(d, y)) return 'Yesterday';
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Init Socket.IO client when authed
  useEffect(() => {
    if (loading || !user || !token) return;

    let socket: any;
    let unsubscribed = false;
    setConnecting(true);

    (async () => {
      try {
        const mod = await import('socket.io-client');
        const io = (mod as any).io || (mod as any).default?.io || (mod as any).default || (mod as any);
        socket = io('/', {
          path: '/socket.io',
          transports: ['websocket'], // avoid polling; no background xhr loops
          auth: { token },
          extraHeaders: { Authorization: `Bearer ${token}` }
        });

        socket.on('connect', () => setConnecting(false));
        socket.on('disconnect', () => setConnecting(true));
        socket.on('connect_error', (err: any) => {
          console.error('Socket.IO connection error:', err);
          setSocketError(typeof err === 'object' ? JSON.stringify(err) : String(err));
        });

        pusherRef.current = socket;

        const cleanup = () => {
          try { socket?.disconnect(); } catch {}
          pusherRef.current = null;
          setConnecting(false);
        };

        if (unsubscribed) cleanup();
        else return cleanup;
      } catch (e) {
        console.error('Socket.IO client failed to initialize:', e);
        setSocketError('Socket.IO client failed to initialize');
        setConnecting(false);
      }
    })();

    return () => {
      unsubscribed = true;
      try { socket?.disconnect(); } catch {}
    };
  }, [loading, user, token]);

  // Fetch chat rooms initially
  useEffect(() => {
    if (loading || !user || !token) return;

    let aborted = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/chat/rooms', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (!aborted) {
            const list = Array.isArray(data.rooms) ? data.rooms : [];
            setRooms(list as any);
            if (list.length > 0 && activeRoomId == null) {
              setActiveRoomId(list[0].id);
            }
          }
        } else {
          console.error('Failed to fetch chat rooms');
        }
      } catch (e: any) {
        // Ignore expected aborts on unmount/HMR to keep console clean
        const reason = (typeof e === 'string') ? e : (e?.reason ?? e?.message ?? e);
        const reasonStr = String(reason || '').toLowerCase();
        const isAbort = e?.name === 'AbortError' || reasonStr.includes('abort') || reasonStr.includes('cleanup');
        if (isAbort) return;
        console.error('Error fetching chat rooms:', e);
      }
    })();

    return () => {
      aborted = true;
      try {
        if (!controller.signal.aborted) controller.abort('cleanup');
      } catch {}
    };
  }, [loading, user, token]);

  // Fetch messages for active room and subscribe via Socket.IO
  useEffect(() => {
    if (!activeRoomId || !token) return;

    let stop = false;
    let controller: AbortController | null = null;
  
    const init = async () => {
      try {
        controller?.abort();
        controller = new AbortController();
        const res = await fetch(`/api/chat/rooms/${activeRoomId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (!stop) {
            setMessages((data.messages || []) as any[]);
            scrollToBottom();
          }
          await fetch(`/api/chat/rooms/${activeRoomId}/read`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      } catch {}
    };
  
    init();
  
    // Subscribe to private chat room events
    const socket = pusherRef.current;
    if (socket) {
      const room = `private-chat-room-${activeRoomId}`;
      try {
        socket.emit('join-chat-room', activeRoomId);

        const handleNewMessage = async (msg: any) => {
          try {
            const res = await fetch(`/api/chat/rooms/${activeRoomId}/messages`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              setMessages((data.messages || []) as any[]);
              requestAnimationFrame(() => scrollToBottom());
            }
          } catch {}
        };

        const handleTypingStart = (data: any) => {
          // Optional future typing UI
        };
        const handleTypingStop = (data: any) => {
          // Optional future typing UI
        };

        socket.on('new-message', handleNewMessage);
        socket.on('typing-started', handleTypingStart);
        socket.on('typing-stopped', handleTypingStop);

        return () => {
          try {
            socket.emit('leave-chat-room', activeRoomId);
            socket.off('new-message', handleNewMessage);
            socket.off('typing-started', handleTypingStart);
            socket.off('typing-stopped', handleTypingStop);
          } catch {}
        };
      } catch {}
    }

    return () => {
      stop = true;
      controller?.abort();
    };
  }, [activeRoomId, token]);

  // Presence subscriptions per room via Socket.IO
  useEffect(() => {
    const socket = pusherRef.current;
    if (!socket || !user || rooms.length === 0) return;

    // Reset states
    setPresenceReady(prev => {
      const updated = { ...prev }; rooms.forEach(r => { updated[r.id] = false; }); return updated;
    });

    const handlers: Array<{ roomId: number; remove: () => void }> = [];

    rooms.forEach((r) => {
      const otherId = r.client_id === user!.id ? r.lawyer_id : r.client_id;
      const otherIdStr = String(otherId);
      const room = `presence-chat-room-${r.id}`;

      try {
        socket.emit('join-presence-room', r.id);

        const handleState = (data: any) => {
          if (!data || data.room !== room) return;
          setPresenceReady(prev => ({ ...prev, [r.id]: true }));
          const exists = (Array.isArray(data.members) ? data.members : []).includes(otherIdStr);
          setPresenceOnline(prev => ({ ...prev, [r.id]: !!exists }));
        };
        const handleAdded = (member: any) => {
          if (member?.room !== room) return;
          if (String(member?.id) === otherIdStr) setPresenceOnline(prev => ({ ...prev, [r.id]: true }));
        };
        const handleRemoved = (member: any) => {
          if (member?.room !== room) return;
          if (String(member?.id) === otherIdStr) setPresenceOnline(prev => ({ ...prev, [r.id]: false }));
        };

        socket.on('presence:state', handleState);
        socket.on('presence:member_added', handleAdded);
        socket.on('presence:member_removed', handleRemoved);

        handlers.push({
          roomId: r.id,
          remove: () => {
            socket.emit('leave-presence-room', r.id);
            socket.off('presence:state', handleState);
            socket.off('presence:member_added', handleAdded);
            socket.off('presence:member_removed', handleRemoved);
          }
        });
      } catch {}
    });

    return () => {
      handlers.forEach(h => h.remove());
      setPresenceReady(prev => {
        const updated = { ...prev }; Object.keys(presenceSubsRef.current).forEach((roomIdStr: any) => { const roomId = Number(roomIdStr); updated[roomId] = false; }); return updated;
      });
      presenceSubsRef.current = {};
    };
  }, [rooms, user?.id]);

  const triggerTyping = useCallback(async (typing: boolean) => {
    if (!activeRoomId || !token) return;
    try {
      await fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: activeRoomId, isTyping: typing }),
      });
    } catch {}
  }, [activeRoomId, token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (!activeRoomId || !token) return;
    if (!typingSentRef.current) { typingSentRef.current = true; triggerTyping(true); }
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); }
    typingTimeoutRef.current = setTimeout(() => { typingSentRef.current = false; triggerTyping(false); }, 1000);
  };

  const sendMessage = async () => {
    if (!text.trim() || sending || !activeRoomId) return;
    setSending(true);
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: activeRoomId, content: text.trim(), messageType: 'text' }),
      });
      if (response.ok) { setText(''); } else { console.error('Failed to send message'); }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally { setSending(false); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside style={{ width: 320, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Chats</h2>
          <div style={{ fontSize: 12, color: connecting ? '#667eea' : '#10b981' }}>
            {connecting ? 'Connecting…' : 'Active now'}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {rooms.map((r) => {
            const isActive = r.id === activeRoomId;
            const name = r.other_full_name || `Case #${r.case_id}`;
            const avatar = r.other_profile_picture || '';
            return (
              <div key={r.id} onClick={() => setActiveRoomId(r.id)} style={{ padding: 12, cursor: 'pointer', background: isActive ? '#f0f9ff' : 'transparent', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e5e7eb' }}>
                    {avatar ? (
                      <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontWeight: 700, color: '#374151' }}>
                        {getInitials(r.other_full_name, r.case_title)}
                      </span>
                    )}
                  </div>
                  {(!connecting && presenceReady[r.id]) ? (
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: presenceOnline[r.id] ? '#22c55e' : '#9ca3af', borderRadius: '50%', border: '2px solid #fff' }} />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</strong>
                    {r.unread_count > 0 && (
                      <span style={{ background: '#2563eb', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 12, marginLeft: 8 }}>{r.unread_count}</span>
                    )}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.last_content || `Case • ${r.case_title}`}
                  </div>
                </div>
              </div>
            );
          })}
          {rooms.length === 0 && (
            <div style={{ padding: 12, color: '#6b7280', fontSize: 14 }}>No chat rooms yet.</div>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', 
        background: 'radial-gradient(circle at 10% 10%, rgba(25, 55, 109, 0.04) 1px, transparent 1px) 0 0/22px 22px, linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)' }}>
        {/* Header */}
        <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', minHeight: 64, background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
          {activeRoom ? (
            <>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e5e7eb' }}>
                {activeRoom.other_profile_picture ? (
                  <img src={activeRoom.other_profile_picture} alt={activeRoom.other_full_name || activeRoom.case_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontWeight: 700, color: '#374151', fontSize: 12 }}>
                    {getInitials(activeRoom.other_full_name, activeRoom.case_title)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{activeRoom.other_full_name || `Case #${activeRoom.case_id}`}</div>
                <div style={{ fontSize: 12, color: connecting ? '#667eea' : (!presenceReady[activeRoomId || 0] ? '#9ca3af' : (presenceOnline[activeRoomId || 0] ? '#22c55e' : '#9ca3af')) }}>
                  {connecting ? 'Connecting…' : (!presenceReady[activeRoomId || 0] ? 'Checking…' : (presenceOnline[activeRoomId || 0] ? 'Online' : 'Offline'))}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Case • {activeRoom.case_title}</div>
              </div>
            </>
          ) : (
            <div style={{ color: '#666' }}>Select a chat to start messaging</div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.map((m, idx) => {
            const dayLabel = getDayLabel(m.created_at);
            const prev = messages[idx - 1];
            const showDay = !prev || getDayLabel(prev.created_at) !== dayLabel;
            const isMine = !!user && m.sender_id === user.id;

            const bubbleStyle: React.CSSProperties = {
              maxWidth: '68%',
              padding: '8px 12px 6px 12px',
              borderRadius: 18,
              background: isMine ? '#ffedd5' : '#ffffff',
              color: '#1f2937',
              border: `1px solid ${isMine ? '#fed7aa' : '#e5e7eb'}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              position: 'relative',
              fontSize: 14,
              lineHeight: 1.4,
              display: 'inline-flex',
              flexDirection: 'column',
              gap: 6,
            };

            const timeStyle: React.CSSProperties = {
              alignSelf: 'flex-end',
              fontSize: 11,
              color: '#6b7280',
            };

            const dayStyle: React.CSSProperties = {
              alignSelf: 'center',
              background: 'rgba(3, 105, 161, 0.10)',
              color: '#0c4a6e',
              border: '1px solid rgba(3,105,161,0.18)',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 12,
              margin: '10px auto',
            };

            return (
              <React.Fragment key={`msg-${m.id}`}>
                {showDay && (
                  <div style={dayStyle}>{dayLabel}</div>
                )}
                <div style={{ display: 'flex', marginBottom: 8, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={bubbleStyle}>
                    <div>{m.content}</div>
                    <div style={timeStyle}>{formatTime(m.created_at)}</div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, background: '#ffffffd9', backdropFilter: 'saturate(180%) blur(4px)', alignItems: 'center' }}>
          <input
            disabled={!activeRoomId}
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={activeRoomId ? 'Type a message' : 'Select a chat first'}
            style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 24, padding: '12px 14px', background: '#f9fafb', outline: 'none', fontSize: 14 }}
          />
          <button
            disabled={!activeRoomId || sending || !text.trim()}
            onClick={sendMessage}
            style={{ background: '#22c55e', color: '#fff', border: 0, borderRadius: 24, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 6px 14px rgba(34,197,94,0.25)' }}
          >
            Send
          </button>
        </div>

        {/* Connection status/errors */}
        {socketError && (
          <div style={{ padding: 12, color: '#b91c1c', background: '#fee2e2', borderTop: '1px solid #fecaca' }}>{socketError}</div>
        )}
      </main>
    </div>
  );
}