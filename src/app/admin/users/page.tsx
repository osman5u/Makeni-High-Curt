'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import './user-management.css';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'client' | 'lawyer' | 'admin';
  is_active: boolean;
  created_at: string;
}

function UserManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    full_name: '',
    role: 'client' as 'client' | 'lawyer' | 'admin',
    is_active: true
  });
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });

  // Add missing UI state for filters/search/sort/view and computed filteredUsers
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'lawyer' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortKey, setSortKey] = useState<'created_at' | 'username' | 'full_name' | 'role' | 'id'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredUsers = useMemo(() => {
    let data = [...users];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter(u =>
        u.username.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all') {
      data = data.filter(u => u.role === roleFilter);
    }
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      data = data.filter(u => u.is_active === isActive);
    }
    if (fromDate) {
      const from = new Date(fromDate);
      data = data.filter(u => new Date(u.created_at) >= from);
    }
    if (toDate) {
      const to = new Date(toDate);
      data = data.filter(u => new Date(u.created_at) <= to);
    }

    data.sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case 'username':
          va = a.username.toLowerCase(); vb = b.username.toLowerCase(); break;
        case 'full_name':
          va = a.full_name.toLowerCase(); vb = b.full_name.toLowerCase(); break;
        case 'role':
          va = a.role; vb = b.role; break;
        case 'id':
          va = a.id; vb = b.id; break;
        default:
          va = new Date(a.created_at).getTime();
          vb = new Date(b.created_at).getTime();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [users, searchTerm, roleFilter, statusFilter, fromDate, toDate, sortKey, sortDir]);

  // CSV Download functionality
  const generateCSV = (data: User[]) => {
    const headers = ['ID', 'Username', 'Full Name', 'Email', 'Role', 'Status', 'Created Date'];
    const csvContent = [
      headers.join(','),
      ...data.map(user => [
        user.id,
        `"${user.username}"`,
        `"${user.full_name}"`,
        `"${user.email}"`,
        user.role,
        user.is_active ? 'Active' : 'Inactive',
        new Date(user.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');
    
    return csvContent;
  };

  const downloadCSV = () => {
    const csvContent = generateCSV(filteredUsers);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with current date and filter info
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `users_export_${timestamp}`;
      
      if (roleFilter !== 'all') filename += `_${roleFilter}`;
      if (statusFilter !== 'all') filename += `_${statusFilter}`;
      if (searchTerm) filename += '_filtered';
      
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showAlert('success', `CSV exported successfully! (${filteredUsers.length} users)`);
    }
  };

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'admin' && !user.is_superuser))) {
      router.push(ROUTES.HOME);
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.is_superuser)) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoadingData(true);
      const token = localStorage.getItem('access');
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showAlert('danger', 'Error fetching users');
    } finally {
      setLoadingData(false);
    }
  };

  const showAlert = (variant: string, message: string) => {
    setAlert({ show: true, variant, message });
    setTimeout(() => setAlert({ show: false, variant: '', message: '' }), 3000);
  };

  const handleShowModal = (user: User | null = null) => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
        password: '',
        confirm_password: ''
      });
      setSelectedUser(user);
    } else {
      setFormData({
        username: '',
        email: '',
        password: '',
        confirm_password: '',
        full_name: '',
        role: 'client',
        is_active: true
      });
      setSelectedUser(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      confirm_password: '',
      full_name: '',
      role: 'client',
      is_active: true
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser && formData.password !== formData.confirm_password) {
      showAlert('danger', 'Passwords do not match');
      return;
    }
    
    const submissionData = { ...formData };
    delete submissionData.confirm_password;
    
    try {
      const token = localStorage.getItem('access');
      const url = selectedUser ? `/api/admin/users/${selectedUser.id}` : '/api/admin/users';
      const method = selectedUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });
      
      if (response.ok) {
        showAlert('success', selectedUser ? 'User updated successfully' : 'User created successfully');
        fetchUsers();
        handleCloseModal();
      } else {
        const errorData = await response.json();
        showAlert('danger', errorData.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showAlert('danger', 'An error occurred while saving user');
    }
  };

  const handleDelete = async (userId: number) => {
    if (userId === user?.id) {
      showAlert('danger', 'You cannot delete your own account');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('access');
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        showAlert('success', 'User deleted successfully');
        fetchUsers();
      } else {
        const errorData = await response.json();
        showAlert('danger', errorData.error || 'An error occurred');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showAlert('danger', 'An error occurred while deleting user');
    }
  };

  if (loading || loadingData) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading user management...</p>
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
    <div className="user-management-container">
      {/* Header */}
      <header className="management-header">
        <div className="header-content">
          <div className="header-left">
            <Link href="/dashboard/admin" className="btn btn-outline-light me-3">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <h1>User Management</h1>
          </div>
          <div className="header-right">
            <Button onClick={() => handleShowModal(null)}>
              <i className="fas fa-plus"></i> Add User
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

      {/* Toolbar: search, filters, sort, view toggle */}
      <div className="management-toolbar">
        <div className="filters-grid">
          <input
            type="text"
            className="filter-input"
            placeholder="Search by name, username, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="filter-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | 'client' | 'lawyer' | 'admin')}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="lawyer">Lawyer</option>
            <option value="client">Client</option>
          </select>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="date-range">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <span>to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="sort-control">
            <select
              className="filter-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as 'created_at' | 'username' | 'full_name' | 'role' | 'id')}
            >
              <option value="created_at">Sort by Created</option>
              <option value="username">Sort by Username</option>
              <option value="full_name">Sort by Full Name</option>
              <option value="role">Sort by Role</option>
              <option value="id">Sort by ID</option>
            </select>
            <button
              className="btn btn-outline-secondary sort-dir-btn"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title="Toggle sort direction"
            >
              <i className={sortDir === 'asc' ? 'fas fa-sort-amount-up' : 'fas fa-sort-amount-down'}></i>
            </button>
          </div>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <i className="fas fa-table"></i> Table
            </button>
            <button
              className={`toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              <i className="fas fa-th-large"></i> Cards
            </button>
          </div>
          <div className="csv-download">
            <button
              className="btn btn-success"
              onClick={downloadCSV}
              title={`Download CSV of ${filteredUsers.length} users`}
            >
              <i className="fas fa-download"></i> Export CSV ({filteredUsers.length})
            </button>
          </div>
        </div>
      </div>

      {/* Listing */}
      {viewMode === 'table' ? (
        <div className="users-table-container">
          <table className="table table-striped table-hover">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((userItem) => (
                <tr key={userItem.id}>
                  <td>{userItem.id}</td>
                  <td>{userItem.username}</td>
                  <td>{userItem.full_name}</td>
                  <td>{userItem.email}</td>
                  <td>
                    <span className={`badge bg-${userItem.role === 'admin' ? 'danger' : userItem.role === 'lawyer' ? 'primary' : 'success'}`}>
                      {userItem.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge bg-${userItem.is_active ? 'success' : 'secondary'}`}>
                      {userItem.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{new Date(userItem.created_at).toLocaleDateString()}</td>
                  <td>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleShowModal(userItem)}
                      className="me-2"
                    >
                      <i className="fas fa-edit"></i>
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(userItem.id)}
                      disabled={userItem.id === user?.id}
                    >
                      <i className="fas fa-trash"></i>
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-4">
                    No users match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cards-grid">
          {filteredUsers.map((u) => (
            <div className="card-panel user-card" key={u.id}>
              <div className="card-header">
                <div className="title">
                  <i className="fas fa-user-circle"></i> {u.full_name || u.username}
                </div>
                <span className={`badge role-badge ${u.role}`}>{u.role}</span>
              </div>
              <div className="card-body">
                <div className="meta"><i className="fas fa-at"></i> {u.username}</div>
                <div className="meta"><i className="fas fa-envelope"></i> {u.email}</div>
              </div>
              <div className="card-footer">
                <div className="left">
                  <span className={`badge status-badge ${u.is_active ? 'active' : 'inactive'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="chip"><i className="far fa-clock"></i> {new Date(u.created_at).toLocaleDateString()}</span>
                  <span className="chip"><i className="fas fa-id-badge"></i> #{u.id}</span>
                </div>
                <div className="right">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleShowModal(u)}
                    className="me-2"
                  >
                    <i className="fas fa-edit"></i>
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDelete(u.id)}
                    disabled={u.id === user?.id}
                  >
                    <i className="fas fa-trash"></i>
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="empty-state">
              <i className="far fa-folder-open"></i>
              <p>No users match your filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal should be inside the returned JSX */}
      {showModal && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {selectedUser ? 'Edit User' : 'Add New User'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseModal}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input
                          type="text"
                          className="form-control"
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Full Name</label>
                        <input
                          type="text"
                          className="form-control"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Role</label>
                        <select
                          className="form-select"
                          name="role"
                          value={formData.role}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="client">Client</option>
                          <option value="lawyer">Lawyer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">
                          {selectedUser ? 'New Password (leave blank to keep current)' : 'Password'}
                        </label>
                        <input
                          type="password"
                          className="form-control"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required={!selectedUser}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Confirm Password</label>
                        <input
                          type="password"
                          className="form-control"
                          name="confirm_password"
                          value={formData.confirm_password}
                          onChange={handleInputChange}
                          required={!selectedUser}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleInputChange}
                      />
                      <label className="form-check-label">
                        Active User
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {selectedUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
<div>
  <h1>Users</h1>
</div>
