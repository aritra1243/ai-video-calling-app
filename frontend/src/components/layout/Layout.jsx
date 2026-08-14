import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';
import { HiVideoCamera, HiMenu, HiX } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';

const Layout = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="layout-outer-wrapper" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      background: 'var(--color-canvas-gradient)',
    }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#1e293b',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
            fontSize: '0.875rem',
            fontWeight: 500,
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: 'white' },
          },
        }}
      />

      {/* Main Application Window Frame matching mockups */}
      <div className="app-window-frame">
        {/* Video Buddy Top Header Bar */}
        <header className="video-buddy-header" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.18)',
                border: 'none',
                color: '#ffffff',
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <HiX size={20} /> : <HiMenu size={20} />}
            </button>

            <Link to="/dashboard" className="video-buddy-logo">
              <div className="video-buddy-logo-badge">
                <HiVideoCamera size={18} />
              </div>
              <span>Video Buddy</span>
            </Link>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#ffffff',
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
              }}>
                <div style={{
                  width: '1.375rem',
                  height: '1.375rem',
                  borderRadius: '50%',
                  background: '#ffffff',
                  color: '#2f65f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                }}>
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline">{user.name}</span>
              </div>
            </div>
          )}
        </header>

        {/* Content Body: Sidebar + Main Area */}
        <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 120px)', position: 'relative', overflow: 'hidden' }}>
          <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
          <main style={{
            flex: 1,
            overflowY: 'auto',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
          }}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;

