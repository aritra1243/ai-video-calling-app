import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Toaster } from 'react-hot-toast';

const Layout = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-light)',
            borderRadius: 'var(--radius-md)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: 'white' },
          },
        }}
      />
      <Sidebar />
      <main style={{ flex: 1, minHeight: '100vh', overflowY: 'auto', background: 'var(--color-bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
