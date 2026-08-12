import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { meetingService } from '../services/meetingService';
import {
  HiPlus, HiVideoCamera, HiClock, HiUsers, HiCalendar, HiTrash,
  HiClipboardCopy, HiSearch, HiLogin, HiSparkles,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMeetings(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchMeetings = async (search = '') => {
    setLoading(true);
    try {
      const data = await meetingService.getAll(search);
      setMeetings(data.meetings || []);
    } catch (err) {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await meetingService.create(meetingTitle || 'Untitled Meeting');
      toast.success('Meeting created!');
      setShowCreateModal(false);
      setMeetingTitle('');
      navigate(`/meeting/${data.meeting.roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error('Please enter a room code or meeting link');
      return;
    }
    // Extract room ID if full URL pasted
    let cleanRoomId = joinCode.trim();
    if (cleanRoomId.includes('/meeting/')) {
      cleanRoomId = cleanRoomId.split('/meeting/')[1].split('/')[0];
    }
    setShowJoinModal(false);
    setJoinCode('');
    navigate(`/meeting/${cleanRoomId}`);
  };

  const handleDeleteMeeting = async (id) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await meetingService.delete(id);
      toast.success('Meeting deleted');
      setMeetings((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      toast.error('Failed to delete meeting');
    }
  };

  const copyMeetingLink = (roomId) => {
    const link = `${window.location.origin}/meeting/${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied!');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const statusColors = {
    scheduled: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
    active: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' },
    ended: { bg: 'rgba(107, 114, 128, 0.15)', color: '#9a9ab0' },
  };

  const activeMeetings = meetings.filter((m) => m.status === 'active').length;
  const totalMeetings = meetings.length;
  const endedWithSummary = meetings.filter((m) => m.summary?.summary).length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Welcome back, <span className="gradient-text">{user?.name}</span>
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Corporate AI Video Workspace — Call, Record, Transcribe, and Extract Insights
        </p>
      </div>

      {/* Stats Cards */}
      <div className="animate-fade-in" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {[
          { label: 'Total Meetings', value: totalMeetings, icon: HiVideoCamera, color: '#0284c7' },
          { label: 'Active Now', value: activeMeetings, icon: HiUsers, color: '#10b981' },
          { label: 'AI Summaries', value: endedWithSummary, icon: HiSparkles, color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} className="glass-card" style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '0.75rem',
              background: `rgba(${stat.color === '#0284c7' ? '2,132,199' : stat.color === '#10b981' ? '16,185,129' : '59,130,246'}, 0.15)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <stat.icon size={22} color={stat.color} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions & Search Bar */}
      <div style={{
        marginBottom: '1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <HiSearch style={{
            position: 'absolute',
            left: '0.875rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)',
          }} size={18} />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search meetings by title, room code, or AI transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowJoinModal(true)}>
            <HiLogin size={18} />
            Join with Code
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <HiPlus size={18} />
            Create Meeting
          </button>
        </div>
      </div>

      {/* Meetings List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="glass-card" style={{
          padding: '4rem 2rem',
          textAlign: 'center',
        }}>
          <HiVideoCamera size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {searchQuery ? 'No matching meetings found' : 'No meetings yet'}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {searchQuery ? 'Try searching with a different keyword or room code' : 'Create your first meeting to get started'}
          </p>
          {!searchQuery && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <HiPlus size={18} />
              Create Meeting
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {meetings.map((meeting, index) => (
            <div
              key={meeting._id}
              className="glass-card animate-fade-in"
              style={{
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                animationDelay: `${index * 0.05}s`,
                cursor: 'pointer',
              }}
              onClick={() => {
                if (meeting.status === 'ended') {
                  navigate(`/meeting/${meeting.roomId}/details`);
                } else {
                  navigate(`/meeting/${meeting.roomId}`);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '0.625rem',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <HiVideoCamera size={18} style={{ color: 'var(--color-accent-light)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                    {meeting.title}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <HiCalendar size={12} />
                      {formatDate(meeting.createdAt)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <HiUsers size={12} />
                      {meeting.participants?.length || 0} participants
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                      ID: {meeting.roomId}
                    </span>
                    {meeting.summary?.summary && (
                      <span className="badge badge-success" style={{ fontSize: '0.625rem', padding: '0.125rem 0.5rem' }}>
                        AI Summary
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                <span className="badge" style={{
                  background: statusColors[meeting.status]?.bg,
                  color: statusColors[meeting.status]?.color,
                }}>
                  {meeting.status}
                </span>
                {meeting.status === 'ended' && (
                  <button
                    className="btn-icon"
                    onClick={() => navigate(`/meeting/${meeting.roomId}/details`)}
                    title={meeting.summary?.summary ? 'View AI Summary' : 'Generate AI Summary'}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      background: meeting.summary?.summary
                        ? 'rgba(129, 140, 248, 0.15)'
                        : 'rgba(59, 130, 246, 0.1)',
                      border: `1px solid ${meeting.summary?.summary ? 'rgba(129,140,248,0.3)' : 'rgba(59,130,246,0.2)'}`,
                      color: meeting.summary?.summary ? '#818cf8' : 'var(--color-text-secondary)',
                    }}
                  >
                    <HiSparkles size={16} />
                  </button>
                )}
                <button
                  className="btn-icon"
                  onClick={() => copyMeetingLink(meeting.roomId)}
                  title="Copy link"
                  style={{ padding: '0.5rem', cursor: 'pointer' }}
                >
                  <HiClipboardCopy size={16} />
                </button>
                <button
                  className="btn-icon danger"
                  onClick={() => handleDeleteMeeting(meeting._id)}
                  title="Delete"
                  style={{ padding: '0.5rem', cursor: 'pointer' }}
                >
                  <HiTrash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '2rem',
        }} onClick={() => setShowCreateModal(false)}>
          <div className="glass-card animate-slide-up" style={{
            width: '100%',
            maxWidth: '420px',
            padding: '2rem',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Create Meeting</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              Start a new corporate video call with AI transcription & summarisation
            </p>

            <form onSubmit={handleCreateMeeting}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.5rem',
                }}>
                  Meeting Title
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Q3 Product Roadmap Sync"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating} style={{ flex: 1 }}>
                  {creating ? <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} /> : 'Create & Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join by Code Modal */}
      {showJoinModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '2rem',
        }} onClick={() => setShowJoinModal(false)}>
          <div className="glass-card animate-slide-up" style={{
            width: '100%',
            maxWidth: '420px',
            padding: '2rem',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Join a Meeting</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              Enter the room code or full invitation URL
            </p>

            <form onSubmit={handleJoinByCode}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.5rem',
                }}>
                  Room Code or Meeting URL
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 7a8d92 or http://localhost:5173/meeting/7a8d92"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowJoinModal(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
