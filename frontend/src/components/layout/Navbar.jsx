import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HiVideoCamera, HiLogout, HiMenu, HiX } from 'react-icons/hi';
import { useState } from 'react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Don't show navbar on meeting page
  if (location.pathname.startsWith('/meeting/') && !location.pathname.includes('/details')) {
    return null;
  }

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0.75rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(10, 10, 15, 0.8)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    }}>
      <Link to="/dashboard" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        textDecoration: 'none',
        color: 'inherit',
      }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <HiVideoCamera size={20} color="white" />
        </div>
        <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          <span className="gradient-text">AI</span> Meeting
        </span>
      </Link>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 1rem',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'white',
            }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {user.name}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="btn-icon"
            title="Logout"
            style={{ cursor: 'pointer' }}
          >
            <HiLogout size={18} />
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
