'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import './login.css';

const LoginPage = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const { login } = useAuth();

    // Strip any accidental username/password query params from the URL for security
    useEffect(() => {
        try {
            const url = new URL(window.location.href);
            const sp = url.searchParams;
            if (sp.has('username') || sp.has('password')) {
                router.replace('/auth/login');
            }
        } catch {}
    }, [router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const togglePassword = () => {
        setShowPassword(!showPassword);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const success = await login(formData.username, formData.password);
            
            if (success) {
                const role = localStorage.getItem('role');
                const isSuperuser = localStorage.getItem('is_superuser') === 'true';
                
                // Use window.location for hard navigation instead of router.push to avoid RSC errors
                // Redirect directly to dashboard to avoid home page redirect loop
                if (isSuperuser || role === 'admin') {
                    window.location.href = ROUTES.DASHBOARD.ADMIN;
                } else if (role === 'client') {
                    window.location.href = ROUTES.DASHBOARD.CLIENT;
                } else if (role === 'lawyer') {
                    window.location.href = ROUTES.DASHBOARD.LAWYER;
                } else {
                    // If no specific role, redirect to home page
                    window.location.href = ROUTES.HOME;
                }
            }
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        {/* Removed logo/image block */}
                        <h1>Welcome Back</h1>
                        <p>Sign in to access your legal management account</p>
                    </div>
                    
                    <form className="login-form" onSubmit={handleSubmit} method="post">
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <div className="input-wrapper">
                                <div className="input-icon">
                                    <i className="fas fa-user"></i>
                                </div>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="Enter your username"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <div className="form-label-row">
                                <label htmlFor="password">Password</label>
                                <a href={ROUTES.FORGOT_PASSWORD} className="forgot-link">Forgot password?</a>
                            </div>
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
                                    placeholder="Enter your password"
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

                        <button
                            type="submit"
                            className="login-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="btn-loader">
                                    <div className="spinner"></div>
                                    <span>Signing In...</span>
                                </div>
                            ) : (
                                <>
                                    <i className="fas fa-sign-in-alt"></i>
                                    <span>Sign In</span>
                                </>
                            )}
                        </button>

                        <div className="form-footer">
                            <p>Don't have an account? <a href={ROUTES.REGISTER} className="register-link">Create Account</a></p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
