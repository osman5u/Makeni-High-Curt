'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import Link from 'next/link';
import toast from 'react-hot-toast';
import './profile.css';

const ProfilePage = () => {
  const { user, updateProfile, logout } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    profile_picture: '',
    contact_address: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  // Hold client-only auth info read from localStorage
  const [clientAuth, setClientAuth] = useState<{ token: string | null; role: string | null; isSuperuser: boolean }>({
    token: null,
    role: null,
    isSuperuser: false,
  });

  useEffect(() => {
    // Guard for browser
    if (typeof window === 'undefined') return;

    // Check authentication from context or localStorage
    const token = localStorage.getItem('access');
    const role = localStorage.getItem('role');
    const isSuperuser = localStorage.getItem('is_superuser') === 'true';
    setClientAuth({ token, role, isSuperuser });

    if (!token || (!user && !role)) {
      // No authentication found
      window.location.href = ROUTES.LOGIN;
      return;
    }

    // Set form data from user context or localStorage
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        profile_picture: user.profile_picture || '',
        contact_address: user.contact_address || ''
      });
    } else {
      // Fallback to localStorage data
      setFormData({
        full_name: localStorage.getItem('full_name') || '',
        email: '', // Email not stored in localStorage
        profile_picture: '',
        contact_address: '' // Contact address not stored in localStorage
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let profilePictureData = formData.profile_picture;

      // If a file is selected, convert it to base64
      if (selectedFile) {
        profilePictureData = await convertFileToBase64(selectedFile);
      }

      const updatedFormData = {
        ...formData,
        profile_picture: profilePictureData
      };

      const success = await updateProfile(updatedFormData);
      if (success) {
        setEditing(false);
        setSelectedFile(null);
        setPreviewUrl('');
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const getDashboardRoute = () => {
    const roleValue = user?.role || clientAuth.role || 'user';
    const isSuper = user?.is_superuser || clientAuth.isSuperuser;

    if (isSuper || roleValue === 'admin') {
      return ROUTES.DASHBOARD.ADMIN;
    } else if (roleValue === 'client') {
      return ROUTES.DASHBOARD.CLIENT;
    } else if (roleValue === 'lawyer') {
      return ROUTES.DASHBOARD.LAWYER;
    }
    return ROUTES.HOME;
  };

  // Check if we have authentication data (either from context or localStorage)
  // Replace direct localStorage access with clientAuth state
  const isAuthenticated = !!user || (!!clientAuth.token && !!clientAuth.role);

  // Compute once for render so it's in scope where used
  const effectiveRole = (user?.role || clientAuth.role || 'user') as string;

  if (!isAuthenticated) {
    return (
      <div className="profile-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      {/* Header */}
      <header className="profile-header">
        <div className="header-content">
          <div className="header-left">
            <Link href={getDashboardRoute()} className="btn btn-outline-light me-3">
              <i className="fas fa-arrow-left"></i> Back to Dashboard
            </Link>
            <h1>Profile</h1>
          </div>
          <div className="header-right">
            <Button variant="secondary" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-avatar">
            {previewUrl ? (
              <img src={previewUrl} alt="Profile Preview" />
            ) : (user?.profile_picture || formData.profile_picture) ? (
              <img src={user?.profile_picture || formData.profile_picture} alt="Profile" />
            ) : (
              <div className="avatar-placeholder">
                <i className="fas fa-user"></i>
              </div>
            )}
            {editing && (
              <div className="avatar-overlay">
                <i className="fas fa-camera"></i>
              </div>
            )}
          </div>

          <div className="profile-info">
            <h2>{user?.full_name || formData.full_name || 'User'}</h2>
            <p className="username">@{user?.username || 'username'}</p>
            <div className="role-badge">
              <span className={`role role-${effectiveRole}`}>
                {effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1)}
              </span>
              {(user?.is_superuser || clientAuth.isSuperuser) && (
                <span className="superuser-badge">Superuser</span>
              )}
            </div>
          </div>

          <div className="profile-actions">
            <Button
              variant={editing ? 'secondary' : 'primary'}
              onClick={() => setEditing(!editing)}
            >
              <i className={`fas ${editing ? 'fa-times' : 'fa-edit'}`}></i>
              {editing ? 'Cancel' : 'Edit Profile'}
            </Button>
          </div>
        </div>

        <div className="profile-details">
          <div className="details-card">
            <h3>Account Information</h3>

            {editing ? (
              <form onSubmit={handleSubmit} className="profile-form">
                <div className="form-group">
                  <label htmlFor="full_name">Full Name</label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profile_picture_file">Profile Picture</label>
                  <input
                    type="file"
                    id="profile_picture_file"
                    name="profile_picture_file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="form-control"
                  />
                  {previewUrl && (
                    <div className="image-preview">
                      <img src={previewUrl} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%', marginTop: '10px' }} />
                    </div>
                  )}
                  <div className="form-group" style={{ marginTop: '10px' }}>
                    <label htmlFor="profile_picture_url">Or enter image URL</label>
                    <input
                      type="url"
                      id="profile_picture_url"
                      name="profile_picture"
                      value={formData.profile_picture}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="contact_address">Contact Address</label>
                  <textarea
                    id="contact_address"
                    name="contact_address"
                    value={formData.contact_address}
                    onChange={handleChange}
                    className="form-control"
                    rows={3}
                    placeholder="Enter your contact address"
                  />
                </div>

                <div className="form-actions">
                  <Button
                    type="submit"
                    loading={loading}
                    disabled={loading}
                  >
                    <i className="fas fa-save"></i> Save Changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="details-list">
                <div className="detail-item">
                  <label>Full Name</label>
                  <span>{user?.full_name || formData.full_name || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Username</label>
                  <span>@{user?.username || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Email</label>
                  <span>{user?.email || formData.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Contact Address</label>
                  <span>{user?.contact_address || formData.contact_address || 'Not provided'}</span>
                </div>
                <div className="detail-item">
                  <label>Role</label>
                  <span className={`role role-${effectiveRole}`}>
                    {effectiveRole.charAt(0).toUpperCase() + effectiveRole.slice(1)}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Account Status</label>
                  <span className={`status ${user?.is_active !== false ? 'active' : 'inactive'}`}>
                    {user?.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Member Since</label>
                  <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>Last Updated</label>
                  <span>{user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="stats-card">
            <h3>Account Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-icon">
                  <i className="fas fa-calendar"></i>
                </div>
                <div className="stat-content">
                  <h4>Member Since</h4>
                  <p>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">
                  <i className="fas fa-clock"></i>
                </div>
                <div className="stat-content">
                  <h4>Last Login</h4>
                  <p>Recently</p>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">
                  <i className="fas fa-shield-alt"></i>
                </div>
                <div className="stat-content">
                  <h4>Account Type</h4>
                  <p>{(user?.is_superuser || clientAuth.isSuperuser) ? 'Superuser' : 'Standard'}</p>
                </div>
              </div>
            </div>
          </div>
        </div> {/* profile-details */}
      </div> {/* profile-content */}
    </div>
  );
};

export default ProfilePage;
