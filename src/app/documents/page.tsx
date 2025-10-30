'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './documents.css';

interface Document {
  id: number;
  filename: string;
  original_name: string;
  case_id: number;
  uploaded_at: string;
  file_size: number;
  case_title?: string;
  case_status?: string;
  uploaded_by_name?: string;
}

interface Case {
  id: number;
  title: string;
  status: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editForm, setEditForm] = useState({
    documentName: '',
    caseId: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCase, setFilterCase] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();
  // Pagination for faster initial loads
  const [cursorUploadedAt, setCursorUploadedAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Add a reusable documents fetcher and use consistent token key
  const fetchDocuments = async (loadMore: boolean = false) => {
    const LIMIT = 50;
    try {
      if (!loadMore) setLoading(true);
      if (loadMore) setLoadingMore(true);
      setError(null);

      const token = localStorage.getItem('access');
      if (!token) {
        setError('No authentication token found. Please log in again.');
        router.push('/auth/login');
        return;
      }

      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (loadMore && cursorUploadedAt) {
        params.set('cursorUploadedAt', cursorUploadedAt);
      }

      const response = await fetch(`/api/documents?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();

        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
          localStorage.removeItem('access');
          router.push('/auth/login');
          return;
        }

        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      const newDocs: Document[] = Array.isArray(data.documents) ? data.documents : [];
      setDocuments(prev => (loadMore ? [...prev, ...newDocs] : newDocs));
      const nextCursor = data?.nextCursorUploadedAt || null;
      setCursorUploadedAt(nextCursor);
      setHasMore(newDocs.length === LIMIT && !!nextCursor);
      setError(null);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError(`Failed to fetch documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (!loadMore) setDocuments([]);
      setHasMore(false);
    } finally {
      if (!loadMore) setLoading(false);
      if (loadMore) setLoadingMore(false);
    }
  };
  const fetchCases = async () => {
    try {
      const token = localStorage.getItem('access');
      if (!token) return;

      const response = await fetch('/api/cases/client', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Normalize the response: handle both array and { cases: [...] }
        const casesArray = Array.isArray(data?.cases) ? data.cases : (Array.isArray(data) ? data : []);
        setCases(casesArray);
      } else {
        console.error('Failed to fetch cases:', response.status);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  // Trigger initial data load
  useEffect(() => {
    fetchDocuments();
    fetchCases();
  }, []);

  // Recompute filtered documents when inputs change
  useEffect(() => {
    filterAndSortDocuments();
  }, [documents, searchTerm, filterCase, filterStatus, sortBy, sortOrder]);

  const filterAndSortDocuments = () => {
    let filtered = documents.filter(doc => {
      const matchesSearch = doc.original_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (doc.case_title && doc.case_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (doc.uploaded_by_name && doc.uploaded_by_name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCase = filterCase === null || doc.case_id === filterCase;
      const matchesStatus = filterStatus === '' || doc.case_status === filterStatus;
      
      return matchesSearch && matchesCase && matchesStatus;
    });

    // Sort documents
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.original_name.localeCompare(b.original_name);
          break;
        case 'date':
          comparison = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
          break;
        case 'size':
          comparison = a.file_size - b.file_size;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredDocuments(filtered);
  };

  const handleEdit = async (document: Document) => {
    setEditingDocument(document);
    setEditForm({
      documentName: document.original_name,
      caseId: document.case_id
    });
  };

  const handleSave = async () => {
    if (!editingDocument) return;

    try {
      const token = localStorage.getItem('access');
      const response = await fetch(`/api/documents/${editingDocument.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentName: editForm.documentName,
          caseId: editForm.caseId
        })
      });

      if (response.ok) {
        await fetchDocuments();
        setEditingDocument(null);
        alert('Document updated successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to update document: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Error updating document');
    }
  };

  const handleSaveWithFile = async (file: File | null) => {
    if (!editingDocument) return;

    try {
      const token = localStorage.getItem('access');
      const formData = new FormData();
      formData.append('documentName', editForm.documentName);
      formData.append('caseId', editForm.caseId.toString());
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch(`/api/documents/${editingDocument.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        await fetchDocuments();
        setEditingDocument(null);
        alert('Document updated successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to update document: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating document:', error);
      alert('Error updating document');
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Fix: Change 'token' to 'access'
      const token = localStorage.getItem('access');
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchDocuments();
        alert('Document deleted successfully!');
      } else {
        alert('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    }
  };

  const handleDownload = async (docItem: Document) => {
    try {
      const token = localStorage.getItem('access');
      if (!token) {
        alert('Please log in to download documents');
        return;
      }

      const response = await fetch(`/api/documents/download/${docItem.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();

        if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
          const url = window.URL.createObjectURL(blob);
          const a = window.document.createElement('a');
          a.href = url;
          a.download = docItem.original_name || 'document';
          window.document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          window.document.body.removeChild(a);
        }
      } else {
        try {
          const errorData = await response.json();
          alert(`Failed to download document: ${errorData.error || 'Unknown error'}`);
        } catch {
          alert(`Failed to download document: HTTP ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('An error occurred while downloading the document');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCase(null);
    setFilterStatus('');
    setSortBy('date');
    setSortOrder('desc');
  };

  const refreshDocuments = () => {
    setLoading(true);
    fetchDocuments();
  };

  if (loading) {
    return (
      <div className="documents-container">
        <div className="loading-spinner">
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="documents-container">
        <div className="error-message">
          <h3>Error Loading Documents</h3>
          <p>{error}</p>
          <button onClick={fetchDocuments} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="documents-container">
      <div className="documents-header">
        <h1>Document Management</h1>
        <button onClick={fetchDocuments} className="refresh-button">
          Refresh
        </button>
      </div>

      {/* Search and Filter Controls */}
      <div className="controls-section">
        <div className="search-controls">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={filterCase || ''}
            onChange={(e) => setFilterCase(e.target.value ? parseInt(e.target.value) : null)}
            className="filter-select"
          >
            <option value="">All Cases</option>
            {cases.map(caseItem => (
              <option key={caseItem.id} value={caseItem.id}>
                {caseItem.title}
              </option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        
        <div className="sort-controls">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
            className="sort-select"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order-button"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="documents-list">
        {filteredDocuments.length === 0 ? (
          <div className="no-documents">
            <p>No documents found.</p>
            {documents.length === 0 && (
              <p>Upload some documents to get started.</p>
            )}
          </div>
        ) : (
          filteredDocuments.map(document => (
            <div key={document.id} className="document-card">
              {/* Document card content */}
              <div className="document-info">
                <h3>{document.original_name}</h3>
                <p>Case: {document.case_title}</p>
                <p>Status: <span className={`status-badge ${document.case_status}`}>{document.case_status}</span></p>
                <p>Uploaded: {new Date(document.uploaded_at).toLocaleDateString()}</p>
                <p>Size: {(document.file_size / 1024).toFixed(2)} KB</p>
                {document.uploaded_by_name && (
                  <p>Uploaded by: {document.uploaded_by_name}</p>
                )}
              </div>
              
              {/* Edit Form */}
              {editingDocument?.id === document.id ? (
                <EditDocumentForm 
                  document={editingDocument}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  cases={cases}
                  onSave={handleSave}
                  onSaveWithFile={handleSaveWithFile}
                  onCancel={() => setEditingDocument(null)}
                />
              ) : (
                <div className="document-actions">
                  <button onClick={() => handleEdit(document)} className="btn-secondary">
                    Edit
                  </button>
                  <button onClick={() => handleDownload(document)} className="btn-primary">
                    Download
                  </button>
                  <button onClick={() => handleDelete(document.id)} className="btn-danger">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {hasMore && (
        <div className="load-more">
          <button
            className="btn btn-outline-primary"
            onClick={() => fetchDocuments(true)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

    </div>
  );
}

// Edit Document Form Component
interface EditDocumentFormProps {
  document: Document;
  editForm: { documentName: string; caseId: number };
  setEditForm: React.Dispatch<React.SetStateAction<{ documentName: string; caseId: number }>>;
  cases: Case[];
  onSave: () => void;
  onSaveWithFile: (file: File | null) => void;
  onCancel: () => void;
}

function EditDocumentForm({ 
  document, 
  editForm, 
  setEditForm, 
  cases, 
  onSave, 
  onSaveWithFile, 
  onCancel 
}: EditDocumentFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replaceFile, setReplaceFile] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replaceFile && selectedFile) {
      onSaveWithFile(selectedFile);
    } else {
      onSave();
    }
  };

  return (
    <div className="edit-form">
      <h3>Edit Document</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="documentName">Document Name</label>
          <input
            type="text"
            id="documentName"
            className="form-input"
            value={editForm.documentName}
            onChange={(e) => setEditForm({ ...editForm, documentName: e.target.value })}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="caseId">Case</label>
          <select
            id="caseId"
            className="form-select"
            value={editForm.caseId}
            onChange={(e) => setEditForm({ ...editForm, caseId: parseInt(e.target.value) })}
            required
          >
            <option value="">Select a case...</option>
            {cases.map(caseItem => (
              <option key={caseItem.id} value={caseItem.id}>
                {caseItem.title}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={replaceFile}
              onChange={(e) => setReplaceFile(e.target.checked)}
            />
            Replace file
          </label>
        </div>
        
        {replaceFile && (
          <div className="form-group">
            <label htmlFor="file">New File</label>
            <input
              type="file"
              id="file"
              className="form-input"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            />
            {selectedFile && (
              <p className="file-info">Selected: {selectedFile.name}</p>
            )}
          </div>
        )}
        
        <div className="edit-actions">
          <button type="submit" className="btn-primary">
            Save Changes
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}