import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { meetingService } from '../services/meetingService';
import { invitationService } from '../services/invitationService';
import {
  HiChat,
  HiVideoCamera,
  HiChevronDown,
  HiSearch,
  HiMail,
  HiClock,
  HiGlobe,
  HiUserGroup,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const ContactsPage = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('az'); // 'az' | 'za'
  const [contactType, setContactType] = useState('all'); // 'all' | 'online'
  const [sendingInvite, setSendingInvite] = useState(false);

  // Chat modal state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await authService.getUsers();
      const fetched = data.users || [];
      setUsers(fetched);
      if (fetched.length > 0) {
        // Select first user who is not current user, or first user
        const first = fetched.find(u => u._id !== currentUser?._id) || fetched[0];
        setSelectedUser(first);
      }
    } catch {
      toast.error('Failed to load contacts from directory');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortOrder === 'az') return (a.name || '').localeCompare(b.name || '');
        if (sortOrder === 'za') return (b.name || '').localeCompare(a.name || '');
        return 0;
      });
  }, [users, searchQuery, sortOrder]);

  // Send real meeting invitation to selected user
  const handleInviteMeeting = async () => {
    if (!selectedUser) return;
    setSendingInvite(true);
    try {
      const meetingTitle = `Call with ${currentUser?.name || 'Team'}`;
      await invitationService.create(selectedUser._id, meetingTitle);
      toast.success(`Meeting invitation sent to ${selectedUser.name}! It will reflect on their dashboard.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  // Format time zone string
  const getTimeZoneString = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;
      const sign = offset >= 0 ? '+' : '-';
      const hours = String(Math.floor(Math.abs(offset))).padStart(2, '0');
      const mins = String(Math.abs(offset) % 1 * 60).padStart(2, '0');
      return `GMT ${sign}${hours}:${mins} (${tz.split('/')[1] || tz})`;
    } catch {
      return 'GMT +00:00 (UTC)';
    }
  };

  const handleStartChat = () => {
    if (!selectedUser) return;
    setChatOpen(true);
    if (chatMessages.length === 0) {
      setChatMessages([
        { sender: selectedUser.name, text: `Hi! Feel free to reach out anytime.`, time: 'Just now' }
      ]);
    }
  };

  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages(prev => [
      ...prev,
      { sender: 'You', text: chatInput.trim(), time: 'Just now', isMe: true }
    ]);
    setChatInput('');
  };

  // Avatar color generator based on name
  const getAvatarColor = (name = '') => {
    const colors = ['#2f65f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* ── Top Filters Row matching the design ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        {/* Contact type Dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={contactType}
            onChange={(e) => setContactType(e.target.value)}
            style={{
              padding: '0.45rem 2rem 0.45rem 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">Contact type: All</option>
            <option value="online">Contact type: Online</option>
          </select>
          <HiChevronDown size={14} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
        </div>

        {/* Sort by Dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              padding: '0.45rem 2rem 0.45rem 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#334155',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="az">Sort by: Name (A-Z)</option>
            <option value="za">Sort by: Name (Z-A)</option>
          </select>
          <HiChevronDown size={14} style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
        </div>

        {/* Search / Company Directory */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <HiSearch size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search directory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.875rem 0.45rem 2.25rem',
              fontSize: '0.8125rem',
              color: '#1e293b',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              outline: 'none',
            }}
          />
        </div>

        <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto', fontWeight: 600 }}>
          {filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'} in directory
        </span>
      </div>

      {/* ── Main Two-Column Layout (Matching Attached Mockup) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 320px) 1fr',
        gap: '2.5rem',
        alignItems: 'start',
      }}>

        {/* ── Left Column: Contact List ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          maxHeight: 'calc(100vh - 230px)',
          overflowY: 'auto',
          paddingRight: '0.5rem',
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
              <div className="spinner" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="vb-card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              <HiUserGroup size={32} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem', display: 'block' }} />
              No contacts found
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUser?._id === u._id;
              const isSelf = u._id === currentUser?._id;
              const color = getAvatarColor(u.name);

              return (
                <div
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.875rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.625rem',
                    cursor: 'pointer',
                    background: isSelected ? '#edf2fe' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* User Avatar with Green Online indicator */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: '2.25rem',
                      height: '2.25rem',
                      borderRadius: '50%',
                      background: color,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                    }}>
                      {u.name?.charAt(0).toUpperCase() || 'U'}
                    </div>

                    {/* Online indicator dot */}
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10b981',
                      border: '1.5px solid #ffffff',
                    }} />
                  </div>

                  {/* Name */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#1e293b' : '#334155',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {u.name} {isSelf && <span style={{ color: '#2f65f6', fontSize: '0.75rem', fontWeight: 600 }}>(You)</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Right Column: Selected User Profile Card (Matching Image) ── */}
        <div>
          {selectedUser ? (
            <div className="vb-card animate-fade-in" style={{
              padding: '2.5rem 2rem',
              maxWidth: '520px',
              margin: '0 auto',
              background: '#ffffff',
              border: '1px solid #eef2f6',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              
              {/* Large Profile Photo / Avatar */}
              <div style={{
                position: 'relative',
                width: '6.5rem',
                height: '6.5rem',
                borderRadius: '50%',
                background: getAvatarColor(selectedUser.name),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '2.25rem',
                fontWeight: 700,
                marginBottom: '1.25rem',
                boxShadow: '0 8px 24px rgba(47, 101, 246, 0.25)',
              }}>
                {selectedUser.name?.charAt(0).toUpperCase() || 'U'}

                {/* Big online badge on avatar */}
                <div style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '3px solid #ffffff',
                }} />
              </div>

              {/* Name */}
              <h2 style={{
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: '0.25rem',
              }}>
                {selectedUser.name}
              </h2>

              {/* Status subtitle */}
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#10b981',
                marginBottom: '1.5rem',
              }}>
                Available now
              </div>

              {/* Action Buttons: [ Start chat ] [ Start meeting ] */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '2rem',
                width: '100%',
                justifyContent: 'center',
              }}>
                {/* Start chat button (Black pill) */}
                <button
                  onClick={handleStartChat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#181b22',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#272c36'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#181b22'; }}
                >
                  <HiChat size={16} />
                  <span>Start chat</span>
                </button>

                {/* Invite meeting button (Royal Blue pill) */}
                <button
                  onClick={handleInviteMeeting}
                  disabled={sendingInvite}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#2f65f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 4px 14px rgba(47, 101, 246, 0.35)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1d52e0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2f65f6'; }}
                >
                  {sendingInvite ? (
                    <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px', borderTopColor: '#ffffff' }} />
                  ) : (
                    <HiVideoCamera size={16} />
                  )}
                  <span>Invite meeting</span>
                </button>
              </div>

              {/* Details table matching image */}
              <div style={{
                width: '100%',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
                textAlign: 'left',
                fontSize: '0.8125rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '130px', color: '#64748b', fontWeight: 500 }}>Time zone:</span>
                  <span style={{ color: '#1e293b', fontWeight: 600 }}>{getTimeZoneString()}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '130px', color: '#64748b', fontWeight: 500 }}>Email:</span>
                  <a
                    href={`mailto:${selectedUser.email}`}
                    style={{ color: '#2f65f6', textDecoration: 'none', fontWeight: 600 }}
                  >
                    {selectedUser.email}
                  </a>
                </div>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '130px', color: '#64748b', fontWeight: 500 }}>Last seen active:</span>
                  <span style={{ color: '#64748b' }}>Active now</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="vb-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Select a contact to view their profile
            </div>
          )}
        </div>

      </div>

      {/* ── Slide-over Instant Chat Modal ── */}
      {chatOpen && selectedUser && (
        <div className="vb-card animate-slide-right" style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          bottom: '2rem',
          width: '340px',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: '#2f65f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                {selectedUser.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{selectedUser.name}</h3>
                <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 600 }}>Available now</span>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.25rem' }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  padding: '0.5rem 0.875rem',
                  borderRadius: '0.75rem',
                  background: m.isMe ? '#2f65f6' : '#f1f5f9',
                  color: m.isMe ? '#ffffff' : '#1e293b',
                  fontSize: '0.8125rem',
                }}>
                  {m.text}
                </div>
                <span style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.125rem', display: 'block', textAlign: m.isMe ? 'right' : 'left' }}>
                  {m.time}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
            <input
              type="text"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="input"
              style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.875rem' }}>
              Send
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default ContactsPage;
