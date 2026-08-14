import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HiHome,
  HiIdentification,
  HiSparkles,
  HiClipboardList,
  HiChartBar,
  HiLogout,
} from 'react-icons/hi';

const NAV_ITEMS = [
  {
    id: 'home',
    label: 'Home',
    icon: HiHome,
    to: '/dashboard',
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: HiIdentification,
    to: '/contacts',
  },
  {
    id: 'recording',
    label: 'AI Summaries',
    icon: HiSparkles,
    to: '/ai-summaries',
  },
  {
    id: 'daily-standup',
    label: 'Daily Standup',
    icon: HiClipboardList,
    to: '/daily-standup',
  },
  {
    id: 'weekly-report',
    label: 'Weekly Report',
    icon: HiChartBar,
    to: '/weekly-report',
  },
];

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <aside
      style={{
        width: '210px',
        background: '#ffffff',
        borderRight: '1px solid #eef2f6',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 30,
        padding: '1.25rem 0.875rem',
      }}
    >
      {/* Navigation list */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.to === '/dashboard'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.875rem',
              padding: '0.625rem 1rem',
              borderRadius: '0.625rem',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#2f65f6' : '#64748b',
              background: isActive ? '#eef4ff' : 'transparent',
              transition: 'all 0.15s ease',
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={19}
                  style={{
                    color: isActive ? '#2f65f6' : '#94a3b8',
                    flexShrink: 0,
                  }}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Logout Button */}
      <div style={{ paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            width: '100%',
            padding: '0.625rem 1rem',
            borderRadius: '0.625rem',
            border: 'none',
            background: 'transparent',
            color: '#ef4444',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fef2f2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <HiLogout size={18} style={{ flexShrink: 0 }} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
