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
  client: {
    id: number;
    username: string;
    full_name: string;
  };
  documents: Array<{
    id: number;
    file_path: string;
    original_name: string;
    uploaded_at: string;
    uploaded_by: number;
  }>;
}

interface DashboardStats {
  totalCases: number;
  pendingCases: number;
  approvedCases: number;
  rejectedCases: number;
  totalDocuments: number;
}

function LawyerDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCases: 0,
    pendingCases: 0,
    approvedCases: 0,
    rejectedCases: 0,
    totalDocuments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'pending' | 'approved' | 'documents'>('pending');
  const [documentsViewMode, setDocumentsViewMode] = useState<'grid' | 'list'>('list');
  const [reviewedByCase, setReviewedByCase] = useState<Record<number, boolean>>({});
  const [docModalCase, setDocModalCase] = useState<Case | null>(null);
  const [documentsSearchTerm, setDocumentsSearchTerm] = useState('');

  const [statusFilter, setStatusFilter] = useState('pending');
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [pendingViewMode, setPendingViewMode] = useState<'grid' | 'list'>('list');
  const [approvedSearchTerm, setApprovedSearchTerm] = useState('');
  const [approvedViewMode, setApprovedViewMode] = useState<'grid' | 'list'>('list');

  const [docPreview, setDocPreview] = useState<{
    doc: Case['documents'][number] | null;
    url: string | null;
    type: 'image' | 'pdf' | 'text' | 'html' | 'unsupported' | null;
    text?: string;
  }>({ doc: null, url: null, type: null });
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [docPreviewsMap, setDocPreviewsMap] = useState<
    Record<number, { url?: string; type: 'image' | 'pdf' | 'text' | 'unsupported'; text?: string }>
  >({});

  // Track which documents the lawyer has viewed/downloaded, per case
  const [viewedByCase, setViewedByCase] = useState<Record<number, Record<number, boolean>>>({});
  
  // Track URLs for cleanup
  const [urlsToCleanup, setUrlsToCleanup] = useState<Set<string>>(new Set());

  const getFileExt = (name: string) => (name.split('.').pop() || '').toLowerCase();

  const getAuthToken = () => (typeof window !== 'undefined' ? localStorage.getItem('access') : null);

  // Detect local dev; Google Docs Viewer cannot load from localhost. We use Blob fallback when local.
  const isLocal =
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  // Load previously viewed docs from localStorage (INSIDE the component)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('viewedDocsByCase');
      if (raw) setViewedByCase(JSON.parse(raw));
    } catch {}
  }, []);

  const markDocViewed = (caseId: number, docId: number) => {
    setViewedByCase((prev) => {
      const curr = prev[caseId] || {};
      if (curr[docId]) return prev;
      const updated = { ...prev, [caseId]: { ...curr, [docId]: true } };
      try {
        localStorage.setItem('viewedDocsByCase', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const fetchDocBlob = async (docId: number) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }
    
    try {
      
      
      const res = await fetch(`/api/documents/download/${docId}`, {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });
      
      
      
      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
          } catch (jsonError) {
        }
        
        if (res.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (res.status === 404) {
          throw new Error('Document not found.');
        } else if (res.status === 403) {
          throw new Error('You do not have permission to access this document.');
        } else {
          throw new Error(`Failed to fetch document: ${errorMessage}`);
        }
      }
      
      const blob = await res.blob();
      
      return blob;
    } catch (error) {

      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Try to provide more specific guidance
        const currentUrl = window.location.href;
        const isLocalhost = currentUrl.includes('localhost');
        const isHttps = currentUrl.startsWith('https://');
        
        let specificAdvice = '';
        if (!isLocalhost) {
          specificAdvice = '\n⚠️  You are not on localhost. Please navigate to http://localhost:3000';
        } else if (isHttps) {
          specificAdvice = '\n⚠️  You are using HTTPS. Please use HTTP instead: http://localhost:3000';
        } else {
          specificAdvice = '\n💡 Try: Hard refresh (Ctrl+Shift+R) or restart the dev server';
        }
        
        throw new Error(`Network Connection Failed${specificAdvice}
            
🔍 Troubleshooting Steps:
1. Hard refresh the page (Ctrl+Shift+R or Ctrl+F5)
2. Ensure you're accessing http://localhost:3000 (not https://)
3. Check if development server is running in terminal
4. Clear browser cache and cookies
5. Try opening in incognito/private mode

Technical details: ${error.message}`);
      }
      
      throw error;
    }
  };

  const ensureDocPreview = async (doc: Case['documents'][number]) => {
    const ext = getFileExt(doc.original_name);
    try {
      setError(null);
      
      
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        const blob = await fetchDocBlob(doc.id);
        const url = URL.createObjectURL(blob);
        
        // Cleanup previous URL if exists
        const prevEntry = docPreviewsMap[doc.id];
        if (prevEntry?.url) {
          URL.revokeObjectURL(prevEntry.url);
        }
        
        setDocPreviewsMap((prev) => ({ ...prev, [doc.id]: { url, type: 'image' } }));
        return;
      }
      if (ext === 'pdf') {
        const blob = await fetchDocBlob(doc.id);
        const url = URL.createObjectURL(blob);
        
        // Cleanup previous URL if exists
        const prevEntry = docPreviewsMap[doc.id];
        if (prevEntry?.url) {
          URL.revokeObjectURL(prevEntry.url);
        }
        
        setDocPreviewsMap((prev) => ({ ...prev, [doc.id]: { url, type: 'pdf' } }));
        return;
      }
      if (['txt', 'md', 'csv', 'json', 'log'].includes(ext)) {
        const blob = await fetchDocBlob(doc.id);
        const text = await blob.text();
        
        // Cleanup previous URL if exists
        const prevEntry = docPreviewsMap[doc.id];
        if (prevEntry?.url) {
          URL.revokeObjectURL(prevEntry.url);
        }
        
        setDocPreviewsMap((prev) => ({ ...prev, [doc.id]: { type: 'text', text } }));
        return;
      }
      setDocPreviewsMap((prev) => ({ ...prev, [doc.id]: { type: 'unsupported' } }));
    } catch (error) {

      setDocPreviewsMap((prev) => ({ ...prev, [doc.id]: { type: 'unsupported' } }));
      
      // Set a more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to load document preview';
      setError(`Failed to load preview for "${doc.original_name}": ${errorMessage}`);
    }
  };

  const getPreviewUrl = async (docId: number) => {
    const token = getAuthToken();
    const res = await fetch('/api/documents/preview-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: docId }),
    });
    if (!res.ok) throw new Error('Failed to create preview token');
    const data = await res.json();
    return data.previewUrl as string;
  };

  // Coerce blob to proper MIME so browser can render in <img> or <iframe>
  const toTypedBlob = async (blob: Blob, desiredType: string) => {
    if (blob.type === desiredType) return blob;
    const buf = await blob.arrayBuffer();
    return new Blob([buf], { type: desiredType });
  };

  const openPreview = async (doc: Case['documents'][number], caseId?: number) => {
    
    
    setIsLoading(true);
    setError(null);
    
    // Cleanup previous preview URL
    if (docPreview.url) {
      URL.revokeObjectURL(docPreview.url);
    }
    
    const ext = getFileExt(doc.original_name);
    try {
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        const raw = await fetchDocBlob(doc.id);
        const typed = await toTypedBlob(
          raw,
          ext === 'svg' ? 'image/svg+xml'
          : ext === 'gif' ? 'image/gif'
          : ext === 'webp' ? 'image/webp'
          : ext === 'bmp' ? 'image/bmp'
          : 'image/' + (ext === 'jpg' ? 'jpeg' : ext)
        );
        const url = URL.createObjectURL(typed);
        
        setDocPreview({ doc, url, type: 'image' });
        if (caseId) markDocViewed(caseId, doc.id);
        return;
      }

      if (ext === 'pdf') {
        const raw = await fetchDocBlob(doc.id);
        const typed = await toTypedBlob(raw, 'application/pdf');
        const url = URL.createObjectURL(typed);
        
        setDocPreview({ doc, url, type: 'pdf' });
        if (caseId) markDocViewed(caseId, doc.id);
        return;
      }

      if (['txt', 'md', 'csv', 'json', 'log'].includes(ext)) {
        const blob = await fetchDocBlob(doc.id);
        const text = await blob.text();
        
        setDocPreview({ doc, url: null, type: 'text', text });
        if (caseId) markDocViewed(caseId, doc.id);
        return;
      }

      if (ext === 'docx') {
        try {
          const blob = await fetchDocBlob(doc.id);
          const arrayBuffer = await blob.arrayBuffer();
          
          // Fix the mammoth import to handle TypeScript properly
          const mammoth = await import('mammoth').then((m) => m.default || m);
          const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
          
          
          setDocPreview({ doc, url: null, type: 'html', text: html });
          if (caseId) markDocViewed(caseId, doc.id);
          return;
        } catch (docxError) {
          
          // Mammoth not installed or conversion failed — fall back gracefully
          setDocPreview({ doc, url: null, type: 'unsupported' });
          if (caseId) markDocViewed(caseId, doc.id);
          setError('DOCX preview not available. Please download the file to view it.');
          return;
        }
      }

      // Unsupported: still set a fallback so UI shows a message and allow download
      
      setDocPreview({ doc, url: null, type: 'unsupported' });
      if (caseId) markDocViewed(caseId, doc.id);
    } catch (error) {

      setDocPreview({ doc, url: null, type: 'unsupported' });
      setError(error instanceof Error ? error.message : 'Failed to load document preview');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDocument = async (doc: Case['documents'][number], caseId?: number) => {
    try {
      setError(null);
      setIsLoading(true);
      
      const blob = await fetchDocBlob(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      // Cleanup URL after a short delay to ensure download starts
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1500);
      
      if (caseId) markDocViewed(caseId, doc.id);
    } catch (error) {

      setError(error instanceof Error ? error.message : 'Unable to download file');
    } finally {
      setIsLoading(false);
    }
  };

  // Improved cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup all URLs when component unmounts
      Object.values(docPreviewsMap).forEach((p) => {
        if (p.url) {
          URL.revokeObjectURL(p.url);
        }
      });
      if (docPreview.url) {
        URL.revokeObjectURL(docPreview.url);
      }
      // Cleanup any tracked URLs
      urlsToCleanup.forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, []); // Only run on unmount

  // Separate effect for cleaning up individual URLs when they change
  useEffect(() => {
    return () => {
      // Cleanup previous URLs when docPreviewsMap changes
      Object.values(docPreviewsMap).forEach((p) => {
        if (p.url && !urlsToCleanup.has(p.url)) {
          setUrlsToCleanup(prev => new Set(prev).add(p.url!));
        }
      });
    };
  }, [docPreviewsMap]);

  // Cleanup effect for docPreview
  useEffect(() => {
    return () => {
      if (docPreview.url && !urlsToCleanup.has(docPreview.url)) {
        setUrlsToCleanup(prev => new Set(prev).add(docPreview.url!));
      }
    };
  }, [docPreview.url]);

  // Periodic cleanup of old URLs
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      urlsToCleanup.forEach(url => {
        URL.revokeObjectURL(url);
      });
      setUrlsToCleanup(new Set());
    }, 30000); // Cleanup every 30 seconds

    return () => clearInterval(cleanupInterval);
  }, [urlsToCleanup]);

  const closePreview = () => {
    // Cleanup URL before closing
    if (docPreview.url) {
      URL.revokeObjectURL(docPreview.url);
    }
    setDocPreview({ doc: null, url: null, type: null, text: undefined });
  };

  const openDocuments = (c: Case) => {
    setDocModalCase(c);
    setReviewedByCase((prev) => ({ ...prev, [c.id]: true }));
  };

  useEffect(() => {
    const token = localStorage.getItem('access');
    const role = localStorage.getItem('role');

    if (!token || (!user && !role)) {
      window.location.href = ROUTES.LOGIN;
      return;
    }

    const hasLawyerAccess = (user && user.role === 'lawyer') || role === 'lawyer';
    if (!hasLawyerAccess) {
      window.location.href = ROUTES.HOME;
      return;
    }

    fetchCases();
  }, [user]);

  const fetchCases = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('access');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await fetch('/api/cases/lawyer', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to access cases.');
        } else {
          throw new Error(`Failed to fetch cases: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      setCases(data);

      const computed: DashboardStats = {
        totalCases: data.length,
        pendingCases: data.filter((case_: Case) => case_.status === 'pending').length,
        approvedCases: data.filter((case_: Case) => case_.status === 'approved').length,
        rejectedCases: data.filter((case_: Case) => case_.status === 'rejected').length,
        totalDocuments: data.reduce((total: number, case_: Case) => total + case_.documents.length, 0),
      };
      setStats(computed);
    } catch (error) {
      console.error('Error fetching cases:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch cases');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => logout();

  const approveCase = async (caseId: number) => {
    try {
      setError(null);
      const token = localStorage.getItem('access');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await fetch(`/api/cases/${caseId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to approve this case.');
        } else if (response.status === 404) {
          throw new Error('Case not found.');
        } else if (response.status === 400) {
          try {
            const data = await response.json();
            const msg = data?.error || 'Please view the document';
            throw new Error(msg);
          } catch {
            throw new Error('Please view the document');
          }
        } else {
          throw new Error(`Failed to approve case: ${response.status} ${response.statusText}`);
        }
      }

      await fetchCases();
      alert('Case approved successfully!');
    } catch (error) {
      console.error('Error approving case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error approving case';
      setError(errorMessage);
      alert(errorMessage);
    }
  };

  const rejectCase = async (caseId: number, rejectionComment: string) => {
    if (!rejectionComment.trim()) {
      setError('Please provide a rejection comment');
      alert('Please provide a rejection comment');
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('access');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await fetch(`/api/cases/${caseId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejection_comment: rejectionComment }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to reject this case.');
        } else if (response.status === 404) {
          throw new Error('Case not found.');
        } else {
          throw new Error(`Failed to reject case: ${response.status} ${response.statusText}`);
        }
      }

      await fetchCases();
      alert('Case rejected successfully!');
    } catch (error) {
      console.error('Error rejecting case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error rejecting case';
      setError(errorMessage);
      alert(errorMessage);
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

  const filteredPendingCases = cases
    .filter((case_) => case_.status === 'pending')
    .filter(
      (case_) =>
        case_.title.toLowerCase().includes(pendingSearchTerm.toLowerCase()) ||
        case_.description.toLowerCase().includes(pendingSearchTerm.toLowerCase()) ||
        case_.client.full_name.toLowerCase().includes(pendingSearchTerm.toLowerCase())
    );

  const filteredApprovedCases = cases
    .filter((case_) => case_.status === 'approved')
    .filter(
      (case_) =>
        case_.title.toLowerCase().includes(approvedSearchTerm.toLowerCase()) ||
        case_.description.toLowerCase().includes(approvedSearchTerm.toLowerCase()) ||
        case_.client.full_name.toLowerCase().includes(approvedSearchTerm.toLowerCase())
    );

  return (
    <div className="dashboard-container">
      {error && (
        <div className="error-banner" style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '12px 20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-exclamation-triangle"></i>
          <span>{error}</span>
          <button 
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#721c24',
              marginLeft: 'auto',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            &times;
          </button>
        </div>
      )}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>Lawyer Dashboard</h1>
            <p>Welcome back, {user?.full_name}</p>
          </div>
        </div>
      </header>

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
        <div className="stat-card rejected">
          <div className="stat-icon">
            <i className="fas fa-times-circle"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.rejectedCases}</h3>
            <p>Rejected Cases</p>
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
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <button className="action-card" onClick={() => setActiveSection('pending')}>
            <div className="action-icon">
              <i className="fas fa-list"></i>
            </div>
            <h3>Pending Cases</h3>
            <p>Review pending cases</p>
          </button>
          <button className="action-card" onClick={() => setActiveSection('approved')}>
            <div className="action-icon">
              <i className="fas fa-check"></i>
            </div>
            <h3>Approved Cases</h3>
            <p>View approved cases</p>
          </button>
          <button className="action-card" onClick={() => setActiveSection('documents')}>
            <div className="action-icon">
              <i className="fas fa-file-alt"></i>
            </div>
            <h3>Client Documents</h3>
            <p>Documents uploaded by clients</p>
          </button>
          <Link href="/chat" className="action-card">
            <div className="action-icon">
              <i className="fas fa-comments"></i>
            </div>
            <h3>Chat</h3>
            <p>Communicate with clients</p>
          </Link>
        </div>
      </div>

      {activeSection === 'pending' && (
        <div className="pending-cases">
          <div className="cases-header">
            <h2>Pending Cases</h2>
            <div className="cases-controls">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <i className="fas fa-search search-icon"></i>
                  <input
                    type="text"
                    placeholder="Search by case title, description, or client name..."
                    value={pendingSearchTerm}
                    onChange={(e) => setPendingSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  {pendingSearchTerm && (
                    <button
                      onClick={() => setPendingSearchTerm('')}
                      className="clear-search"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="view-toggle">
                <button 
                  className={`view-btn ${pendingViewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setPendingViewMode('grid')}
                >
                  <i className="fas fa-th-large"></i>
                </button>
                <button 
                  className={`view-btn ${pendingViewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setPendingViewMode('list')}
                >
                  <i className="fas fa-list"></i>
                </button>
              </div>
            </div>
          </div>

          {(() => {
            // Filter pending cases based on search term
            const filteredPendingCases = cases
              .filter(case_ => case_.status === 'pending')
              .filter(case_ => {
                if (!pendingSearchTerm) return true;
                
                const searchLower = pendingSearchTerm.toLowerCase();
                return case_.title.toLowerCase().includes(searchLower) ||
                       case_.description.toLowerCase().includes(searchLower) ||
                       case_.client.full_name.toLowerCase().includes(searchLower);
              });

            if (filteredPendingCases.length === 0 && pendingSearchTerm) {
              return (
                <div className="no-cases">
                  <i className="fas fa-search"></i>
                  <h3>No pending cases found</h3>
                  <p>No pending cases match your search criteria for "{pendingSearchTerm}"</p>
                  <button 
                    onClick={() => setPendingSearchTerm('')}
                    className="btn-clear-search"
                  >
                    Clear Search
                  </button>
                </div>
              );
            }

            if (filteredPendingCases.length === 0) {
              return (
                <div className="no-cases">
                  <i className="fas fa-check-circle"></i>
                  <h3>No pending cases</h3>
                  <p>All cases have been reviewed!</p>
                </div>
              );
            }

            return (
              <>
                {pendingSearchTerm && (
                  <div className="search-results-info">
                    <span>
                      Showing {filteredPendingCases.length} of {cases.filter(c => c.status === 'pending').length} pending cases
                      {pendingSearchTerm && ` for "${pendingSearchTerm}"`}
                    </span>
                  </div>
                )}

                <div className={`cases-${pendingViewMode}`}>
                  {pendingViewMode === 'grid' ? (
                    // Grid View
                    filteredPendingCases.map((case_) => {
                      const clientDocs = case_.documents.filter((d) => d.uploaded_by === case_.client.id);
                      const hasNoDocuments = clientDocs.length === 0;
                      const canApprove = !hasNoDocuments && clientDocs.some((d) => viewedByCase[case_.id]?.[d.id]);
                      
                      return (
                        <div key={case_.id} className="case-card">
                          <div className="case-header">
                            <h3>{case_.title}</h3>
                            <div className="case-actions">
                              <Button variant="info" size="sm" onClick={() => openDocuments(case_)}>
                                <i className="fas fa-file-alt"></i> View Documents
                              </Button>
                            </div>
                          </div>
                          <div className="case-body">
                            <p className="case-description">{case_.description}</p>
                            <div className="case-meta">
                              <div className="meta-item">
                                <span className="label">Client:</span>
                                <span className="value">{case_.client.full_name}</span>
                              </div>
                              <div className="meta-item">
                                <span className="label">Due Date:</span>
                                <span className="value">{new Date(case_.due_date).toLocaleDateString()}</span>
                              </div>
                              <div className="meta-item">
                                <span className="label">Documents:</span>
                                <span className="value">{clientDocs.length}</span>
                              </div>
                              <div className="meta-item">
                                <span className="label">Created:</span>
                                <span className="value">{new Date(case_.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="case-footer">
                            <span className={`status-badge pending`}>Pending</span>
                            <div className="case-footer-actions">
                              <Button
                                variant="success"
                                size="sm"
                                disabled={!canApprove}
                                onClick={() => approveCase(case_.id)}
                                title={
                                  hasNoDocuments 
                                    ? "This case has no documents" 
                                    : !canApprove 
                                      ? "Please view the document" 
                                      : "Approve this case"
                                }
                              >
                                <i className="fas fa-check"></i> Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  const comment = prompt('Please provide a rejection comment:');
                                  if (comment) rejectCase(case_.id, comment);
                                }}
                              >
                                <i className="fas fa-times"></i> Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // List View
                    <div className="cases-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Case Title</th>
                            <th>Client</th>
                            <th>Due Date</th>
                            <th>Documents</th>
                            <th>Created</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPendingCases.map((case_) => {
                            const clientDocs = case_.documents.filter((d) => d.uploaded_by === case_.client.id);
                            const hasNoDocuments = clientDocs.length === 0;
                            const canApprove = !hasNoDocuments && clientDocs.some((d) => viewedByCase[case_.id]?.[d.id]);
                            
                            return (
                              <tr key={case_.id}>
                                <td>
                                  <div className="case-title-cell">
                                    <strong>{case_.title}</strong>
                                    <small>{case_.description.substring(0, 50)}...</small>
                                  </div>
                                </td>
                                <td>{case_.client.full_name}</td>
                                <td>{new Date(case_.due_date).toLocaleDateString()}</td>
                                <td>
                                  <span className="documents-count">{clientDocs.length}</span>
                                </td>
                                <td>{new Date(case_.created_at).toLocaleDateString()}</td>
                                <td>
                                  <span className="status-badge pending">Pending</span>
                                </td>
                                <td>
                                  <div className="table-actions">
                                    <button
                                      onClick={() => openDocuments(case_)}
                                      className="btn-view-sm"
                                      title="View Documents"
                                    >
                                      <i className="fas fa-file-alt"></i>
                                    </button>
                                    <button
                                      disabled={!canApprove}
                                      onClick={() => approveCase(case_.id)}
                                      className="btn-approve-sm"
                                      title={
                                        hasNoDocuments 
                                          ? "This case has no documents" 
                                          : !canApprove 
                                            ? "View the document first" 
                                            : "Approve this case"
                                      }
                                    >
                                      <i className="fas fa-check"></i>
                                    </button>
                                    <button
                                      onClick={() => {
                                        const comment = prompt('Please provide a rejection comment:');
                                        if (comment) rejectCase(case_.id, comment);
                                      }}
                                      className="btn-reject-sm"
                                      title="Reject this case"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {activeSection === 'approved' && (
        <div className="approved-cases">
          <div className="cases-header">
            <h2>Approved Cases</h2>
            <div className="cases-controls">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <i className="fas fa-search search-icon"></i>
                  <input
                    type="text"
                    placeholder="Search by case title, description, or client name..."
                    value={approvedSearchTerm}
                    onChange={(e) => setApprovedSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  {approvedSearchTerm && (
                    <button
                      onClick={() => setApprovedSearchTerm('')}
                      className="clear-search"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="view-toggle">
                <button 
                  className={`view-btn ${approvedViewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setApprovedViewMode('grid')}
                >
                  <i className="fas fa-th-large"></i>
                </button>
                <button 
                  className={`view-btn ${approvedViewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setApprovedViewMode('list')}
                >
                  <i className="fas fa-list"></i>
                </button>
              </div>
            </div>
          </div>

          {(() => {
            // Filter approved cases based on search term
            const filteredApprovedCases = cases
              .filter(case_ => case_.status === 'approved')
              .filter(case_ => {
                if (!approvedSearchTerm) return true;
                
                const searchLower = approvedSearchTerm.toLowerCase();
                return case_.title.toLowerCase().includes(searchLower) ||
                       case_.description.toLowerCase().includes(searchLower) ||
                       case_.client.full_name.toLowerCase().includes(searchLower);
              });

            if (filteredApprovedCases.length === 0 && approvedSearchTerm) {
              return (
                <div className="no-cases">
                  <i className="fas fa-search"></i>
                  <h3>No approved cases found</h3>
                  <p>No approved cases match your search criteria for "{approvedSearchTerm}"</p>
                  <button 
                    onClick={() => setApprovedSearchTerm('')}
                    className="btn-clear-search"
                  >
                    Clear Search
                  </button>
                </div>
              );
            }

            if (filteredApprovedCases.length === 0) {
              return (
                <div className="no-cases">
                  <i className="fas fa-folder-open"></i>
                  <h3>No approved cases</h3>
                  <p>Approved cases will appear here</p>
                </div>
              );
            }

            return (
              <>
                {approvedSearchTerm && (
                  <div className="search-results-info">
                    <span>
                      Showing {filteredApprovedCases.length} of {cases.filter(c => c.status === 'approved').length} approved cases
                      {approvedSearchTerm && ` for "${approvedSearchTerm}"`}
                    </span>
                  </div>
                )}

                <div className={`cases-${approvedViewMode}`}>
                  {approvedViewMode === 'grid' ? (
                    // Grid View
                    filteredApprovedCases.map((case_) => {
                      const clientDocs = case_.documents.filter((d) => d.uploaded_by === case_.client.id);
                      
                      return (
                        <div key={case_.id} className="case-card">
                          <div className="case-header">
                            <h3>{case_.title}</h3>
                            <div className="case-actions">
                              <Button variant="info" size="sm" onClick={() => openDocuments(case_)}>
                                <i className="fas fa-file-alt"></i> View Documents
                              </Button>
                            </div>
                          </div>
                          <div className="case-body">
                            <p className="case-description">{case_.description}</p>
                            <div className="case-meta">
                              <div className="meta-item">
                                <span className="label">Client:</span>
                                <span className="value">{case_.client.full_name}</span>
                              </div>
                              <div className="meta-item">
                                <span className="label">Due Date:</span>
                                <span className="value">{new Date(case_.due_date).toLocaleDateString()}</span>
                              </div>
                              <div className="meta-item">
                                <span className="label">Documents:</span>
                                <span className="value">{clientDocs.length}</span>
                              </div>
                              <div className="meta-item">
                                <span className="label">Created:</span>
                                <span className="value">{new Date(case_.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="case-footer">
                            <span className={`status-badge approved`}>Approved</span>
                            <div className="case-footer-actions">
                              <Link href={`/cases/${case_.id}`}>
                                <Button variant="primary" size="sm">
                                  <i className="fas fa-eye"></i> View Details
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // List View
                    <div className="cases-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Case Title</th>
                            <th>Client</th>
                            <th>Due Date</th>
                            <th>Documents</th>
                            <th>Created</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredApprovedCases.map((case_) => {
                            const clientDocs = case_.documents.filter((d) => d.uploaded_by === case_.client.id);
                            
                            return (
                              <tr key={case_.id}>
                                <td>
                                  <div className="case-title-cell">
                                    <strong>{case_.title}</strong>
                                    <small>{case_.description.substring(0, 50)}...</small>
                                  </div>
                                </td>
                                <td>{case_.client.full_name}</td>
                                <td>{new Date(case_.due_date).toLocaleDateString()}</td>
                                <td>
                                  <span className="documents-count">{clientDocs.length}</span>
                                </td>
                                <td>{new Date(case_.created_at).toLocaleDateString()}</td>
                                <td>
                                  <span className="status-badge approved">Approved</span>
                                </td>
                                <td>
                                  <div className="table-actions">
                                    <button
                                      onClick={() => openDocuments(case_)}
                                      className="btn-view-sm"
                                      title="View Documents"
                                    >
                                      <i className="fas fa-file-alt"></i>
                                    </button>
                                    <Link href={`/cases/${case_.id}`}>
                                      <button
                                        className="btn-details-sm"
                                        title="View Details"
                                      >
                                        <i className="fas fa-eye"></i>
                                      </button>
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {activeSection === 'documents' && (
        <div className="documents-section">
          <div className="documents-header">
            <h2>Documents uploaded by clients</h2>
            <div className="documents-controls">
              <div className="search-container">
                <div className="search-input-wrapper">
                  <i className="fas fa-search search-icon"></i>
                  <input
                    type="text"
                    placeholder="Search by case title or client name..."
                    value={documentsSearchTerm}
                    onChange={(e) => setDocumentsSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  {documentsSearchTerm && (
                    <button
                      onClick={() => setDocumentsSearchTerm('')}
                      className="clear-search"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
              </div>
              <div className="view-toggle">
                <button 
                  className={`view-btn ${documentsViewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setDocumentsViewMode('grid')}
                >
                  <i className="fas fa-th-large"></i>
                </button>
                <button 
                  className={`view-btn ${documentsViewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setDocumentsViewMode('list')}
                >
                  <i className="fas fa-list"></i>
                </button>
              </div>
            </div>
          </div>
          
          {(() => {
            // Get all client documents from all cases
            const allClientDocuments = cases.flatMap(case_ => 
              case_.documents
                .filter(doc => doc.uploaded_by === case_.client.id)
                .map(doc => ({
                  ...doc,
                  case: case_,
                  clientName: case_.client.full_name
                }))
            );

            // Filter documents based on search term
            const filteredDocuments = allClientDocuments.filter(doc => {
              if (!documentsSearchTerm) return true;
              
              const searchLower = documentsSearchTerm.toLowerCase();
              const caseTitle = doc.case.title.toLowerCase();
              const clientName = doc.clientName.toLowerCase();
              const fileName = doc.original_name.toLowerCase();
              
              return caseTitle.includes(searchLower) || 
                     clientName.includes(searchLower) ||
                     fileName.includes(searchLower);
            });

            if (allClientDocuments.length === 0) {
              return (
                <div className="no-cases">
                  <i className="fas fa-file-alt"></i>
                  <h3>No Client Documents</h3>
                  <p>No documents have been uploaded by clients yet</p>
                </div>
              );
            }

            if (filteredDocuments.length === 0 && documentsSearchTerm) {
              return (
                <div className="no-cases">
                  <i className="fas fa-search"></i>
                  <h3>No documents found</h3>
                  <p>No documents match your search criteria for "{documentsSearchTerm}"</p>
                  <button 
                    onClick={() => setDocumentsSearchTerm('')}
                    className="btn-clear-search"
                  >
                    Clear Search
                  </button>
                </div>
              );
            }

            return (
              <>
                {documentsSearchTerm && (
                  <div className="search-results-info">
                    <span>
                      Showing {filteredDocuments.length} of {allClientDocuments.length} documents
                      {documentsSearchTerm && ` for "${documentsSearchTerm}"`}
                    </span>
                  </div>
                )}
                
                <div className={`documents-${documentsViewMode}`}>
                  {documentsViewMode === 'grid' ? (
                    // Grid View
                    filteredDocuments.map((doc) => {
                      const entry = docPreviewsMap[doc.id];
                      const ext = (doc.original_name.split('.').pop() || '').toUpperCase();
                      
                      return (
                        <div key={`${doc.case.id}-${doc.id}`} className="document-item">
                          <div className="document-header">
                            <h4>{doc.original_name}</h4>
                            <span className="file-type">{ext}</span>
                          </div>
                          
                          <div className="document-preview">
                            {entry?.url ? (
                              entry.type === 'image' ? (
                                <img src={entry.url} alt={doc.original_name} />
                              ) : entry.type === 'text' ? (
                                <div className="text-preview">{entry.text?.substring(0, 200)}...</div>
                              ) : (
                                <div className="preview-placeholder">
                                  <i className="fas fa-file"></i>
                                  <span>Preview available</span>
                                </div>
                              )
                            ) : (
                              <div className="preview-placeholder">
                                <i className="fas fa-file"></i>
                                <span>Click Preview to load</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="document-meta">
                            <p><strong>Case:</strong> {doc.case.title}</p>
                            <p><strong>Client:</strong> {doc.clientName}</p>
                            <p><strong>Uploaded:</strong> {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                          </div>
                          
                          <div className="document-actions">
                            <button
                              onClick={() => {
                                ensureDocPreview(doc);
                                markDocViewed(doc.case.id, doc.id);
                              }}
                              className="btn-preview"
                            >
                              <i className="fas fa-eye"></i> Preview
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const blob = await fetchDocBlob(doc.id);
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = doc.original_name;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                  markDocViewed(doc.case.id, doc.id);
                                } catch (error) {
                                  console.error('Download failed:', error);
                                  setError(error instanceof Error ? error.message : 'Download failed');
                                }
                              }}
                              className="btn-download"
                            >
                              <i className="fas fa-download"></i> Download
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // List View
                    <div className="documents-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Document Name</th>
                            <th>Case</th>
                            <th>Client</th>
                            <th>Type</th>
                            <th>Upload Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDocuments.map((doc) => {
                            const ext = (doc.original_name.split('.').pop() || '').toUpperCase();
                            
                            return (
                              <tr key={`${doc.case.id}-${doc.id}`}>
                                <td>
                                  <div className="document-name">
                                    <i className="fas fa-file"></i>
                                    <span>{doc.original_name}</span>
                                  </div>
                                </td>
                                <td>{doc.case.title}</td>
                                <td>{doc.clientName}</td>
                                <td>
                                  <span className="file-type-badge">{ext}</span>
                                </td>
                                <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                                <td>
                                  <div className="table-actions">
                                    <button
                                      onClick={() => {
                                        ensureDocPreview(doc);
                                        markDocViewed(doc.case.id, doc.id);
                                      }}
                                      className="btn-preview-sm"
                                      title="Preview"
                                    >
                                      <i className="fas fa-eye"></i>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        try {
                                          const blob = await fetchDocBlob(doc.id);
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = doc.original_name;
                                          document.body.appendChild(a);
                                          a.click();
                                          document.body.removeChild(a);
                                          URL.revokeObjectURL(url);
                                          markDocViewed(doc.case.id, doc.id);
                                        } catch (error) {
                                          console.error('Download failed:', error);
                                          setError(error instanceof Error ? error.message : 'Download failed');
                                        }
                                      }}
                                      className="btn-download-sm"
                                      title="Download"
                                    >
                                      <i className="fas fa-download"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {docModalCase && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Documents for: {docModalCase.title}</h3>
              <button className="close" onClick={() => setDocModalCase(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {docModalCase.documents.filter((d) => d.uploaded_by === docModalCase.client.id).length === 0 ? (
                <p>No client documents uploaded.</p>
              ) : (
                <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {docModalCase.documents
                    .filter((d) => d.uploaded_by === docModalCase.client.id)
                    .map((doc) => {
                      const entry = docPreviewsMap[doc.id];
                      const ext = (doc.original_name.split('.').pop() || '').toUpperCase();
                      return (
                        <li
                          key={doc.id}
                          style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}
                        >
                          <div style={{ flex: 1 }}>
                            {entry?.type === 'image' && entry.url && (
                              <img
                                src={entry.url}
                                alt={doc.original_name}
                                style={{
                                  maxWidth: 160,
                                  maxHeight: 120,
                                  objectFit: 'cover',
                                  borderRadius: 6,
                                  border: '1px solid #eee',
                                }}
                              />
                            )}
                            {entry?.type === 'pdf' && entry.url && (
                              <iframe
                                src={entry.url}
                                style={{ width: 200, height: 140, border: '1px solid #eee', borderRadius: 6 }}
                                title={`PDF ${doc.original_name}`}
                              />
                            )}
                            {entry?.type === 'text' && (
                              <pre
                                style={{
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  maxWidth: 300,
                                  maxHeight: 120,
                                  overflow: 'auto',
                                  padding: 8,
                                  background: '#fafafa',
                                  border: '1px solid #eee',
                                  borderRadius: 6,
                                }}
                              >
                                {entry.text?.slice(0, 300) || 'No content'}
                              </pre>
                            )}
                            {!entry && (
                              <div style={{ color: '#888', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fas fa-spinner fa-spin"></i>
                                <span>Loading preview...</span>
                              </div>
                            )}
                            {entry && entry.type === 'unsupported' && (
                              <div style={{ color: '#666', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fas fa-file"></i>
                                <span>{ext} file</span>
                              </div>
                            )}
                          </div>

                          {/* Inside the “Documents for: …” modal list */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button variant="secondary" size="sm" onClick={() => openPreview(doc, docModalCase.id)}>
                              <i className="fas fa-eye"></i> Preview
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => downloadDocument(doc, docModalCase.id)}>
                              <i className="fas fa-download"></i> Download
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setDocModalCase(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {docPreview.type && (
        <div className="modal-overlay" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000 
        }}>
          <div className="modal" style={{ 
            maxWidth: '900px', 
            width: '95%', 
            backgroundColor: 'white', 
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div className="modal-header" style={{ 
              padding: '16px', 
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3>Preview: {docPreview.doc?.original_name}</h3>
              <button 
                className="close" 
                onClick={closePreview}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer' 
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflow: 'auto' }}>
              {docPreview.type === 'image' && docPreview.url && (
                <img src={docPreview.url} alt="preview" style={{ maxWidth: '100%', height: 'auto' }} />
              )}

              {docPreview.type === 'pdf' && docPreview.url && (
                <iframe
                  src={docPreview.url}
                  title="PDF Preview"
                  style={{ width: '100%', height: '80vh', border: 'none' }}
                />
              )}

              {docPreview.type === 'text' && (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {docPreview.text || 'No content'}
                </pre>
              )}

              {docPreview.type === 'html' && docPreview.text && (
                <div
                  style={{ width: '100%', height: '80vh', overflow: 'auto', background: '#fff', padding: 16 }}
                  dangerouslySetInnerHTML={{ __html: docPreview.text }}
                />
              )}

              {docPreview.type === 'unsupported' && (
                <div className="unsupported-preview">
                  <i className="fas fa-file"></i>
                  <p>Preview not supported for this file type.</p>
                  <p>Please download the file to view its contents.</p>
                  {error && (
                    <p style={{ color: '#dc3545', fontSize: '0.9rem', marginTop: '8px' }}>
                      {error}
                    </p>
                  )}
                  {docPreview.url && (
                    <a
                      href={docPreview.url}
                      className="btn btn-sm btn-outline-secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className="fas fa-download"></i> Download
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
              {docPreview.url && (
                <a
                  href={docPreview.url}
                  download={docPreview.doc?.original_name || 'document'}
                >
                  <Button variant="primary">
                    <i className="fas fa-download"></i> Download
                  </Button>
                </a>
              )}
              <Button variant="secondary" onClick={closePreview}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LawyerDashboard;
