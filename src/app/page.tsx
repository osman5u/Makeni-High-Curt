'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './home.css';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Check if user is authenticated either from context or localStorage
      const token = localStorage.getItem('access');
      const role = localStorage.getItem('role');
      const isSuperuser = localStorage.getItem('is_superuser') === 'true';
      
      if (token && (user || role)) {
        // Redirect authenticated users to their dashboard
        if (isSuperuser || role === 'admin') {
          router.push(ROUTES.DASHBOARD.ADMIN);
        } else if (role === 'client') {
          router.push(ROUTES.DASHBOARD.CLIENT);
        } else if (role === 'lawyer') {
          router.push(ROUTES.DASHBOARD.LAWYER);
        }
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="home-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main Home Content with Cleanback Background */}
      <div className="home-container">
        {/* Hero Section with Background */}
        <div className="hero-section">
          <div className="hero-overlay">
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-lg-10 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="hero-content"
                  >
                    {/* System Logo (FFL) */}
                    <div className="hero-logo">
                      <img
                        src="/ffl-logo.png"
                        alt="FFL Free and Fear Legal System"
                        width={80}
                        height={80}
                      />
                    </div>
                    {/* Welcome Text */}
                    <h1 className="hero-title">
                      WELCOME TO
                      <span className="brand-name"> FF LEGAL SYSTEM</span>
                    </h1>
                    <p className="hero-subtitle">
                      Your comprehensive legal case management solution
                    </p>
                    {/* Buttons removed */}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Features Section */}
        <div className="features-section">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-5"
            >
              <h2 className="features-title">Key Features</h2>
              <p className="features-subtitle">Everything you need for efficient legal case management</p>
            </motion.div>
            
            <div className="row justify-content-center">
              <div className="col-lg-10">
                <div className="row">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="col-md-4 mb-4"
                  >
                    <div className="feature-card">
                      <div className="feature-icon">
                        <i className="fas fa-balance-scale"></i>
                      </div>
                      <h4>Case Management</h4>
                      <p>Efficiently manage legal cases with our comprehensive case tracking system. Track case progress, deadlines, and outcomes.</p>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="col-md-4 mb-4"
                  >
                    <div className="feature-card">
                      <div className="feature-icon">
                        <i className="fas fa-comments"></i>
                      </div>
                      <h4>Real-time Communication</h4>
                      <p>Communicate with clients and lawyers through our integrated chat system. Stay connected and informed.</p>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="col-md-4 mb-4"
                  >
                    <div className="feature-card">
                      <div className="feature-icon">
                        <i className="fas fa-file-contract"></i>
                      </div>
                      <h4>Document Management</h4>
                      <p>Upload, organize, and share legal documents securely. Keep all your legal files in one place.</p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
