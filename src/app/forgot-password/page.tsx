'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/constants';
import './forgot-password.css';

const ForgotPassword = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <div className="card-header">
          <h1>Forgot Password</h1>
          <p>Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        <form onSubmit={handleSubmit} className="forgot-password-form">
          {error && (
            <div className="alert alert-error">
              <i className="fas fa-exclamation-triangle"></i>
              {error}
            </div>
          )}

          {message && (
            <div className="alert alert-success">
              <i className="fas fa-check-circle"></i>
              {message}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
              className="form-control"
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner-small"></div>
                Sending Reset Link...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i>
                Send Reset Link
              </>
            )}
          </button>
        </form>

        <div className="card-footer">
          <p>
            Remember your password?{' '}
            <Link href={ROUTES.LOGIN} className="link">
              Sign in here
            </Link>
          </p>
          <p>
            Don't have an account?{' '}
            <Link href={ROUTES.REGISTER} className="link">
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
