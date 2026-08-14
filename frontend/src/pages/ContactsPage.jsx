import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { authService } from '../services/authService';
import { invitationService } from '../services/invitationService';
import { messageService } from '../services/messageService';
import {
  HiChat,
  HiVideoCamera,
  HiChevronDown,
  HiSearch,
  HiMail,
  HiCheck,
  HiUserGroup,
  HiSparkles,
  HiPaperAirplane,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const ContactsPage = () => {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('az'); // 'az' | 'za'
  const [contactType, setContactType] = useState('all'); // 'all' | 'online'
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingBulkInvite, setSendingBulkInvite] = useState(false);

  // Multi-select / Tick state
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());

  // Real Direct Chat modal state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
        // Select first other user, or first user
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

  // Other users eligible for meeting invitations (excludes oneself)
  const otherUsers = useMemo(() => {
    return filteredUsers.filter((u) => u._id !== currentUser?._id);
  }, [filteredUsers, currentUser]);

  const isAllSelected = otherUsers.length > 0 && otherUsers.every((u) => selectedUserIds.has(u._id));

  // Toggle single user checkbox tick
  const handleToggleUser = (userId, e) => {
    e.stopPropagation();
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Toggle select all eligible contacts
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(otherUsers.map((u) => u._id)));
    }
  };

  // Single invitation send
  const handleInviteMeeting = async () => {
    if (!selectedUser || selectedUser._id === currentUser?._id) return;
    setSendingInvite(true);
    try {
      const meetingTitle = `Meeting with ${currentUser?.name || 'Host'}`;
      await invitationService.create(selectedUser._id, meetingTitle);
      toast.success(`Meeting invitation sent to ${selectedUser.name}! It will reflect on their dashboard.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  // Bulk invitation send to all ticked/selected members in a single click
  const handleBulkInvite = async () => {
    if (selectedUserIds.size === 0) return;
    setSendingBulkInvite(true);
    try {
      const meetingTitle = `Team Meeting with ${currentUser?.name || 'Host'}`;
      const invitePromises = Array.from(selectedUserIds).map((inviteeId) =>
        invitationService.create(inviteeId, meetingTitle)
      );
      await Promise.all(invitePromises);
      toast.success(
        `Meeting invitation sent to ${selectedUserIds.size} selected member${selectedUserIds.size > 1 ? 's' : ''}!`
      );
      setSelectedUserIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invitations');
    } finally {
      setSendingBulkInvite(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

  // Load real conversation history when opening chat
  const handleStartChat = async () => {
    if (!selectedUser || selectedUser._id === currentUser?._id) return;
    setChatOpen(true);
    setChatLoading(true);
    try {
      const res = await messageService.getDirectMessages(selectedUser._id);
      if (res?.messages && Array.isArray(res.messages)) {
        setChatMessages(
          res.messages.map((m) => ({
            _id: m._id,
            senderId: m.senderId?._id || m.senderId,
            senderName: m.senderName,
            text: m.message,
            time: new Date(m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMe: (m.senderId?._id || m.senderId) === currentUser?._id,
          }))
        );
      }
    } catch {
      toast.error('Failed to load conversation');
    } finally {
      setChatLoading(false);
    }
  };

  // Listen for live incoming Direct Messages over Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleDirectMessage = (msg) => {
      const isFromCurrentChat =
        selectedUser &&
        ((msg.senderId === selectedUser._id && msg.receiverId === currentUser?._id) ||
          (msg.senderId === currentUser?._id && msg.receiverId === selectedUser._id));

      if (isFromCurrentChat) {
        setChatMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          const isMe = (msg.senderId?._id || msg.senderId) === currentUser?._id;
          return [
            ...prev,
            {
              _id: msg._id,
              senderId: msg.senderId,
              senderName: msg.senderName,
              text: msg.message,
              time: new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isMe,
            },
          ];
        });
      } else if (msg.senderId !== currentUser?._id) {
        // Notification for incoming message from other user
        toast(`💬 New message from ${msg.senderName}: "${msg.message.slice(0, 35)}"`, {
          icon: '✉️',
          duration: 4000,
        });
      }
    };

    socket.on('direct-message', handleDirectMessage);
    return () => {
      socket.off('direct-message', handleDirectMessage);
    };
  }, [socket, selectedUser, currentUser]);

  // Send Direct Message in real-time
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedUser) return;
    const textToSend = chatInput.trim();
    setChatInput('');

    try {
      if (socket && socket.connected) {
        socket.emit('direct-message', {
          receiverId: selectedUser._id,
          message: textToSend,
        });
      } else {
        const res = await messageService.sendDirectMessage(selectedUser._id, textToSend);
        if (res?.message) {
          setChatMessages((prev) => [
            ...prev,
            {
              _id: res.message._id,
              senderId: currentUser._id,
              senderName: currentUser.name,
              text: res.message.message,
              time: new Date(res.message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isMe: true,
            },
          ]);
        }
      }
    } catch {
      toast.error('Failed to send message');
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

  // Avatar color generator based on name
  const getAvatarColor = (name = '') => {
    const colors = ['#2f65f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="p-4 sm:p-6 md:p-8" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      
      {/* ── Top Filters & Search Row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
      }}>
        {/* Contact type Dropdown */}
        <div style={{ position: 'relative', flex: '1 1 140px' }}>
          <select
            value={contactType}
            onChange={(e) => setContactType(e.target.value)}
            style={{
              width: '100%',
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
        <div style={{ position: 'relative', flex: '1 1 140px' }}>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{
              width: '100%',
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
        <div style={{ position: 'relative', flex: '2 1 200px', minWidth: '180px' }}>
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
          {filteredUsers.length} {filteredUsers.length === 1 ? 'member' : 'members'}
        </span>
      </div>

      {/* ── Multi-select Bulk Actions Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.625rem 1rem',
        background: selectedUserIds.size > 0 ? '#eef4ff' : '#f8fafc',
        border: selectedUserIds.size > 0 ? '1px solid #bfdbfe' : '1px solid #eef2f6',
        borderRadius: '0.625rem',
        marginBottom: '1rem',
        transition: 'all 0.2s ease',
      }}>
        {/* Select All Checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleToggleSelectAll}
            style={{
              width: '1rem',
              height: '1rem',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              accentColor: '#2f65f6',
            }}
          />
          <span>Select all members</span>
          {selectedUserIds.size > 0 && (
            <span style={{ color: '#2f65f6', fontSize: '0.75rem', fontWeight: 700 }}>
              ({selectedUserIds.size} selected)
            </span>
          )}
        </label>

        {/* Single-Click Bulk Send Invitation Button */}
        {selectedUserIds.size > 0 && (
          <button
            onClick={handleBulkInvite}
            disabled={sendingBulkInvite}
            className="animate-fade-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#2f65f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.45rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(47, 101, 246, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            {sendingBulkInvite ? (
              <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px', borderTopColor: '#ffffff' }} />
            ) : (
              <HiVideoCamera size={16} />
            )}
            <span>Invite Selected ({selectedUserIds.size})</span>
          </button>
        )}
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="contacts-grid">

        {/* ── Left Column: Contact List with Checkboxes ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          maxHeight: 'calc(100vh - 270px)',
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
              const isChecked = selectedUserIds.has(u._id);
              const color = getAvatarColor(u.name);

              return (
                <div
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.625rem',
                    cursor: 'pointer',
                    background: isSelected ? '#edf2fe' : 'transparent',
                    border: isChecked ? '1px solid #bfdbfe' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = isChecked ? '#f0f7ff' : 'transparent';
                  }}
                >
                  {/* Checkbox Tick for Other Members */}
                  {!isSelf ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleToggleUser(u._id, e)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '1rem',
                        height: '1rem',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        accentColor: '#2f65f6',
                        flexShrink: 0,
                      }}
                      title="Select for meeting invitation"
                    />
                  ) : (
                    <div style={{ width: '1rem', flexShrink: 0 }} />
                  )}

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

        {/* ── Right Column: Selected User Profile Card ── */}
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

              {/* Action Buttons: ONLY FOR CORRESPONDING USERS (EXCLUDES OWN PROFILE) */}
              {selectedUser._id === currentUser?._id ? (
                /* Own Profile Note */
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#eef4ff',
                  color: '#2f65f6',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '9999px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginBottom: '1.75rem',
                  border: '1px solid #bfdbfe',
                }}>
                  <HiSparkles size={16} />
                  <span>Your Personal Account Profile</span>
                </div>
              ) : (
                /* Other Members: Start chat & Invite meeting */
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
              )}

              {/* Details table matching design */}
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

      {/* ── Slide-over Real 1-on-1 Instant Chat Drawer ── */}
      {chatOpen && selectedUser && (
        <div className="vb-card animate-slide-right" style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          bottom: '2rem',
          width: '360px',
          maxWidth: 'calc(100vw - 2rem)',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: getAvatarColor(selectedUser.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700 }}>
                {selectedUser.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1e293b' }}>{selectedUser.name}</h3>
                <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  Online
                </span>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '1.25rem',
                padding: '0.25rem',
              }}
              title="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Real Chat Messages Stream */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
            {chatLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                <div className="spinner" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
                <HiChat size={28} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem' }} />
                No messages yet. Send a direct message to start the conversation!
              </div>
            ) : (
              chatMessages.map((m, i) => (
                <div key={m._id || i} style={{ alignSelf: m.isMe ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                  <div style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: m.isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                    background: m.isMe ? '#2f65f6' : '#f1f5f9',
                    color: m.isMe ? '#ffffff' : '#1e293b',
                    fontSize: '0.8125rem',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}>
                    {m.text}
                  </div>
                  <span style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.125rem', display: 'block', textAlign: m.isMe ? 'right' : 'left' }}>
                    {m.time}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSendChatMessage} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
            <input
              type="text"
              placeholder={`Message ${selectedUser.name}...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="input"
              style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
              autoFocus
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="btn btn-primary"
              style={{ padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <span>Send</span>
              <HiPaperAirplane size={14} style={{ transform: 'rotate(90deg)' }} />
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default ContactsPage;
