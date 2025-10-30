'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/constants';
import './document-management.css';

interface DocumentItem {
  id: number;
  original_name: string;
  file_path: string;
  file_size: number;
  case_id: number;
  uploaded_at: string;
  uploaded_by: number;
  case_title?: string | null;
  case_status?: string | null;
  uploaded_by_name?: string | null;
}

function DocumentManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [alert, setAlert] = useState<{ show: boolean; variant: string; message: string }>({ show: false, variant: '', message: '' });
  const [caseIdFilter, setCaseIdFilter] = useState<string>('');

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && !user.is_superuser))) {
      router.push(ROUTES.HOME);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.is_superuser)) {
      fetchDocuments();
    }
  }, [user]);

  const showAlert = (variant: string, message: string) => {
    setAlert({ show: true, variant, message });
    setTimeout(() => setAlert({ show: false, variant: '', message: '' }), 3000);
  };

  const fetchDocuments = async () => {
    try {
      setLoadingData(true);
      const token = localStorage.getItem('access');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const url = caseIdFilter ? `/api/documents?caseId=${encodeURIComponent(caseIdFilter)}` : '/api/documents';
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showAlert('danger', err.error || 'Failed to fetch documents');
        return;
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e) {
      console.error('Error fetching documents:', e);
      showAlert('danger', 'Error fetching documents');
    } finally {
      setLoadingData(false);
    }
  };

  // Download handler: fetch the file, convert to blob, and trigger a download
  const handleDownload = async (doc: DocumentItem) => {
    try {
      const token = localStorage.getItem('access');
      const res = await fetch(`/api/documents/download/${doc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showAlert('danger', err.error || 'Failed to download document');
        return;
      }
  
      const blob = await res.blob();
  
      // Try to extract filename from Content-Disposition, fallback to doc.original_name
      const cd = res.headers.get('Content-Disposition') || '';
      const match = /filename=\"?([^\";]+)\"?/i.exec(cd);
      const filename = match?.[1] || doc.original_name || `document-${doc.id}`;
  
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download error:', e);
      showAlert('danger', 'Error downloading document');
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState<string>('');
  const [caseStatusFilter, setCaseStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortKey, setSortKey] = useState<'uploaded_at' | 'original_name' | 'file_size' | 'case_title'>('uploaded_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredDocuments = React.useMemo(() => {
    let data = [...documents];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter(d =>
        d.original_name.toLowerCase().includes(q) ||
        (d.case_title?.toLowerCase().includes(q)) ||
        (d.uploaded_by_name?.toLowerCase().includes(q))
      );
    }
    if (uploaderFilter.trim()) {
      const q = uploaderFilter.toLowerCase();
      data = data.filter(d => (d.uploaded_by_name || '').toLowerCase().includes(q));
    }
    if (caseStatusFilter !== 'all') {
      data = data.filter(d => (d.case_status || '').toLowerCase() === caseStatusFilter);
    }
    if (fromDate) {
      const from = new Date(fromDate);
      data = data.filter(d => new Date(d.uploaded_at) >= from);
    }
    if (toDate) {
      const to = new Date(toDate);
      data = data.filter(d => new Date(d.uploaded_at) <= to);
    }

    data.sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case 'original_name':
          va = a.original_name.toLowerCase(); vb = b.original_name.toLowerCase(); break;
        case 'file_size':
          va = a.file_size; vb = b.file_size; break;
        case 'case_title':
          va = (a.case_title || '').toLowerCase(); vb = (b.case_title || '').toLowerCase(); break;
        default:
          va = new Date(a.uploaded_at).getTime();
          vb = new Date(b.uploaded_at).getTime();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [documents, searchTerm, uploaderFilter, caseStatusFilter, fromDate, toDate, sortKey, sortDir]);

  if (loading || loadingData) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading document management...</p>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && !user.is_superuser)) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="case-management-container">
      <header className="management-header">
        <div className="header-content">
          <div className="header-left">
            <Link href="/dashboard/admin" className="btn btn-outline-light me-3">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <h1>Document Management</h1>
          </div>
          <div className="header-right">
            <button className="btn btn-primary" onClick={fetchDocuments}>
              <i className="fas fa-sync"></i> Refresh
            </button>
          </div>
        </div>
      </header>

      {alert.show && (
        <div className={`alert alert-${alert.variant} alert-dismissible fade show`} role="alert">
          {alert.message}
          <button type="button" className="btn-close" onClick={() => setAlert({ show: false, variant: '', message: '' })}></button>
        </div>
      )}

      <div className="cases-table-container">
        <div className="d-flex align-items-center mb-3">
          <input
            type="text"
            className="form-control me-2"
            placeholder="Filter by Case ID"
            value={caseIdFilter}
            onChange={e => setCaseIdFilter(e.target.value)}
          />
          <button className="btn btn-outline-primary" onClick={fetchDocuments}>
            Apply Filter
          </button>
        </div>
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Original Name</th>
              <th>Case</th>
              <th>Status</th>
              <th>Uploaded By</th>
              <th>Uploaded At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr><td colSpan={7} className="text-center">No documents found</td></tr>
            ) : (
              documents.map(doc => (
                <tr key={doc.id}>
                  <td>{doc.id}</td>
                  <td>{doc.original_name}</td>
                  <td>{doc.case_title || `#${doc.case_id}`}</td>
                  <td><span className="badge bg-secondary">{doc.case_status || 'N/A'}</span></td>
                  <td>{doc.uploaded_by_name || doc.uploaded_by}</td>
                  <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleDownload(doc)}>
                      <i className="fas fa-download"></i> Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentManagement;