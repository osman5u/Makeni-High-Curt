'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import './cases.css';

interface Case {
  id: number;
  title?: string;
  description?: string;
  status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  updated_at?: string;
  due_date?: string;
  client_name?: string;
  lawyer_name?: string;
  client_id?: number;
  lawyer_id?: number | null;
  priority?: 'low' | 'medium' | 'high';
  case_type?: string;
  court_start_date?: string;
  decision_deadline?: string;
  outcome?: 'pending' | 'won' | 'lost';
  progress?: string;
}

interface Lawyer {
  id: number;
  full_name: string;
  username: string;
}

const CasesPage = () => {
  const { user } = useAuth();
  const router = useRouter();

  const [cases, setCases] = useState<Case[]>([]);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  const [editingCase, setEditingCase] = useState<number | null>(null);

  // Keep ONLY one editFormData: map caseId -> Partial<Case>
  const [editFormData, setEditFormData] = useState<{ [key: number]: Partial<Case> }>({});

  // Keep ONLY one formData for create/edit modal
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    case_type: '',
    lawyer_id: ''
  });

  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'due_date' | 'title'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });
  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // Ensure loading flag is cleared after mount to allow redirect logic
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push(ROUTES.LOGIN);
    }
  }, [user, loading, router]);

  const fetchCases = async (loadMore: boolean = false) => {
    const LIMIT = 50;
    try {
      if (loadMore) setLoadingMore(true);
      const token = localStorage.getItem('access');
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (loadMore && cursorCreatedAt) {
        params.set('cursorCreatedAt', cursorCreatedAt);
      }

      // Choose endpoint based on user role
      const endpoint = user?.role === 'admin'
        ? '/api/admin/cases'
        : user?.role === 'lawyer'
          ? '/api/cases/lawyer'
          : '/api/cases/client';

      const url = endpoint + (endpoint.includes('admin') ? '' : `?${params.toString()}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const rawList: any[] = Array.isArray(data?.cases) ? data.cases : (Array.isArray(data) ? data : []);

        // Normalize fields to the Case interface for display
        const list: Case[] = rawList.map((item: any) => {
          if (user?.role === 'client') {
            return {
              id: item.id,
              title: item.title,
              description: item.description,
              status: item.status,
              created_at: item.created_at,
              updated_at: item.updated_at,
              due_date: item.due_date,
              client_id: user?.id as number,
              client_name: user?.full_name || user?.username || '',
              lawyer_id: item.lawyer?.id ?? null,
              lawyer_name: item.lawyer?.full_name ?? undefined,
              priority: item.priority,
              case_type: item.case_type,
              court_start_date: item.court_start_date,
              decision_deadline: item.decision_deadline,
              outcome: item.outcome,
              progress: item.progress,
            };
          } else if (user?.role === 'lawyer') {
            return {
              id: item.id,
              title: item.title,
              description: item.description,
              status: item.status,
              created_at: item.created_at,
              updated_at: item.updated_at,
              due_date: item.due_date,
              client_id: item.client?.id,
              client_name: item.client?.full_name,
              lawyer_id: user?.id as number,
              lawyer_name: user?.full_name || user?.username || '',
              priority: item.priority,
              case_type: item.case_type,
              court_start_date: item.court_start_date,
              decision_deadline: item.decision_deadline,
              outcome: item.outcome,
              progress: item.progress,
            };
          } else {
            // admin already has flattened names
            return {
              id: item.id,
              title: item.title,
              description: item.description,
              status: item.status,
              created_at: item.created_at,
              updated_at: item.updated_at,
              due_date: item.due_date,
              client_id: item.client_id,
              client_name: item.client_name,
              lawyer_id: item.lawyer_id,
              lawyer_name: item.lawyer_name,
              priority: item.priority,
              case_type: item.case_type,
              court_start_date: item.court_start_date,
              decision_deadline: item.decision_deadline,
              outcome: item.outcome,
              progress: item.progress,
            };
          }
        });

        setCases(prev => (loadMore ? [...prev, ...list] : list));
        const nextCursor = data?.nextCursorCreatedAt || null;
        setCursorCreatedAt(nextCursor);
        setHasMore(list.length === LIMIT && !!nextCursor);
      } else {
        showAlert('error', 'Failed to fetch cases');
        if (!loadMore) setCases([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
      showAlert('error', 'Error fetching cases');
      if (!loadMore) setCases([]);
      setHasMore(false);
    } finally {
      setLoadingData(false);
      if (loadMore) setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCases();
      if (user.role === 'admin') {
        fetchLawyers();
      }
    }
  }, [user]);

  useEffect(() => {
    filterAndSortCases();
  }, [cases, searchTerm, statusFilter, priorityFilter, sortBy, sortOrder]);

  const fetchLawyers = async () => {
    try {
      const token = localStorage.getItem('access');
      const response = await fetch('/api/users/lawyers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLawyers(data);
      }
    } catch (error) {
      console.error('Error fetching lawyers:', error);
    }
  };

  const filterAndSortCases = () => {
    let filtered = [...cases];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(case_ => 
        (case_.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (case_.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (case_.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (case_.lawyer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.priority === priorityFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: number | string, bValue: number | string;
      
      switch (sortBy) {
        case 'title':
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
          break;
        case 'due_date':
          aValue = new Date(a.due_date || 0).getTime();
          bValue = new Date(b.due_date || 0).getTime();
          break;
        default:
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredCases(filtered);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access');
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        showAlert('success', 'Case created successfully');
        setShowCreateModal(false);
        resetForm();
        fetchCases();
      } else {
        const errorData = await response.json();
        showAlert('error', errorData.error || 'Failed to create case');
      }
    } catch (error) {
      console.error('Error creating case:', error);
      showAlert('error', 'Error creating case');
    }
  };

  const handleUpdateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    try {
      const token = localStorage.getItem('access');
      const response = await fetch(`/api/cases/${selectedCase.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        showAlert('success', 'Case updated successfully');
        setShowEditModal(false);
        setSelectedCase(null);
        resetForm();
        fetchCases();
      } else {
        const errorData = await response.json();
        showAlert('error', errorData.error || 'Failed to update case');
      }
    } catch (error) {
      console.error('Error updating case:', error);
      showAlert('error', 'Error updating case');
    }
  };

  const handleDeleteCase = async (caseId: number) => {
    const target = cases.find(c => c.id === caseId);
    if (user?.role === 'client' && target?.status === 'approved') {
      showAlert('error', 'This case is already approved and can only be deleted by admin');
      return;
    }

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
        fetchCases();
      } else {
        const errorData = await response.json();
        showAlert('error', errorData.error || 'Failed to delete case');
      }
    } catch (error) {
      console.error('Error deleting case:', error);
      showAlert('error', 'Error deleting case');
    }
  };

  const openEditModal = (case_: Case) => {
    if (case_.status !== 'pending') {
      const msg = case_.status === 'approved'
        ? 'This case is already approved; you cannot make changes'
        : 'This case is rejected; you cannot make changes';
      showAlert('error', msg);
      return;
    }
    setSelectedCase(case_);
    const formDataToSet = {
      title: case_.title || '',
      description: case_.description || '',
      due_date: case_.due_date ? case_.due_date.split('T')[0] : '',
      priority: (case_.priority || 'medium') as 'low' | 'medium' | 'high',
      case_type: case_.case_type || '',
      lawyer_id: case_.lawyer_id?.toString() || ''
    };
    setFormData(formDataToSet);
    setShowEditModal(true);
  };

  const startEditing = (case_: Case) => {
    if (case_.status !== 'pending') {
      const msg = case_.status === 'approved'
        ? 'This case is already approved; you cannot make changes'
        : 'This case is rejected; you cannot make changes';
      showAlert('error', msg);
      return;
    }
    setEditingCase(case_.id);
    setEditFormData(prev => ({
      ...prev,
      [case_.id]: {
        title: case_.title || '',
        description: case_.description || '',
        due_date: case_.due_date ? case_.due_date.split('T')[0] : '',
        priority: case_.priority || 'medium',
        case_type: case_.case_type || '',
        lawyer_id: case_.lawyer_id?.toString() || ''
      }
    }));
  };

  const cancelEditing = () => {
    setEditingCase(null);
    setEditFormData({});
  };

  const updateCaseField = (caseId: number, field: string, value: string) => {
    setEditFormData({
      ...editFormData,
      [caseId]: {
        ...editFormData[caseId],
        [field]: value
      }
    });
  };

  const saveCase = async (caseId: number) => {
    try {
      const token = localStorage.getItem('access');

      // Keep only DB-supported fields
      const payload = editFormData[caseId] || {};
      const allowedKeys: Array<'title' | 'description' | 'due_date' | 'lawyer_id'> = ['title', 'description', 'due_date', 'lawyer_id'];
      const filtered: Record<string, any> = {};
      for (const key of allowedKeys) {
        const val = (payload as any)[key];
        if (val !== undefined && val !== null && val !== '') {
          if (key === 'lawyer_id' && user?.role !== 'admin') continue;
          filtered[key] = val;
        }
      }

      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(filtered)
      });

      if (response.ok) {
        showAlert('success', 'Case updated successfully');
        setEditingCase(null);
        setEditFormData({});
        fetchCases();
      } else {
        const errorData = await response.json();
        showAlert('error', errorData.error || 'Failed to update case');
      }
    } catch (error) {
      console.error('Error updating case:', error);
      showAlert('error', 'Error updating case');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: '',
      priority: 'medium',
      case_type: '',
      lawyer_id: ''
    });
  };

  const showAlert = (variant: string, message: string) => {
    setAlert({ show: true, variant, message });
    setTimeout(() => setAlert({ show: false, variant: '', message: '' }), 5000);
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  };

  const getPriorityColor = (priority: string | undefined) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  if (loading || loadingData) {
    return (
      <div className="cases-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading cases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cases-container">
      {/* Header */}
      <div className="cases-header">
        <div className="header-left">
          <h1>Cases Management</h1>
          <p>Manage and track all legal cases</p>
        </div>
        <div className="header-right">
          {(user?.role === 'admin' || user?.role === 'client') && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <i className="fas fa-plus"></i>
              New Case
            </button>
          )}
        </div>
      </div>

      {/* Alert */}
      {alert.show && (
        <div className={`alert alert-${alert.variant}`}>
          {alert.message}
        </div>
      )}

      {/* Filters and Controls */}
      <div className="cases-controls">
        <div className="search-section">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-section">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="filter-select"
          >
            <option value="created_at">Created Date</option>
            <option value="due_date">Due Date</option>
            <option value="title">Title</option>
          </select>

          <button 
            className="sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
          </button>
        </div>

        <div className="view-toggle">
          <button 
            className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
          >
            <i className="fas fa-th-large"></i>
          </button>
          <button 
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <i className="fas fa-list"></i>
          </button>
        </div>
      </div>

      {/* Cases Display */}
      <div className="cases-content">
        {filteredCases.length === 0 ? (
          <div className="no-cases">
            <i className="fas fa-folder-open"></i>
            <h3>No cases found</h3>
            <p>No cases match your current filters.</p>
          </div>
        ) : (
          <div className={`cases-${viewMode}`}>
            {viewMode === 'card' ? (
              filteredCases.map((case_) => (
                <div key={case_.id} className="case-card">
                  <div className="case-header">
                    {editingCase === case_.id ? (
                      <input
                        type="text"
                        value={editFormData[case_.id]?.title || ''}
                        onChange={(e) => updateCaseField(case_.id, 'title', e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      <h3>{case_.title}</h3>
                    )}
                    <div className="case-actions">
                      {editingCase === case_.id ? (
                        <>
                          <button 
                            className="action-btn save"
                            onClick={() => saveCase(case_.id)}
                            title="Save Changes"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                          <button 
                            className="action-btn cancel"
                            onClick={cancelEditing}
                            title="Cancel"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            className="action-btn edit"
                            onClick={() => startEditing(case_)}
                            title={case_.status === 'pending' ? 'Edit Case' : (case_.status === 'approved' ? 'This case is already approved; you cannot make changes' : 'This case is rejected; you cannot make changes')}
                            disabled={case_.status !== 'pending'}
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          {(user?.role === 'admin' || (user?.role === 'client' && user?.id === case_.client_id)) && (
                            <button 
                              className="action-btn delete"
                              onClick={() => handleDeleteCase(case_.id)}
                              title="Delete Case"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="case-body">
                    {editingCase === case_.id ? (
                      <>
                        <textarea
                          value={editFormData[case_.id]?.description || ''}
                          onChange={(e) => updateCaseField(case_.id, 'description', e.target.value)}
                          className="edit-textarea"
                          rows={3}
                        />
                        <div className="edit-fields">
                          <input
                            type="text"
                            value={editFormData[case_.id]?.case_type || ''}
                            onChange={(e) => updateCaseField(case_.id, 'case_type', e.target.value)}
                            placeholder="Case Type"
                            className="edit-input"
                          />
                          <select
                            value={editFormData[case_.id]?.priority || 'medium'}
                            onChange={(e) => updateCaseField(case_.id, 'priority', e.target.value)}
                            className="edit-select"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <input
                            type="date"
                            value={editFormData[case_.id]?.due_date || ''}
                            onChange={(e) => updateCaseField(case_.id, 'due_date', e.target.value)}
                            className="edit-input"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="case-description">{case_.description}</p>
                        <div className="case-meta">
                          <div className="meta-item">
                            <span className="label">Client:</span>
                            <span className="value">{case_.client_name}</span>
                          </div>
                          <div className="meta-item">
                            <span className="label">Lawyer:</span>
                            <span className="value">{case_.lawyer_name || 'Unassigned'}</span>
                          </div>
                          <div className="meta-item">
                            <span className="label">Due Date:</span>
                            <span className="value">{case_.due_date ? new Date(case_.due_date).toLocaleDateString() : '—'}</span>
                          </div>
                          <div className="meta-item">
                            <span className="label">Court Start:</span>
                            <span className="value">{case_.court_start_date ? new Date(case_.court_start_date).toLocaleDateString() : '—'}</span>
                          </div>
                          <div className="meta-item">
                            <span className="label">Decision Deadline:</span>
                            <span className="value">{case_.decision_deadline ? new Date(case_.decision_deadline).toLocaleDateString() : '—'}</span>
                          </div>
                          <div className="meta-item">
                            <span className="label">Outcome:</span>
                            <span className="value">{case_.outcome ? case_.outcome.charAt(0).toUpperCase() + case_.outcome.slice(1) : 'Pending'}</span>
                          </div>
                          {case_.progress ? (
                            <div className="meta-item">
                              <span className="label">Progress:</span>
                              <span className="value">{case_.progress}</span>
                            </div>
                          ) : null}
                          <div className="meta-item">
                            <span className="label">Type:</span>
                            <span className="value">{case_.case_type}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="case-footer">
                    <span className={`status-badge ${getStatusColor(case_.status)}`}>
                      {case_.status ? case_.status.charAt(0).toUpperCase() + case_.status.slice(1) : 'Pending'}
                    </span>
                    <span className={`priority-badge ${getPriorityColor(case_.priority)}`}>
                      {case_.priority ? case_.priority.charAt(0).toUpperCase() + case_.priority.slice(1) : 'Medium'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              // List view with modal editing for simplicity
              <div className="cases-table">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Client</th>
                      <th>Lawyer</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Due Date</th>
                      <th>Court Start</th>
                      <th>Decision Deadline</th>
                      <th>Outcome</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((case_) => (
                      <tr key={case_.id}>
                        <td>
                          <div className="case-title">
                            <strong>{case_.title}</strong>
                            <small>{case_.case_type}</small>
                          </div>
                        </td>
                        <td>{case_.client_name}</td>
                        <td>{case_.lawyer_name || 'Unassigned'}</td>
                        <td>
                          <span className={`status-badge ${getStatusColor(case_.status)}`}>
{case_.status ? case_.status.charAt(0).toUpperCase() + case_.status.slice(1) : 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <span className={`priority-badge ${getPriorityColor(case_.priority || 'medium')}`}>
                            {case_.priority ? case_.priority.charAt(0).toUpperCase() + case_.priority.slice(1) : 'Medium'}
                          </span>
                        </td>
                        <td>{case_.due_date ? new Date(case_.due_date).toLocaleDateString() : '—'}</td>
                        <td>{case_.court_start_date ? new Date(case_.court_start_date).toLocaleDateString() : '—'}</td>
                        <td>{case_.decision_deadline ? new Date(case_.decision_deadline).toLocaleDateString() : '—'}</td>
                        <td>{case_.outcome ? case_.outcome.charAt(0).toUpperCase() + case_.outcome.slice(1) : 'Pending'}</td>
                        <td>
                          <div className="table-actions">
                            <button 
                              className="action-btn edit"
                              onClick={() => openEditModal(case_)}
                              title={case_.status === 'pending' ? 'Edit Case' : (case_.status === 'approved' ? 'This case is already approved; you cannot make changes' : 'This case is rejected; you cannot make changes')}
                              disabled={case_.status !== 'pending'}
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            {(user?.role === 'admin' || (user?.role === 'client' && user?.id === case_.client_id)) && (
                              <button 
                                className="action-btn delete"
                                onClick={() => handleDeleteCase(case_.id)}
                                title="Delete Case"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {hasMore && (
              <div className="load-more">
                <button
                  className="btn btn-outline-primary"
                  onClick={() => fetchCases(true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New Case</h2>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleCreateCase}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Case Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={4}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Case Type *</label>
                    <input
                      type="text"
                      value={formData.case_type}
                      onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                      placeholder="e.g., Criminal, Civil, Family"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      required
                    />
                  </div>
                  
                  {user?.role === 'admin' && (
                    <div className="form-group">
                      <label>Assign Lawyer</label>
                      <select
                        value={formData.lawyer_id}
                        onChange={(e) => setFormData({...formData, lawyer_id: e.target.value})}
                      >
                        <option value="">Select Lawyer</option>
                        {lawyers.map(lawyer => (
                          <option key={lawyer.id} value={lawyer.id}>
                            {lawyer.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Case Modal */}
      {showEditModal && selectedCase && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Case</h2>
              <button 
                className="close-btn"
                onClick={() => setShowEditModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleUpdateCase}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Case Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={4}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Case Type *</label>
                    <input
                      type="text"
                      value={formData.case_type}
                      onChange={(e) => setFormData({...formData, case_type: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      required
                    />
                  </div>
                  
                  {user?.role === 'admin' && (
                    <div className="form-group">
                      <label>Assign Lawyer</label>
                      <select
                        value={formData.lawyer_id}
                        onChange={(e) => setFormData({...formData, lawyer_id: e.target.value})}
                      >
                        <option value="">Select Lawyer</option>
                        {lawyers.map(lawyer => (
                          <option key={lawyer.id} value={lawyer.id}>
                            {lawyer.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CasesPage;