'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import './file-case.css';

interface Lawyer {
  id: number;
  username: string;
  email: string;
  full_name: string;
  profile_picture?: string;
  role: string;
  is_active: boolean;
}

// within: const FileCase component
const FileCase = ({ params }: { params: Promise<{ lawyerId: string }> }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: ''
  });
  const resolvedParams = React.use(params);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'client')) {
      router.push(ROUTES.HOME);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'client') {
      fetchLawyer();
    }
  }, [user, resolvedParams.lawyerId]);

  const fetchLawyer = async () => {
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
        const lawyers = await response.json();
        const selectedLawyer = lawyers.find((l: Lawyer) => l.id === parseInt(resolvedParams.lawyerId));
        if (selectedLawyer) {
          setLawyer(selectedLawyer);
        } else {
          setError('Lawyer not found');
        }
      } else {
        setError('Failed to fetch lawyer information');
      }
    } catch (error) {
      console.error('Error fetching lawyer:', error);
      setError('Failed to fetch lawyer information');
    } finally {
      setLoadingData(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.due_date) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const token = localStorage.getItem('access');
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          due_date: formData.due_date,
          lawyer_id: parseInt(resolvedParams.lawyerId)
        })
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({ title: '', description: '', due_date: '' });
        setTimeout(() => {
          router.push('/dashboard/client');
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to file case');
      }
    } catch (error) {
      console.error('Error filing case:', error);
      setError('Failed to file case. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading...</p>
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

  if (error && !lawyer) {
    return (
      <div className="error-container">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Error</h3>
          <p>{error}</p>
          <Link href="/lawyers" className="btn btn-primary">
            Back to Lawyers
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="success-container">
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          <h3>Case Filed Successfully!</h3>
          <p>Your case has been submitted and the lawyer has been notified.</p>
          <p>Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-case-container">
      {/* Header */}
      <header className="file-case-header">
        <div className="header-content">
          <div className="header-left">
            <Link href="/lawyers" className="btn btn-outline-light me-3">
              <i className="fas fa-arrow-left"></i> Back to Lawyers
            </Link>
            <h1>File New Case</h1>
            <p>Submit your case to {lawyer?.full_name}</p>
          </div>
        </div>
      </header>

      <div className="file-case-content">
        <div className="lawyer-info-card">
          <div className="lawyer-image">
            {lawyer?.profile_picture ? (
              <img src={lawyer.profile_picture} alt={lawyer.full_name} />
            ) : (
              <div className="default-avatar">
                <i className="fas fa-user-tie"></i>
              </div>
            )}
          </div>
          <div className="lawyer-details">
            <h3>{lawyer?.full_name}</h3>
            <p><i className="fas fa-envelope"></i> {lawyer?.email}</p>
            <p><i className="fas fa-briefcase"></i> {lawyer?.role}</p>
          </div>
        </div>

        <div className="case-form-container">
          <form onSubmit={handleSubmit} className="case-form">
            <h2>Case Details</h2>
            
            {error && (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="title">Case Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter a descriptive title for your case"
                required
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Case Description *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Provide detailed information about your case"
                rows={6}
                required
                className="form-control"
              />
            </div>

            <div className="form-group">
              <label htmlFor="due_date">Preferred Due Date *</label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
                min={new Date().toISOString().split('T')[0]}
                required
                className="form-control"
              />
            </div>

            <div className="form-actions">
              <Link href="/lawyers" className="btn btn-secondary">
                Cancel
              </Link>
              <Button
                type="submit"
                loading={submitting}
                disabled={submitting}
                className="btn btn-primary"
              >
                <i className="fas fa-gavel"></i> File Case
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FileCase;
