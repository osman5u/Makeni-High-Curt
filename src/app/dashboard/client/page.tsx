'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import './dashboard.css';

interface Case {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  due_date: string;
  created_at: string;
  updated_at?: string;
  rejection_comment?: string | null;
  lawyer?: {
    id: number | null;
    username?: string | null;
    full_name?: string | null;
    email?: string | null;
  } | null;
  documents: { id: number }[];
}

interface DashboardStats {
  totalCases: number;
  pendingCases: number;
  approvedCases: number;
  rejectedCases: number;
  totalDocuments: number;
}

const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCases: 0,
    pendingCases: 0,
    approvedCases: 0,
    rejectedCases: 0,
    totalDocuments: 0
  });
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Check authentication from context or localStorage
    const token = localStorage.getItem('access');
    const role = localStorage.getItem('role');
    
    if (!token || (!user && !role)) {
      // No authentication found
      window.location.href = ROUTES.LOGIN;
      return;
    }
    
    // Check if user has client access
    const hasClientAccess = (user && user.role === 'client') || (role === 'client');
    
    if (!hasClientAccess) {
      window.location.href = ROUTES.HOME;
      return;
    }

    fetchCases();
  }, [user, router]);

  const fetchCases = async () => {
    try {
      const token = localStorage.getItem('access');
      const response = await fetch('/api/cases/client', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const casesArray: Case[] = Array.isArray(data?.cases) ? data.cases : [];
        setCases(casesArray);

        const totalDocuments = casesArray.reduce((sum, c) => sum + (Array.isArray(c.documents) ? c.documents.length : 0), 0);
        const stats = {
          totalCases: casesArray.length,
          pendingCases: casesArray.filter((case_: Case) => case_.status === 'pending').length,
          approvedCases: casesArray.filter((case_: Case) => case_.status === 'approved').length,
          rejectedCases: casesArray.filter((case_: Case) => case_.status === 'rejected').length,
          totalDocuments,
        };
        setStats(stats);
      } else {
        setCases([]);
        setStats({ totalCases: 0, pendingCases: 0, approvedCases: 0, rejectedCases: 0, totalDocuments: 0 });
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleUploadDocument = () => {
    const pendingCases = cases.filter(case_ => case_.status === 'pending');
    if (pendingCases.length === 0) {
      alert('You have no pending cases to upload documents for.');
      return;
    }
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !selectedCaseId) {
      alert('Please select both a file and a case.');
      return;
    }

    try {
      setUploading(true);
      const token = localStorage.getItem('access');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('caseId', selectedCaseId.toString());

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        alert('Document uploaded successfully!');
        setShowUploadModal(false);
        setSelectedFile(null);
        setSelectedCaseId(null);
        fetchCases(); // Refresh cases
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const pendingCases = cases.filter(case_ => case_.status === 'pending');

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Client Dashboard</h1>
            <p>Welcome back, {user?.full_name}</p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-folder"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.totalCases}</h3>
            <p>Total Cases</p>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.pendingCases}</h3>
            <p>Pending Cases</p>
          </div>
        </div>
        <div className="stat-card approved">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.approvedCases}</h3>
            <p>Approved Cases</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.totalDocuments}</h3>
            <p>Total Documents</p>
          </div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-icon">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.rejectedCases}</h3>
            <p>Rejected Cases</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <Link href="/lawyers" className="action-card">
            <div className="action-icon">
              <i className="fas fa-plus"></i>
            </div>
            <h3>File New Case</h3>
            <p>Choose a lawyer and file a case</p>
          </Link>
          <Link href="/cases" className="action-card">
            <div className="action-icon">
              <i className="fas fa-list"></i>
            </div>
            <h3>View All Cases</h3>
            <p>See all your cases</p>
          </Link>
          <div 
            className={`action-card ${pendingCases.length === 0 ? 'disabled' : ''}`}
            onClick={handleUploadDocument}
            style={{ cursor: pendingCases.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <div className="action-icon">
              <i className="fas fa-cloud-upload-alt"></i>
            </div>
            <h3>Upload Document</h3>
            <p>{pendingCases.length > 0 ? `Upload docs for ${pendingCases.length} pending case${pendingCases.length > 1 ? 's' : ''}` : 'No pending cases'}</p>
          </div>
          <Link href="/documents" className="action-card">
            <div className="action-icon">
              <i className="fas fa-file-alt"></i>
            </div>
            <h3>Documents</h3>
            <p>Manage your documents</p>
          </Link>
          <Link href="/chat" className="action-card">
            <div className="action-icon">
              <i className="fas fa-comments"></i>
            </div>
            <h3>Chat</h3>
            <p>Communicate with lawyers</p>
          </Link>
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Document</h3>
              <button 
                className="modal-close"
                onClick={() => setShowUploadModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="caseSelect">Select Pending Case</label>
                <select 
                  id="caseSelect"
                  className="form-control"
                  value={selectedCaseId || ''}
                  onChange={(e) => setSelectedCaseId(Number(e.target.value))}
                >
                  <option value="">Choose a case...</option>
                  {pendingCases.map((case_) => (
                    <option key={case_.id} value={case_.id}>
                      {case_.title} - {case_.lawyer?.full_name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="fileInput">Select Document</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="fileInput"
                    className="file-input"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  />
                  <div className="file-upload-content">
                    <i className="fas fa-cloud-upload-alt"></i>
                    <p>{selectedFile ? selectedFile.name : 'Click to select a file'}</p>
                    <p className="file-hint">PDF, DOC, DOCX, TXT, JPG, PNG (Max 10MB)</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleUploadSubmit}
                disabled={uploading || !selectedFile || !selectedCaseId}
              >
                {uploading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Uploading...
                  </>
                ) : (
                  <>
                    <i className="fas fa-upload"></i> Upload Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Cases */}
      <div className="recent-cases">
        <h2>Recent Cases</h2>
        {cases.length === 0 ? (
          <div className="no-cases">
            <i className="fas fa-folder-open"></i>
            <h3>No cases yet</h3>
            <p>You haven't filed any cases yet. Start by filing your first case!</p>
            <Link href="/lawyers" className="btn btn-primary">
              File Your First Case
            </Link>
          </div>
        ) : (
          <div className="cases-list">
            {cases.slice(0, 5).map((case_) => (
              <div key={case_.id} className="case-item">
                <div className="case-info">
                  <h4>{case_.title}</h4>
                  <p>{case_.description}</p>
                  <div className="case-meta">
                    <span className={`status status-${case_.status}`}>
                      {case_.status.charAt(0).toUpperCase() + case_.status.slice(1)}
                    </span>
                    <span className="lawyer">
                      Lawyer: {case_.lawyer?.full_name || 'Unknown'}
                    </span>
                    <span className="date">
                      Due: {new Date(case_.due_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="case-actions">
                  <Link href={`/cases/${case_.id}`} className="btn btn-sm btn-outline-primary">
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
