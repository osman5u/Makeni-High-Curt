'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import './register.css';

// Lightweight image compression to keep payloads small and fast
const compressImageToBase64 = (file: File, maxW = 800, maxH = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        if (!reader.result) return reject(new Error('Failed to read file'));
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const ratio = Math.min(maxW / width, maxH / height, 1);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas not supported'));
            ctx.drawImage(img, 0, 0, width, height);
            // Prefer JPEG for better compression; fallback to PNG for transparency
            const isPng = /\.png$/i.test(file.name) || file.type === 'image/png';
            const mime = isPng ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(mime, isPng ? 0.9 : quality);
            resolve(dataUrl);
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error('Invalid image'));
        img.src = String(reader.result);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
};

// Helper function to convert file to base64
const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    contact_address: '',
    role: 'client' as 'client' | 'lawyer' | 'admin'
  });
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { register } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicture(e.target.files[0]);
    }
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (formData.password.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }

    setLoading(true);
    try {
      // Convert profile picture to base64 if it exists
      let profilePictureBase64: string | undefined = undefined;
      try {
        if (profilePicture) {
          // If file is larger than 1MB, compress it before sending
          const ONE_MB = 1024 * 1024;
          if (profilePicture.size > ONE_MB) {
            profilePictureBase64 = await compressImageToBase64(profilePicture, 800, 800, 0.7);
          } else {
            // Still compress lightly to avoid oversized payloads
            profilePictureBase64 = await compressImageToBase64(profilePicture, 800, 800, 0.8);
          }
        }
      } catch (error) {
        console.error('Error processing profile picture:', error);
        // Continue with registration even if profile picture processing fails
      }

      const success = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        contact_address: formData.contact_address,
        profile_picture: profilePictureBase64,
        role: formData.role
      });

      if (success) {
        // Use window.location for hard navigation instead of router.push to avoid RSC errors
        window.location.href = ROUTES.LOGIN;
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            {/* Removed logo/image block */}
            <h1>Create Account</h1>
            <p>Join our legal management system and get started</p>
          </div>
          
          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="full_name">Full Name</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <i className="fas fa-at"></i>
                  </div>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Choose a username"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <i className="fas fa-envelope"></i>
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  required
                />
              </div>
            </div>

            {/* Removed visible Account Type selector; keep role default via hidden input */}
            <input type="hidden" name="role" value={formData.role} />

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <i className="fas fa-lock"></i>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePassword}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <i className="fas fa-lock"></i>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_address">Contact Address</label>
              <div className="input-wrapper">
                <div className="input-icon">
                  <i className="fas fa-map-marker-alt"></i>
                </div>
                <textarea
                  id="contact_address"
                  name="contact_address"
                  value={formData.contact_address}
                  onChange={handleChange}
                  placeholder="Enter your contact address"
                  rows={3}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="profilePicture">Profile Picture</label>
              <div className="file-upload-wrapper">
                <div className="file-upload-area">
                  <div className="file-upload-icon">
                    <i className="fas fa-cloud-upload-alt"></i>
                  </div>
                  <div className="file-upload-content">
                    <p>Click to upload or drag and drop</p>
                    <p className="file-upload-hint">PNG, JPG, GIF up to 5MB</p>
                  </div>
                  <input
                    type="file"
                    id="profilePicture"
                    name="profilePicture"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                </div>
                {profilePicture && (
                  <div className="file-preview">
                    <i className="fas fa-check-circle"></i>
                    <span>{profilePicture.name}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="register-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="btn-loader">
                  <div className="spinner"></div>
                  <span>Creating Account...</span>
                </div>
              ) : (
                <>
                  <i className="fas fa-user-plus"></i>
                  <span>Create Account</span>
                </>
              )}
            </button>

            <div className="form-footer">
              <p>Already have an account? <a href={ROUTES.LOGIN} className="login-link">Sign In</a></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
