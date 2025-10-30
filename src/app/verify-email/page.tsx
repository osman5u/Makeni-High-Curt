'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/constants';
import './verify-email.css';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = searchParams?.get('token');
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('No verification token provided');
    }
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);
        setUser(data.user);
      } else {
        setStatus('error');
        setMessage(data.error);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Failed to verify email. Please try again.');
    }
  };

  const handleLogin = () => {
    router.push(ROUTES.LOGIN);
  };

  const handleDashboard = () => {
    if (user) {
      router.push(`/dashboard/${user.role}`);
    } else {
      router.push(ROUTES.HOME);
    }
  };

  return (
    <div className="verify-email-container">
      <div className="verify-email-card">
        {status === 'loading' && (
          <div className="status-content">
            <div className="spinner"></div>
            <h2>Verifying your email...</h2>
            <p>Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="status-content success">
            <div className="success-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <h2>Email Verified Successfully!</h2>
            <p>{message}</p>
            {user && (
              <div className="user-info">
                <p>Welcome, <strong>{user.full_name}</strong>!</p>
                <p>Your account as a <strong>{user.role}</strong> is now active.</p>
              </div>
            )}
            <div className="action-buttons">
              <button onClick={handleLogin} className="btn btn-outline">
                Go to Login
              </button>
              <button onClick={handleDashboard} className="btn btn-primary">
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="status-content error">
            <div className="error-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h2>Verification Failed</h2>
            <p>{message}</p>
            <div className="action-buttons">
              <button onClick={() => router.push(ROUTES.REGISTER)} className="btn btn-outline">
                Try Registering Again
              </button>
              <button onClick={() => router.push(ROUTES.HOME)} className="btn btn-primary">
                Go to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={
      <div className="verify-email-container">
        <div className="verify-email-card">
          <div className="status-content">
            <div className="spinner"></div>
            <h2>Loading...</h2>
            <p>Preparing verification page…</p>
          </div>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
