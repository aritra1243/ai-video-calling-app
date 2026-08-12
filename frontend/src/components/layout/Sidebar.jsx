import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  HiViewGrid, HiSparkles, HiClipboardList, HiChartBar,
  HiLogout, HiChevronLeft, HiChevronRight, HiVideoCamera,
} from 'react-icons/hi';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: HiViewGrid,
    to: '/dashboard',
    description: 'Meetings & calls',
  },
  {
    id: 'ai-summaries',
    label: 'AI Summaries',
    icon: HiSparkles,
    to: '/ai-summaries',
    description: 'Post-meeting insights',
  },
  {
    id: 'daily-standup',
    label: 'Daily Standup',
    icon: HiClipboardList,
    to: '/daily-standup',
    description: 'Log your daily update',
  },
  {
    id: 'weekly-report',
    label: 'Weekly Report',
    icon: HiChartBar,
    to: '/weekly-report',
    description: 'Team leadership view',
  },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Default to collapsed if screen width is less than 768px (mobile)
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <aside
      style={{
        width: collapsed ? '72px' : '240px',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0d1117 0%, #111827 50%, #0d1117 100%)',
        borderRight: '1px solid rgba(56, 189, 248, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Logo area */}
      <div
        style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: '1px solid rgba(56, 189, 248, 0.08)',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: '68px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '0.625rem',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)',
            }}
          >
            <HiVideoCamera size={18} color="white" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
                AI<span style={{ color: '#38bdf8' }}>Meeting</span>
              </div>
              <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
                WORKSPACE
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="sidebar-collapse-btn"
            title="Collapse sidebar"
          >
            <HiChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
          <button
            onClick={() => setCollapsed(false)}
            className="sidebar-collapse-btn"
            title="Expand sidebar"
          >
            <HiChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            title={collapsed ? item.label : undefined}
            onClick={() => {
              if (window.innerWidth < 768) {
                setCollapsed(true);
              }
            }}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: collapsed ? '0.75rem' : '0.75rem 1rem',
              borderRadius: '0.75rem',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive
                ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(37, 99, 235, 0.12))'
                : 'transparent',
              border: isActive
                ? '1px solid rgba(56, 189, 248, 0.25)'
                : '1px solid transparent',
              color: isActive ? '#38bdf8' : 'var(--color-text-secondary)',
              position: 'relative',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px',
                      height: '60%',
                      background: '#38bdf8',
                      borderRadius: '0 2px 2px 0',
                      boxShadow: '0 0 8px rgba(56, 189, 248, 0.6)',
                    }}
                  />
                )}
                <item.icon
                  size={20}
                  style={{ flexShrink: 0, color: isActive ? '#38bdf8' : 'inherit' }}
                />
                {!collapsed && (
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 500,
                      whiteSpace: 'nowrap',
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-muted)',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.description}
                    </div>
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile + Logout */}
      <div
        style={{
          padding: '0.75rem',
          borderTop: '1px solid rgba(56, 189, 248, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {/* User avatar row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.75rem',
            background: 'rgba(255,255,255,0.03)',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          )}
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title="Logout"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.625rem 0.75rem',
            borderRadius: '0.75rem',
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '0.875rem',
            fontWeight: 500,
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <HiLogout size={18} style={{ flexShrink: 0 }} />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
