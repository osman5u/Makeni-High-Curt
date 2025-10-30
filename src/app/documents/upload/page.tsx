'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import Link from 'next/link';

interface Case {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  due_date: string;
  created_at: string;
  lawyer_name: string;
  lawyer_email: string;
}

const DocumentUpload = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [pendingCases, setPendingCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access');
      const role = localStorage.getItem('role');
      
      if (!token || role !== 'client') {
        router.push(ROUTES.LOGIN);
        return;
      }
      
      fetchPendingCases();
    }
  }, [router]);

  const fetchPendingCases = async () => {
    try {
      const token = localStorage.getItem('access');
      const response = await fetch('/api/cases', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        // Fix: Change from data.cases to data
        const pending = data.filter((caseItem: Case) => caseItem.status === 'pending');
        setPendingCases(pending);
      } else {
        console.error('Failed to fetch cases');
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedCaseId) {
      alert('Please select both a case and a file to upload.');
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
        router.push('/dashboard/client');
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
      <div className="upload-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading pending cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-container">
      <div className="upload-header">
        <Link href="/dashboard/client" className="back-link">
          ← Back to Dashboard
        </Link>
        <h1>Upload Document</h1>
        <p>Select a pending case and upload your document</p>
      </div>

      <div className="upload-content">
        {pendingCases.length === 0 ? (
          <div className="no-cases">
            <h3>No Pending Cases</h3>
            <p>You don't have any pending cases to upload documents for.</p>
            <Link href="/file-case" className="file-case-btn">
              File a New Case
            </Link>
          </div>
        ) : (
          <>
            <div className="case-selection">
              <h3>Select a Pending Case</h3>
              <div className="cases-grid">
                {pendingCases.map((case_) => (
                  <div
                    key={case_.id}
                    className={`case-card ${
                      selectedCaseId === case_.id ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedCaseId(case_.id)}
                  >
                    <div className="case-header">
                      <h4>{case_.title}</h4>
                      <span className="case-status pending">{case_.status}</span>
                    </div>
                    <p className="case-description">{case_.description}</p>
                    <div className="case-details">
                      <p><strong>Lawyer:</strong> {case_.lawyer_name}</p>
                      <p><strong>Due Date:</strong> {new Date(case_.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="file-upload">
              <h3>Upload Document</h3>
              <div className="upload-area">
                <input
                  type="file"
                  id="document-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  className="file-input"
                />
                <label htmlFor="document-upload" className="file-label">
                  {selectedFile ? selectedFile.name : 'Choose File'}
                </label>
                {selectedFile && (
                  <div className="file-info">
                    <p>File: {selectedFile.name}</p>
                    <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
              </div>
            </div>

            <div className="upload-actions">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedCaseId || uploading}
                className="upload-btn"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;