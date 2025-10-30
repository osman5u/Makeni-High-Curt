import type { Metadata } from "next";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import Navbar from '@/components/Navbar';
import RouteProgress from '@/components/RouteProgress';
import "./globals.css";
import Script from 'next/script';

export const metadata: Metadata = {
  title: "FFS Legal System",
  description: "A comprehensive legal case management system for clients and lawyers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts - Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap" 
          rel="stylesheet" 
        />
        {/* Font Awesome */}
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" 
          rel="stylesheet" 
        />
        {/* Bootstrap */}
        <link 
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" 
          rel="stylesheet" 
        />
      </head>
      <body className="app-body">
        <AuthProvider>
          <NotificationProvider>
            {/* Instant visual feedback on navigation */}
            <RouteProgress />
            <Navbar />
            {children}
            <Toaster position="top-right" />
          </NotificationProvider>
        </AuthProvider>

        {/* Bootstrap JS */}
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
