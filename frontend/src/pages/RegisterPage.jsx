import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiUser, HiMail, HiLockClosed, HiVideoCamera } from 'react-icons/hi';
import toast from 'react-hot-toast';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'var(--color-canvas-gradient)',
    }}>
      <div className="animate-slide-up" style={{
        width: '100%',
        maxWidth: '420px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '3.75rem',
            height: '3.75rem',
            borderRadius: '1rem',
            background: '#2f65f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 24px rgba(47, 101, 246, 0.35)',
            color: '#ffffff',
          }}>
            <HiVideoCamera size={28} />
          </div>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
            Get Started
          </h1>
          <p style={{ color: '#475569', fontSize: '0.875rem' }}>
            Create your Video Buddy account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="vb-card" style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 12px 32px rgba(47, 101, 246, 0.12)',
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.375rem',
            }}>
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <HiUser style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }} size={18} />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.375rem',
            }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <HiMail style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }} size={18} />
              <input
                type="email"
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.375rem',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <HiLockClosed style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }} size={18} />
              <input
                type="password"
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.375rem',
            }}>
              Confirm Password
            </label>
            <div style={{ position: 'relative' }}>
              <HiLockClosed style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }} size={18} />
              <input
                type="password"
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.8125rem' }}
          >
            {loading ? (
              <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px', borderTopColor: '#ffffff' }} />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '1.25rem',
          fontSize: '0.875rem',
          color: '#334155',
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#2f65f6', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
