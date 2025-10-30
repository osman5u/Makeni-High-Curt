'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import './lawyers.css';

interface Lawyer {
  id: number;
  username: string;
  email: string;
  full_name: string;
  profile_picture?: string;
  role: string;
  is_active: boolean;
}

const AvailableLawyers = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'client')) {
      router.push(ROUTES.HOME);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'client') {
      fetchLawyers();
    }
  }, [user]);

  const fetchLawyers = async () => {
    try {
      setLoadingData(true);
      const token = localStorage.getItem('access');
      const response = await fetch('/api/lawyers', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const lawyersData = await response.json();
        setLawyers(lawyersData);
      } else {
        setError('Failed to fetch lawyers');
      }
    } catch (error) {
      console.error('Error fetching lawyers:', error);
      setError('Failed to fetch lawyers');
    } finally {
      setLoadingData(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading available lawyers...</p>
      </div>
    );
  }

  if (!user || user.role !== 'client') {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Redirecting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchLawyers} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lawyers-container">
      {/* Header */}
      <header className="lawyers-header">
        <div className="header-content">
          <div className="header-left">
            <Link href="/dashboard/client" className="btn btn-outline-light me-3">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <h1>Available Lawyers</h1>
            <p>Choose a lawyer to file your case</p>
          </div>
        </div>
      </header>

      {/* Lawyers Grid */}
      <div className="lawyers-grid">
        {lawyers.length === 0 ? (
          <div className="no-lawyers">
            <i className="fas fa-user-tie"></i>
            <h3>No lawyers available</h3>
            <p>There are currently no active lawyers in the system</p>
          </div>
        ) : (
          lawyers.map((lawyer) => (
            <div key={lawyer.id} className="lawyer-card">
              <div className="lawyer-image">
                {lawyer.profile_picture ? (
                  <img src={lawyer.profile_picture} alt={lawyer.full_name} />
                ) : (
                  <div className="default-avatar">
                    <i className="fas fa-user-tie"></i>
                  </div>
                )}
              </div>
              <div className="lawyer-info">
                <h3>{lawyer.full_name}</h3>
                <p className="lawyer-email">{lawyer.email}</p>
                <p className="lawyer-role">
                  <i className="fas fa-briefcase"></i> {lawyer.role}
                </p>
                <div className="lawyer-status">
                  <span className={`status-badge ${lawyer.is_active ? 'active' : 'inactive'}`}>
                    {lawyer.is_active ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
              <div className="lawyer-actions">
                <Link 
                  href={`/file-case/${lawyer.id}`} 
                  className="btn btn-primary"
                  disabled={!lawyer.is_active}
                >
                  <i className="fas fa-gavel"></i> File Case
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AvailableLawyers;
