'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import './case-management.css';

interface Case {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  client_name: string;
  lawyer_name: string;
  client_id: number;
  lawyer_id: number | null;
}

interface Lawyer {
  id: number;
  full_name: string;
  username: string;
}

const CaseManagement = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [selectedLawyer, setSelectedLawyer] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && !user.is_superuser))) {
      router.push(ROUTES.HOME);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.is_superuser)) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const token = localStorage.getItem('access');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [casesResponse, lawyersResponse] = await Promise.all([
        fetch('/api/admin/cases', { headers }),
        fetch('/api/admin/available-lawyers', { headers })
      ]);

      if (casesResponse.ok) {
        const casesData = await casesResponse.json();
        setCases(casesData);
      }

      if (lawyersResponse.ok) {
        const lawyersData = await lawyersResponse.json();
        setLawyers(lawyersData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showAlert('danger', 'Error fetching data');
    } finally {
      setLoadingData(false);
    }
  };

  const showAlert = (variant: string, message: string) => {
    setAlert({ show: true, variant, message });
    setTimeout(() => setAlert({ show: false, variant: '', message: '' }), 3000);
  };

  const handleAssignLawyer = async () => {
    if (!selectedCase || !selectedLawyer) {
      showAlert('danger', 'Please select a lawyer');
      return;
    }

    try {
      const token = localStorage.getItem('access');
      const response = await fetch('/api/admin/assign-lawyer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseId: selectedCase.id,
          lawyerId: parseInt(selectedLawyer)
        }),
      });

      if (response.ok) {
        showAlert('success', 'Lawyer assigned successfully');
        fetchData();
        setShowAssignModal(false);
        setSelectedCase(null);
        setSelectedLawyer('');
      } else {
        const errorData = await response.json();
        showAlert('danger', errorData.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error assigning lawyer:', error);
      showAlert('danger', 'An error occurred while assigning lawyer');
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedCase || !selectedStatus) {
      showAlert('danger', 'Please select a status');
      return;
    }

    try {
      const token = localStorage.getItem('access');
      const response = await fetch('/api/admin/update-case-status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseId: selectedCase.id,
          status: selectedStatus
        }),
      });

      if (response.ok) {
        showAlert('success', 'Case status updated successfully');
        fetchData();
        setShowStatusModal(false);
        setSelectedCase(null);
        setSelectedStatus('');
      } else {
        const errorData = await response.json();
        showAlert('danger', errorData.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showAlert('danger', 'An error occurred while updating status');
    }
  };

  const openAssignModal = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setSelectedLawyer('');
    setShowAssignModal(true);
  };

  const openStatusModal = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setSelectedStatus(caseItem.status);
    setShowStatusModal(true);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning';
      case 'approved':
        return 'bg-success';
      case 'rejected':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  };

  const handleDeleteCase = async (caseId: number) => {
    if (!confirm('Are you sure you want to delete this case? This action cannot be undone.')) return;
    try {
      const token = localStorage.getItem('access');
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        showAlert('success', 'Case deleted successfully');
        fetchData();
      } else {
        const errorData = await response.json();
        showAlert('danger', errorData.error || 'Failed to delete case');
      }
    } catch (error) {
      console.error('Error deleting case:', error);
      showAlert('danger', 'Error deleting case');
    }
  };

  if (loading || loadingData) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading case management...</p>
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
      {/* Header */}
      <header className="management-header">
        <div className="header-content">
          <div className="header-left">
            <Link href="/dashboard/admin" className="btn btn-outline-light me-3">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <h1>Case Management</h1>
          </div>
          <div className="header-right">
            <Button onClick={fetchData}>
              <i className="fas fa-sync"></i> Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Alert */}
      {alert.show && (
        <div className={`alert alert-${alert.variant} alert-dismissible fade show`} role="alert">
          {alert.message}
          <button
            type="button"
            className="btn-close"
            onClick={() => setAlert({ show: false, variant: '', message: '' })}
          ></button>
        </div>
      )}

      {/* Advanced UI state
      const [searchTerm, setSearchTerm] = useState('');
      const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
      const [assignedFilter, setAssignedFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
      const [lawyerFilter, setLawyerFilter] = useState<string>(''); // lawyer id as string
      const [fromDate, setFromDate] = useState('');
      const [toDate, setToDate] = useState('');
      const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
      const [sortKey, setSortKey] = useState<'created_at' | 'title' | 'status'>('created_at');
      const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
      
      const filteredCases = useMemo(() => {
        let data = [...cases];
      
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          data = data.filter(c =>
            c.title.toLowerCase().includes(q) ||
            (c.client_name?.toLowerCase().includes(q)) ||
            (c.lawyer_name?.toLowerCase().includes(q)) ||
            (c.description?.toLowerCase().includes(q))
          );
        }
        if (statusFilter !== 'all') {
          data = data.filter(c => c.status === statusFilter);
        }
        if (assignedFilter !== 'all') {
          data = data.filter(c => assignedFilter === 'assigned' ? !!c.lawyer_id : !c.lawyer_id);
        }
        if (lawyerFilter) {
          const lid = parseInt(lawyerFilter);
          data = data.filter(c => c.lawyer_id === lid);
        }
        if (fromDate) {
          const from = new Date(fromDate);
          data = data.filter(c => new Date(c.created_at) >= from);
        }
        if (toDate) {
          const to = new Date(toDate);
          data = data.filter(c => new Date(c.created_at) <= to);
        }
      
        data.sort((a, b) => {
          let va: any, vb: any;
          switch (sortKey) {
            case 'title':
              va = a.title.toLowerCase(); vb = b.title.toLowerCase(); break;
            case 'status':
              va = a.status; vb = b.status; break;
            default:
              va = new Date(a.created_at).getTime();
              vb = new Date(b.created_at).getTime();
          }
          if (va < vb) return sortDir === 'asc' ? -1 : 1;
          if (va > vb) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      
        return data;
      }, [cases, searchTerm, statusFilter, assignedFilter, lawyerFilter, fromDate, toDate, sortKey, sortDir]);
      {/* Cases Table */}
      <div className="cases-table-container">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Client</th>
              <th>Lawyer</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((caseItem) => (
              <tr key={caseItem.id}>
                <td>{caseItem.id}</td>
                <td>
                  <div className="case-title">
                    <strong>{caseItem.title}</strong>
                    <small className="text-muted d-block">{caseItem.description}</small>
                  </div>
                </td>
                <td>{caseItem.client_name}</td>
                <td>{caseItem.lawyer_name || 'Unassigned'}</td>
                <td>
                  <span className={`badge ${getStatusBadgeClass(caseItem.status)}`}>
                    {caseItem.status}
                  </span>
                </td>
                <td>{new Date(caseItem.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <Link href={`/admin/case-tracking?id=${caseItem.id}`} className="me-2">
                      <Button
                        variant="success"
                        size="sm"
                        title={`Track Case #${caseItem.id}`}
                      >
                        <i className="fas fa-location-arrow"></i> Track
                      </Button>
                    </Link>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openAssignModal(caseItem)}
                      className="me-2"
                      disabled={caseItem.lawyer_id !== null}
                    >
                      <i className="fas fa-user-plus"></i> Assign
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => openStatusModal(caseItem)}
                      className="me-2"
                    >
                      <i className="fas fa-edit"></i> Status
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteCase(caseItem.id)}
                    >
                      <i className="fas fa-trash"></i> Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Lawyer Modal */}
      {showAssignModal && selectedCase && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Lawyer to Case</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAssignModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Case: {selectedCase.title}</label>
                </div>
                <div className="mb-3">
                  <label className="form-label">Select Lawyer</label>
                  <select
                    className="form-select"
                    value={selectedLawyer}
                    onChange={(e) => setSelectedLawyer(e.target.value)}
                    required
                  >
                    <option value="">Choose a lawyer...</option>
                    {lawyers.map((lawyer) => (
                      <option key={lawyer.id} value={lawyer.id}>
                        {lawyer.full_name} ({lawyer.username})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAssignLawyer}
                >
                  Assign Lawyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showStatusModal && selectedCase && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Case Status</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowStatusModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Case: {selectedCase.title}</label>
                </div>
                <div className="mb-3">
                  <label className="form-label">Current Status: {selectedCase.status}</label>
                </div>
                <div className="mb-3">
                  <label className="form-label">New Status</label>
                  <select
                    className="form-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    required
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowStatusModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUpdateStatus}
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseManagement;
