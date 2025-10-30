'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axiosInstance from '@/utils/axiosInstance';
import './notifications.css';

interface Notification {
  id: number;
  case_id: number | null
  message: string;
  read: boolean;
  created_at: string;
  updated_at: string;
  case_title?: string;
  sender_name?: string;
}

function NotificationsPage() {
  const { user } = useAuth();
  const { refreshNotificationCount, decrementCount, resetCount } = useNotifications();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
    if (!user && !token) {
      router.push('/auth/login');
      return;
    }
    fetchNotifications(false);
  }, [user, router]);

  const fetchNotifications = async (loadMore: boolean = false, signal?: AbortSignal) => {
    try {
      if (!loadMore) setLoading(true);
      setError(null);
      if (loadMore) setLoadingMore(true);

      const limit = 20; // smaller page for faster first paint
      const params: Record<string, any> = { limit };
      if (loadMore && cursorCreatedAt) {
        params.cursorCreatedAt = cursorCreatedAt;
      }

      const response = await axiosInstance.get('/notifications', { params, signal });
      const newNotifs: Notification[] = response.data.notifications || [];

      setNotifications(prev => (loadMore ? [...prev, ...newNotifs] : newNotifs));

      // Update pagination state
      if (newNotifs.length < limit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
      if (newNotifs.length > 0) {
        const last = newNotifs[newNotifs.length - 1];
        setCursorCreatedAt(last.created_at);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications');
      if (!loadMore) setNotifications([]);
    } finally {
      if (!loadMore) setLoading(false);
      if (loadMore) setLoadingMore(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await axiosInstance.put('/notifications', { notificationId });
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true }
            : notif
        )
      );
      // Decrement the notification count in the context
      decrementCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.put('/notifications', { markAllAsRead: true });
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true }))
      );
      // Reset the notification count in the context
      resetCount();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div className="header-content">
          <div className="header-left">
            <Link href={user?.role === 'client' ? '/dashboard/client' : '/dashboard/lawyer'} className="btn btn-outline-secondary">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <h1>
              <i className="fas fa-bell"></i>
              Notifications
            </h1>
          </div>
          <div className="header-right">
            {/* Add safety check to ensure notifications is an array */}
            {Array.isArray(notifications) && notifications.some(n => !n.read) && (
              <button 
                className="btn btn-primary"
                onClick={markAllAsRead}
              >
                <i className="fas fa-check-double"></i>
                Mark All as Read
              </button>
            )}
            <button
              className="btn btn-outline-secondary"
              onClick={() => fetchNotifications(false)}
              disabled={loading}
            >
              <i className="fas fa-sync"></i>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="notifications-content">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
          </div>
        ) : (
          <>
            {/* Add safety check here too */}
            {!Array.isArray(notifications) || notifications.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <i className="fas fa-bell-slash"></i>
                </div>
                <h3>No notifications yet</h3>
                <p>You'll see notifications here when there are updates to your cases.</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id}
                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="notification-content">
                      <div className="notification-header">
                        <div className="notification-title">
                          <i className="fas fa-gavel"></i>
                          {notification.case_title || 'Case Update'}
                        </div>
                        <div className="notification-time">
                          {formatDate(notification.created_at)}
                        </div>
                      </div>
                      <div className="notification-message">
                        {notification.message}
                      </div>
                      {notification.sender_name && (
                        <div className="notification-sender">
                          From: {notification.sender_name}
                        </div>
                      )}
                    </div>
                    {!notification.read && (
                      <div className="unread-indicator">
                        <div className="unread-dot"></div>
                      </div>
                    )}
                  </div>
                ))}
                {hasMore && (
                  <div className="load-more">
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => fetchNotifications(true)}
                      disabled={loadingMore}
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default NotificationsPage;