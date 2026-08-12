import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MeetingPage from './pages/MeetingPage';
import MeetingDetailsPage from './pages/MeetingDetailsPage';
import AISummariesPage from './pages/AISummariesPage';
import DailyStandupPage from './pages/DailyStandupPage';
import WeeklyReportPage from './pages/WeeklyReportPage';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
      }}>
        <div className="spinner" style={{ width: '3rem', height: '3rem' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route wrapper (redirect if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
      }}>
        <div className="spinner" style={{ width: '3rem', height: '3rem' }} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={
              <PublicRoute><LoginPage /></PublicRoute>
            } />
            <Route path="/register" element={
              <PublicRoute><RegisterPage /></PublicRoute>
            } />

            {/* Protected routes with sidebar layout */}
            <Route element={
              <ProtectedRoute><Layout /></ProtectedRoute>
            }>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/ai-summaries" element={<AISummariesPage />} />
              <Route path="/daily-standup" element={<DailyStandupPage />} />
              <Route path="/weekly-report" element={<WeeklyReportPage />} />
              <Route path="/meeting/:roomId/details" element={<MeetingDetailsPage />} />
            </Route>

            {/* Meeting room (separate layout, no sidebar) */}
            <Route path="/meeting/:roomId" element={
              <ProtectedRoute><MeetingPage /></ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
