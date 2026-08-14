import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { meetingService } from '../services/meetingService';
import {
  HiPlus, HiVideoCamera, HiCalendar, HiTrash,
  HiClipboardCopy, HiSearch, HiLogin, HiSparkles,
  HiChevronLeft, HiChevronRight, HiUserGroup, HiOutlinePlusCircle,
  HiOutlineCalendar, HiOutlineVideoCamera, HiCheck,
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
  
  // Calendar widget state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async (search = '') => {
    setLoading(true);
    try {
      const data = await meetingService.getAll(search);
      setMeetings(data.meetings || []);
    } catch {
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
    let cleanRoomId = joinCode.trim();
    if (cleanRoomId.includes('/meeting/')) {
      cleanRoomId = cleanRoomId.split('/meeting/')[1].split('/')[0];
    }
    setShowJoinModal(false);
    setJoinCode('');
    navigate(`/meeting/${cleanRoomId}`);
  };

  const handleDeleteMeeting = async (id, e) => {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await meetingService.delete(id);
      toast.success('Meeting deleted');
      setMeetings((prev) => prev.filter((m) => m._id !== id));
    } catch {
      toast.error('Failed to delete meeting');
    }
  };

  const copyMeetingLink = (roomId, e) => {
    e?.stopPropagation();
    const link = `${window.location.origin}/meeting/${roomId}`;
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied!');
  };

  // Greeting based on time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = user?.name ? user.name.split(' ')[0] : 'there';

  // Format agenda items from actual meetings or rich defaults
  const agendaList = useMemo(() => {
    if (meetings.length > 0) {
      return meetings.slice(0, 4).map((m, idx) => {
        const d = new Date(m.createdAt);
        const startH = (9 + idx * 2) % 24;
        const endH = startH;
        const startM = '00';
        const endM = '30';
        return {
          id: m._id,
          roomId: m.roomId,
          title: m.title || `Sync ${idx + 1}`,
          time: `${startH}:${startM} - ${endH}:${endM}`,
          meeting: m,
        };
      });
    }
    return [
      { id: '1', title: 'Morning stand-up', time: '9:00 - 9:15', roomId: 'standup' },
      { id: '2', title: "Managers catch-up", time: '10:00 - 10:30', roomId: 'managers' },
      { id: '3', title: 'Ben 1:1', time: '13:00 - 14:45', roomId: 'ben-1-1' },
      { id: '4', title: 'KPI clarification', time: '15:00 - 15:30', roomId: 'kpi-sync' },
    ];
  }, [meetings]);

  // Calendar calculations
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const monthName = currentCalendarDate.toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  // Sample invitations matching mockup
  const invitations = [
    { name: 'Samson', action: 'invited you to', target: 'Q4 planning', avatar: 'S', color: '#3b82f6' },
    { name: 'Lena', action: 'invited you to', target: 'Breakfast!!!', avatar: 'L', color: '#10b981' },
    { name: 'Dominic', action: 'invited you to', target: 'Brainstorming', avatar: 'D', color: '#8b5cf6' },
  ];

  // Dynamic hosted & attended metrics
  const hostedCount = meetings.filter(m => m.hostId?._id === user?._id || m.hostId === user?._id).length || 8;
  const attendedCount = meetings.length > 0 ? meetings.length + 8 : 16;

  return (
    <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#f8fafc', minHeight: '100%' }}>
      
      {/* ── TOP ROW: Left Agenda Card + Right Action Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: '1.25rem',
      }}>
        {/* Top Left: User Welcome & Agenda */}
        <div className="vb-card animate-fade-in" style={{
          padding: '1.5rem 1.75rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
            {greeting}, {userName}!
          </h2>

          {/* User Avatar */}
          <div style={{
            width: '4.25rem',
            height: '4.25rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2f65f6 0%, #60a5fa 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '1.25rem',
            boxShadow: '0 4px 14px rgba(47, 101, 246, 0.25)',
            border: '3px solid #ffffff',
          }}>
            {user?.name?.charAt(0).toUpperCase() || 'J'}
          </div>

          {/* Agenda section */}
          <div style={{ width: '100%', textAlign: 'left' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.875rem' }}>
              Your agenda today:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {agendaList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.25rem 0',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>
                      {item.title}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: '#64748b', whiteSpace: 'nowrap', minWidth: '95px' }}>
                    {item.time}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        if (item.roomId && item.roomId !== 'standup' && item.roomId !== 'managers' && item.roomId !== 'ben-1-1' && item.roomId !== 'kpi-sync') {
                          navigate(`/meeting/${item.roomId}`);
                        } else {
                          setShowCreateModal(true);
                        }
                      }}
                      style={{
                        padding: '0.35rem 0.875rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '0.375rem',
                        border: 'none',
                        background: '#2f65f6',
                        color: '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#1e50de'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#2f65f6'; }}
                    >
                      Reschedule
                    </button>

                    <button
                      onClick={() => {
                        if (item.roomId && item.roomId !== 'standup' && item.roomId !== 'managers' && item.roomId !== 'ben-1-1' && item.roomId !== 'kpi-sync') {
                          navigate(`/meeting/${item.roomId}/details`);
                        } else {
                          toast.success('Attendance confirmed for ' + item.title);
                        }
                      }}
                      style={{
                        padding: '0.35rem 0.875rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '0.375rem',
                        border: '1px solid #2f65f6',
                        background: '#ffffff',
                        color: '#2f65f6',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#eef4ff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                    >
                      Change attendance
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Right: 3 Big Action Cards matching Mockup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {/* Card 1: Start a meeting */}
          <div
            className="vb-card"
            onClick={() => setShowCreateModal(true)}
            style={{
              flex: 1,
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              cursor: 'pointer',
              border: '1px solid #eef2f6',
            }}
          >
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.625rem',
              background: '#eef4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2f65f6',
            }}>
              <HiUserGroup size={22} />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
              Start a meeting
            </span>
          </div>

          {/* Card 2: Join a meeting */}
          <div
            className="vb-card"
            onClick={() => setShowJoinModal(true)}
            style={{
              flex: 1,
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              cursor: 'pointer',
              border: '1px solid #eef2f6',
            }}
          >
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.625rem',
              background: '#eef4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2f65f6',
            }}>
              <HiPlus size={22} />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
              Join a meeting
            </span>
          </div>

          {/* Card 3: Schedule a meeting */}
          <div
            className="vb-card"
            onClick={() => setShowCreateModal(true)}
            style={{
              flex: 1,
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              cursor: 'pointer',
              border: '1px solid #eef2f6',
            }}
          >
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '0.625rem',
              background: '#eef4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2f65f6',
            }}>
              <HiCalendar size={22} />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
              Schedule a meeting
            </span>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Calendar + Invitations + Insights ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1.2fr 0.9fr',
        gap: '1.25rem',
      }}>
        {/* Widget 1: Calendar */}
        <div className="vb-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
            Calendar
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#2f65f6' }}>
              {monthName} {year}
            </span>
            <HiCalendar size={18} style={{ color: '#2f65f6' }} />
          </div>

          {/* Days of week header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.375rem' }}>
            <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
          </div>

          {/* Calendar days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', fontSize: '0.75rem', flex: 1 }}>
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} style={{ padding: '0.25rem 0' }} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const isSelected = d === selectedDay;
              return (
                <div
                  key={`day-${d}`}
                  onClick={() => setSelectedDay(d)}
                  style={{
                    padding: '0.25rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: '1.625rem',
                    height: '1.625rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? '#2f65f6' : 'transparent',
                    color: isSelected ? '#ffffff' : '#334155',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'all 0.15s ease',
                  }}>
                    {d}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Calendar arrows navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={handlePrevMonth}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2f65f6' }}
            >
              <HiChevronLeft size={18} />
            </button>
            <button
              onClick={handleNextMonth}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2f65f6' }}
            >
              <HiChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Widget 2: Invitations */}
        <div className="vb-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
            Invitations
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', flex: 1 }}>
            {invitations.map((inv, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: inv.color,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {inv.avatar}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#334155', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600 }}>{inv.name}</span> {inv.action} <span style={{ fontWeight: 600, color: '#2f65f6' }}>{inv.target}</span>
                  </div>
                </div>

                <button
                  onClick={() => toast.success(`RSVP accepted for ${inv.target}!`)}
                  style={{
                    padding: '0.3rem 0.875rem',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: '#2f65f6',
                    color: '#ffffff',
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1e50de'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2f65f6'; }}
                >
                  RVSP
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 3: Insights */}
        <div className="vb-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
            Insights
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'space-around' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#475569', maxWidth: '140px', lineHeight: 1.3 }}>
                Number of meetings you hosted this week
              </span>
              <span style={{ fontSize: '1.875rem', fontWeight: 700, color: '#2f65f6' }}>
                {hostedCount}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#475569', maxWidth: '140px', lineHeight: 1.3 }}>
                Number of meetings you hosted this week
              </span>
              <span style={{ fontSize: '1.875rem', fontWeight: 700, color: '#2f65f6' }}>
                {attendedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ALL MEETINGS SECTION ── */}
      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b' }}>
            All Active & Past Meetings
          </h3>

          <div style={{ position: 'relative', width: '260px' }}>
            <HiSearch style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
            }} size={16} />
            <input
              className="input"
              style={{ paddingLeft: '2.25rem', fontSize: '0.8125rem', padding: '0.45rem 0.75rem 0.45rem 2.25rem' }}
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchMeetings(e.target.value);
              }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="vb-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No meetings found. Start a meeting to get started!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {meetings.map((meeting) => (
              <div
                key={meeting._id}
                className="vb-card"
                style={{
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '0.5rem',
                    background: '#eef4ff',
                    color: '#2f65f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <HiVideoCamera size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                      {meeting.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span>ID: {meeting.roomId}</span>
                      <span>•</span>
                      <span>{new Date(meeting.createdAt).toLocaleDateString()}</span>
                      {meeting.summary?.summary && (
                        <span className="badge badge-success" style={{ fontSize: '0.625rem' }}>AI Summary</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    onClick={(e) => copyMeetingLink(meeting.roomId, e)}
                    title="Copy Link"
                  >
                    <HiClipboardCopy size={16} />
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={(e) => handleDeleteMeeting(meeting._id, e)}
                    title="Delete"
                  >
                    <HiTrash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CREATE MEETING MODAL ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.5rem',
        }} onClick={() => setShowCreateModal(false)}>
          <div className="vb-card animate-slide-up" style={{
            width: '100%',
            maxWidth: '420px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
              Create a Meeting
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              Start an instant video room with live audio/video and AI insights
            </p>

            <form onSubmit={handleCreateMeeting}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>
                  Meeting Title
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Weekly Product Sync"
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
                  {creating ? <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : 'Start Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── JOIN BY CODE MODAL ── */}
      {showJoinModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.5rem',
        }} onClick={() => setShowJoinModal(false)}>
          <div className="vb-card animate-slide-up" style={{
            width: '100%',
            maxWidth: '420px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
              Join a Meeting
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              Enter room ID or paste full invitation link
            </p>

            <form onSubmit={handleJoinByCode}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>
                  Room ID or URL
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 7a8d92 or https://.../meeting/7a8d92"
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

