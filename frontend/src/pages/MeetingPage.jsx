import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { meetingService } from '../services/meetingService';
import useMediaStream from '../hooks/useMediaStream';
import useWebRTC from '../hooks/useWebRTC';
import useRecording from '../hooks/useRecording';
import {
  HiMicrophone, HiVideoCamera, HiDesktopComputer,
  HiChat, HiPhone, HiUsers, HiClipboardCopy,
  HiDocumentText, HiPencilAlt, HiEmojiHappy, HiHand,
  HiPaperAirplane, HiChevronDown, HiDotsHorizontal,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

// Memoized Video Tile to prevent video blinking/re-rendering on chat typing or state changes
const MeetingVideoTile = memo(({ tile, idx, isLocalVideoEnabled, isLocalAudioEnabled }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && tile.stream) {
      if (video.srcObject !== tile.stream) {
        video.srcObject = tile.stream;
      }
    }
  }, [tile.stream]);

  const showFallbackAvatar = !tile.stream || (tile.isLocal && !isLocalVideoEnabled);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#15181e',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        position: 'relative',
        border: idx === 0 ? '3px solid #2f65f6' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: idx === 0 ? '0 0 16px rgba(47, 101, 246, 0.4)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted={tile.isLocal}
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: tile.isLocal ? 'scaleX(-1)' : 'none',
          display: showFallbackAvatar ? 'none' : 'block',
        }}
      />

      {/* Fallback avatar if video disabled */}
      {showFallbackAvatar && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#1a1e24',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '1.75rem',
          fontWeight: 700,
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            background: '#2f65f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {tile.userName?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      )}

      {/* Bottom-left Mute / Status pill icon on video tile */}
      <div style={{
        position: 'absolute',
        bottom: '0.625rem',
        left: '0.625rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        padding: '0.25rem 0.5rem',
        borderRadius: '9999px',
        color: '#ffffff',
        fontSize: '0.6875rem',
        fontWeight: 600,
        zIndex: 10,
      }}>
        <div style={{
          width: '1rem',
          height: '1rem',
          borderRadius: '50%',
          background: (tile.isLocal && !isLocalAudioEnabled) ? '#ef4444' : 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <HiMicrophone size={10} color="#ffffff" />
        </div>
        <span>{tile.userName} {tile.isLocal ? '(You)' : ''}</span>
      </div>
    </div>
  );
});

const MeetingPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  // State
  const [meeting, setMeeting] = useState(null);
  const [joined, setJoined] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);
  
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [previewStarted, setPreviewStarted] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Refs
  const localVideoRef = useRef(null);
  const chatEndRef = useRef(null);

  // Hooks
  const {
    stream, audioEnabled, videoEnabled,
    isScreenSharing, startMedia, stopMedia,
    toggleAudio, toggleVideo, startScreenShare, stopScreenShare, streamRef,
  } = useMediaStream();

  const { remoteStreams, replaceTrack } = useWebRTC(
    joined ? socket : null,
    stream,
    roomId
  );

  const {
    isRecording, recordingTime, recordingBlob,
    startRecording, stopRecording, updateRecordingStreams, formatTime,
  } = useRecording();

  const isHost = meeting
    ? (meeting.hostId?._id || meeting.hostId)?.toString() === user?._id?.toString()
    : false;

  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const data = await meetingService.getById(roomId);
        setMeeting(data.meeting);
        
        // Fetch persisted messages for this specific meeting
        try {
          const msgData = await meetingService.getMessages(roomId);
          if (msgData?.messages && Array.isArray(msgData.messages)) {
            setMessages(msgData.messages.map((m) => {
              const d = new Date(m.createdAt || m.timestamp || Date.now());
              const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              return {
                senderId: m.senderId?._id || m.senderId,
                senderName: m.senderName,
                message: m.message,
                time: timeStr,
              };
            }));
          }
        } catch {
          // ignore chat load error
        }
      } catch {
        setMeeting({ roomId, title: 'Meeting AI Session' });
      } finally {
        setLoading(false);
      }
    };
    loadMeeting();
  }, [roomId]);

  useEffect(() => {
    if (!loading && !joined && !previewStarted) {
      const startPreview = async () => {
        try {
          await startMedia(true, true);
          setPreviewStarted(true);
        } catch {
          setPreviewError(true);
          setPreviewStarted(true);
        }
      };
      startPreview();
    }
  }, [loading, joined, previewStarted, startMedia]);

  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleChat = (msg) => {
      if (msg.senderId && user?._id && msg.senderId.toString() === user._id.toString()) {
        return;
      }
      const now = msg.timestamp ? new Date(msg.timestamp) : new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setMessages((prev) => [...prev, { ...msg, time: timeStr }]);
    };

    const handleMeetingEnded = ({ hostName }) => {
      toast(`🛑 ${hostName} ended the meeting`, { duration: 3000 });
      stopMedia();
      navigate('/dashboard');
    };

    const handleReaction = ({ emoji, senderName }) => {
      triggerFloatingReaction(emoji);
      toast(`${senderName} reacted with ${emoji}`, { duration: 2000 });
    };

    const handleHandRaise = ({ userName, isRaised }) => {
      if (isRaised) {
        toast(`✋ ${userName} raised their hand`, { duration: 3000 });
      }
    };

    socket.on('chat-message', handleChat);
    socket.on('meeting-ended', handleMeetingEnded);
    socket.on('reaction-sent', handleReaction);
    socket.on('hand-raised', handleHandRaise);

    return () => {
      socket.off('chat-message', handleChat);
      socket.off('meeting-ended', handleMeetingEnded);
      socket.off('reaction-sent', handleReaction);
      socket.off('hand-raised', handleHandRaise);
    };
  }, [socket, stopMedia, navigate]);

  const triggerFloatingReaction = (emoji) => {
    const id = Math.random().toString();
    const x = Math.random() * 60 + 20; // 20% to 80% width
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);
  };

  const handleSendReaction = (emoji) => {
    triggerFloatingReaction(emoji);
    if (socket) {
      socket.emit('reaction-sent', { roomId, emoji, senderName: user?.name || 'You' });
    }
    setShowReactions(false);
  };

  const handleToggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    if (nextState) {
      toast.success('You raised your hand');
    }
    if (socket) {
      socket.emit('hand-raised', { roomId, userName: user?.name || 'You', isRaised: nextState });
    }
  };

  const handleJoin = async () => {
    try {
      if (!stream) {
        await startMedia(true, true);
      }
      try {
        const data = await meetingService.join(roomId);
        setMeeting(data.meeting);
      } catch {
        // Fallback join
      }

      if (socket) {
        socket.emit('join-room', { roomId, userName: user?.name, userId: user?._id });
      }

      setJoined(true);
      toast.success('Connected to meeting room!');
    } catch {
      toast.error('Failed to access camera/microphone');
    }
  };

  const ensureRecordingUploaded = async () => {
    if (isRecording || recordingBlob) {
      try {
        toast.loading('Saving and uploading meeting recording...', { id: 'upload' });
        let blob = recordingBlob;
        if (isRecording) {
          blob = await stopRecording();
          socket?.emit('recording-stopped', { roomId });
        }
        if (blob) {
          const targetId = meeting?._id || roomId;
          await meetingService.uploadRecording(targetId, blob);
          toast.success('Recording saved successfully!', { id: 'upload' });
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to upload recording', { id: 'upload' });
      }
    }
  };

  const handleLeave = async () => {
    await ensureRecordingUploaded();
    stopMedia();
    if (socket) socket.emit('leave-room', { roomId });
    navigate('/dashboard');
  };

  const handleEndMeeting = async () => {
    if (!window.confirm('End this meeting for everyone?')) return;
    setEnding(true);
    try {
      await ensureRecordingUploaded();
      await meetingService.end(meeting?._id || roomId);
      if (socket) socket.emit('host-end-meeting', { roomId });
      stopMedia();
      toast.success('Meeting ended');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end meeting');
      setEnding(false);
    }
  };

  const handleToggleAudio = () => {
    const enabled = toggleAudio();
    if (joined && socket) {
      socket.emit('toggle-media', { roomId, type: 'audio', enabled });
    }
  };

  const handleToggleVideo = () => {
    const enabled = toggleVideo();
    if (joined && socket) {
      socket.emit('toggle-media', { roomId, type: 'video', enabled });
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      if (streamRef.current) {
        const cameraTrack = streamRef.current.getVideoTracks()[0];
        if (cameraTrack) replaceTrack(cameraTrack, null);
      }
      socket?.emit('screen-share-stopped', { roomId });
    } else {
      try {
        const displayStream = await startScreenShare();
        const screenTrack = displayStream.getVideoTracks()[0];
        const cameraTrack = streamRef.current?.getVideoTracks()[0];
        if (screenTrack) replaceTrack(screenTrack, cameraTrack);
        socket?.emit('screen-share-started', { roomId });
        screenTrack.addEventListener('ended', () => {
          if (cameraTrack) replaceTrack(cameraTrack, screenTrack);
          socket?.emit('screen-share-stopped', { roomId });
        });
      } catch {
        // Cancelled
      }
    }
  };

  const handleRecording = async () => {
    if (isRecording) {
      toast.loading('Saving recording...', { id: 'upload' });
      const blob = await stopRecording();
      socket?.emit('recording-stopped', { roomId });
      if (blob && blob.size > 0) {
        try {
          const targetId = meeting?._id || roomId;
          await meetingService.uploadRecording(targetId, blob);
          toast.success('Recording saved successfully!', { id: 'upload' });
        } catch (err) {
          toast.error('Failed to upload recording', { id: 'upload' });
        }
      }
    } else {
      if (allStreams.length > 0) {
        startRecording(allStreams);
        socket?.emit('recording-started', { roomId });
        toast.success(`Recording started (${allStreams.length} participant${allStreams.length > 1 ? 's' : ''})`);
      } else {
        toast.error('No media stream available to record');
      }
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Meeting link copied!');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMsg = {
      senderId: user?._id || 'me',
      senderName: user?.name || 'You',
      message: messageInput.trim(),
      time: timeStr,
    };
    setMessages(prev => [...prev, newMsg]);
    if (socket) {
      socket.emit('chat-message', {
        roomId,
        message: messageInput.trim(),
        meetingId: meeting?._id,
      });
    }
    setMessageInput('');
  };

  // Combine local and remote streams for all participants
  const allStreams = useMemo(() => {
    const list = [];
    if (stream) {
      list.push({ id: 'local', stream, userName: user?.name || 'You', isLocal: true, audioEnabled });
    }
    remoteStreams.forEach((data, socketId) => {
      list.push({ id: socketId, stream: data.stream, userName: data.userName || 'Participant', isLocal: false, audioEnabled: true });
    });
    return list;
  }, [stream, remoteStreams, user, audioEnabled]);

  // Keep multi-participant recording synced if participants join/leave during recording
  useEffect(() => {
    if (isRecording) {
      updateRecordingStreams(allStreams);
    }
  }, [allStreams, isRecording, updateRecordingStreams]);

  const displayTiles = useMemo(() => {
    return allStreams;
  }, [allStreams]);

  // ═══════════════════════════════════════════════════════════
  // 1. LOBBY VIEW
  // ═══════════════════════════════════════════════════════════
  if (!joined) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: '#f8fafc',
      }}>
        <div className="vb-card" style={{ width: '100%', maxWidth: '600px', overflow: 'hidden' }}>
          {/* Header */}
          <header className="video-buddy-header">
            <Link to="/dashboard" className="video-buddy-logo">
              <div className="video-buddy-logo-badge">
                <HiVideoCamera size={18} />
              </div>
              <span>Meeting AI</span>
            </Link>
            <span style={{ fontSize: '0.8125rem', opacity: 0.9 }}>
              Room: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{roomId}</span>
            </span>
          </header>

          <div style={{ padding: '2rem 2.5rem', textAlign: 'center', background: '#ffffff' }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
              {meeting?.title || 'Ready to join?'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Check your camera and audio before connecting
            </p>

            {/* Video preview tile */}
            <div style={{
              width: '100%',
              aspectRatio: '16/10',
              borderRadius: '1rem',
              overflow: 'hidden',
              position: 'relative',
              background: '#1e2229',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                  display: videoEnabled && stream ? 'block' : 'none',
                }}
              />

              {(!stream || !videoEnabled) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '4.5rem',
                    height: '4.5rem',
                    borderRadius: '50%',
                    background: '#2f65f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '1.75rem',
                    fontWeight: 700,
                  }}>
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>
                    {previewError ? 'Camera unavailable' : !stream ? 'Starting camera...' : 'Camera is turned off'}
                  </span>
                </div>
              )}

              {/* Status Pill */}
              <div style={{ position: 'absolute', bottom: '0.875rem', left: '0.875rem', background: 'rgba(0,0,0,0.6)', padding: '0.25rem 0.75rem', borderRadius: '9999px', color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                {user?.name || 'You'} {!audioEnabled ? '(Muted)' : ''}
              </div>
            </div>

            {/* Mic & Cam toggle */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
              <button
                onClick={handleToggleAudio}
                className={`btn-icon ${!audioEnabled ? 'danger' : 'active'}`}
                style={{ width: '3rem', height: '3rem', borderRadius: '50%' }}
                title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
              >
                <HiMicrophone size={20} />
              </button>
              <button
                onClick={handleToggleVideo}
                className={`btn-icon ${!videoEnabled ? 'danger' : 'active'}`}
                style={{ width: '3rem', height: '3rem', borderRadius: '50%' }}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                <HiVideoCamera size={20} />
              </button>
            </div>

            {/* Join button */}
            <button
              className="btn btn-primary"
              onClick={handleJoin}
              style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', borderRadius: '0.75rem' }}
            >
              Join Meeting Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 2. IN-MEETING ROOM VIEW (Matching Image 1)
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: 0,
      background: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Floating Animated Reactions */}
      {floatingReactions.map(r => (
        <div
          key={r.id}
          style={{
            position: 'absolute',
            bottom: '80px',
            left: `${r.x}%`,
            fontSize: '2.5rem',
            zIndex: 999,
            pointerEvents: 'none',
            animation: 'popReaction 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          }}
        >
          {r.emoji}
        </div>
      ))}

      {/* Main Application Window Frame */}
      <div style={{
        width: '100%',
        height: '100vh',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        
        {/* ── 1. Top Meeting AI Header ── */}
        <header className="video-buddy-header" style={{ flexWrap: 'wrap', height: 'auto', minHeight: '58px', padding: '0.5rem 1rem', gap: '0.5rem' }}>
          <Link to="/dashboard" className="video-buddy-logo">
            <div className="video-buddy-logo-badge">
              <HiVideoCamera size={18} />
            </div>
            <span>Meeting AI</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.8125rem', color: '#ffffff', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontWeight: 600 }}>{meeting?.title || 'Sync'}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline" style={{ fontFamily: 'monospace' }}>ID: {roomId}</span>
            </div>

            {isRecording && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                background: 'rgba(239, 68, 68, 0.9)',
                color: '#ffffff',
                padding: '0.25rem 0.625rem',
                borderRadius: '9999px',
                fontSize: '0.6875rem',
                fontWeight: 700,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', animation: 'recording-pulse 1s infinite' }} />
                REC {formatTime(recordingTime)}
              </div>
            )}

            <button
              onClick={copyLink}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#ffffff',
                padding: '0.35rem 0.625rem',
                borderRadius: '0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <HiClipboardCopy size={14} />
              <span className="hidden sm:inline">Copy Link</span>
            </button>
          </div>
        </header>

        {/* ── 2. Middle Area: Video Stage (Left) + Right Chat Panel ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          background: '#f8fafc',
          padding: '0.875rem',
          gap: '0.875rem',
        }}>
          
          {/* Main Video Canvas Stage */}
          <div style={{
            flex: chatOpen || participantsOpen || notesOpen ? '1 1 72%' : '1 1 100%',
            background: '#1e2229',
            borderRadius: '1rem',
            padding: '0.875rem',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {/* Grid of video tiles matching Image 1 3x3 layout */}
            <div style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              gridTemplateColumns: displayTiles.length <= 1 ? '1fr' : displayTiles.length <= 2 ? 'repeat(2, 1fr)' : displayTiles.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gridTemplateRows: displayTiles.length <= 2 ? '1fr' : displayTiles.length <= 6 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: '0.625rem',
            }}>
              {displayTiles.map((t, idx) => (
                <MeetingVideoTile
                  key={t.id}
                  tile={t}
                  idx={idx}
                  isLocalVideoEnabled={videoEnabled}
                  isLocalAudioEnabled={audioEnabled}
                />
              ))}
            </div>

            {/* ── Floating Center-Bottom Quick Controls Overlay (Matching Image 1) ── */}
            <div style={{
              position: 'absolute',
              bottom: '1.25rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'rgba(24, 28, 36, 0.85)',
              backdropFilter: 'blur(12px)',
              padding: '0.5rem 0.875rem',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              zIndex: 30,
            }}>
              {/* Mic button */}
              <button
                onClick={handleToggleAudio}
                title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: audioEnabled ? 'rgba(255, 255, 255, 0.15)' : '#ef4444',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <HiMicrophone size={18} />
              </button>

              {/* Camera button */}
              <button
                onClick={handleToggleVideo}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: videoEnabled ? 'rgba(255, 255, 255, 0.15)' : '#ef4444',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <HiVideoCamera size={18} />
              </button>

              {/* Screen share button */}
              <button
                onClick={handleScreenShare}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: isScreenSharing ? '#2f65f6' : 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <HiDesktopComputer size={18} />
              </button>

              {/* More options button */}
              <button
                onClick={() => setNotesOpen(!notesOpen)}
                title="Notes / Options"
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <HiDotsHorizontal size={18} />
              </button>

              {/* End Call / Leave button (Red round) */}
              <button
                onClick={isHost ? handleEndMeeting : handleLeave}
                title={isHost ? 'End meeting for all' : 'Leave call'}
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                }}
              >
                <HiPhone size={18} style={{ transform: 'rotate(135deg)' }} />
              </button>
            </div>
          </div>

          {/* ── Right Side Panel (Chat & Attendees - Matching Image 1) ── */}
          {chatOpen && (
            <div className="vb-card animate-slide-right" style={{
              width: '320px',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '1rem',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              {/* Panel Top Action Buttons */}
              <div style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <button
                  onClick={handleToggleAudio}
                  style={{
                    padding: '0.35rem 0.875rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: '#2f65f6',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  {audioEnabled ? 'Mute' : 'Unmute'}
                </button>

                <button
                  onClick={() => setParticipantsOpen(!participantsOpen)}
                  style={{
                    padding: '0.35rem 0.875rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: '#2f65f6',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>More</span>
                  <HiChevronDown size={14} />
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    lineHeight: 1,
                    padding: '0.25rem',
                  }}
                  title="Close panel"
                >
                  ✕
                </button>
              </div>

              {/* Messages Stream */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.875rem',
              }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
                    <HiChat size={28} style={{ color: '#cbd5e1', margin: '0 auto 0.5rem', display: 'block' }} />
                    No messages yet in this meeting
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                      {/* User Avatar Circle */}
                      <div style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        background: idx % 3 === 0 ? '#3b82f6' : idx % 3 === 1 ? '#10b981' : '#f59e0b',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {m.senderName?.charAt(0).toUpperCase()}
                      </div>

                      {/* Message Body */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>
                            {m.senderName}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                            {m.time}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {m.message}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Bottom Chat Input Form matching "Type here >" */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <input
                  type="text"
                  placeholder="Type here"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.8125rem',
                    color: '#1e293b',
                    background: 'transparent',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2f65f6',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.25rem',
                  }}
                >
                  <HiPaperAirplane size={18} style={{ transform: 'rotate(90deg)' }} />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── 3. Bottom Feature Toolbar (Matching Image 1) ── */}
        <div style={{
          background: '#ffffff',
          borderTop: '1px solid #eef2f6',
          padding: '0.625rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
          overflowX: 'auto',
        }}>
          {/* Main feature buttons container */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'nowrap', minWidth: 'max-content' }}>
            
            {/* 1. Mute */}
            <ToolbarBtn
              icon={<HiMicrophone size={19} />}
              label="Mute"
              active={!audioEnabled}
              onClick={handleToggleAudio}
            />

            {/* 2. Turn off camera */}
            <ToolbarBtn
              icon={<HiVideoCamera size={19} />}
              label="Turn off camera"
              active={!videoEnabled}
              onClick={handleToggleVideo}
            />

            {/* 3. Share screen */}
            <ToolbarBtn
              icon={<HiDesktopComputer size={19} />}
              label="Share screen"
              active={isScreenSharing}
              onClick={handleScreenShare}
            />

            {/* 4. Attendees */}
            <ToolbarBtn
              icon={<HiUsers size={19} />}
              label="Attendees"
              active={participantsOpen}
              onClick={() => setParticipantsOpen(!participantsOpen)}
            />

            {/* 5. Record */}
            <ToolbarBtn
              icon={
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid currentColor',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: isRecording ? '2px' : '50%', background: isRecording ? '#ef4444' : 'currentColor' }} />
                </div>
              }
              label={isRecording ? 'Recording...' : 'Record'}
              active={isRecording}
              onClick={handleRecording}
            />

            {/* 6. Notes */}
            <ToolbarBtn
              icon={<HiDocumentText size={19} />}
              label="Notes"
              active={notesOpen}
              onClick={() => setNotesOpen(!notesOpen)}
            />

            {/* 7. Whiteboard */}
            <ToolbarBtn
              icon={<HiPencilAlt size={19} />}
              label="Whiteboard"
              active={whiteboardOpen}
              onClick={() => {
                setWhiteboardOpen(!whiteboardOpen);
                if (!whiteboardOpen) toast('Whiteboard collaboration ready', { icon: '✏️' });
              }}
            />

            {/* 8. Reactions */}
            <div style={{ position: 'relative' }}>
              <ToolbarBtn
                icon={<HiEmojiHappy size={19} />}
                label="Reactions"
                active={showReactions}
                onClick={() => setShowReactions(!showReactions)}
              />

              {showReactions && (
                <div className="vb-card animate-slide-up" style={{
                  position: 'absolute',
                  bottom: '50px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ffffff',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '9999px',
                  display: 'flex',
                  gap: '0.5rem',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                  zIndex: 50,
                }}>
                  {['❤️', '👍', '👏', '🎉', '🔥', '🚀'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        padding: '0.125rem',
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.25)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 9. Chat (Active blue border / highlight in mock) */}
            <ToolbarBtn
              icon={<HiChat size={19} />}
              label="Chat"
              active={chatOpen}
              highlighted={true}
              onClick={() => setChatOpen(!chatOpen)}
            />

            {/* 10. Raise hand */}
            <ToolbarBtn
              icon={<HiHand size={19} />}
              label="Raise hand"
              active={handRaised}
              onClick={handleToggleHandRaise}
            />
          </div>
        </div>

      </div>

      {/* ── Optional Slide-over Notes Drawer ── */}
      {notesOpen && (
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Meeting Notes</h3>
            <button onClick={() => setNotesOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.25rem' }}>✕</button>
          </div>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Jot down notes, decisions, or action items during this call..."
            style={{
              flex: 1,
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
            }}
          />
          <button
            onClick={() => { toast.success('Notes saved to meeting!'); setNotesOpen(false); }}
            className="btn btn-primary"
            style={{ marginTop: '0.75rem' }}
          >
            Save Notes
          </button>
        </div>
      )}

      {/* ── Optional Slide-over Participants Drawer ── */}
      {participantsOpen && (
        <div className="vb-card animate-slide-right" style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          bottom: '2rem',
          width: '320px',
          background: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>Attendees ({displayTiles.length})</h3>
            <button onClick={() => setParticipantsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.25rem' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
            {displayTiles.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '0.5rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: '#2f65f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    {p.userName?.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>{p.userName} {p.isLocal ? '(You)' : ''}</span>
                </div>
                {p.isLocal && isHost && (
                  <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>Host</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

// ── Bottom Toolbar Button Helper Component ──
const ToolbarBtn = ({ icon, label, active, onClick, highlighted }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.25rem',
      background: highlighted && active ? '#eef4ff' : 'transparent',
      border: highlighted && active ? '1px solid #bfdbfe' : '1px solid transparent',
      borderRadius: '0.5rem',
      padding: '0.375rem 0.625rem',
      cursor: 'pointer',
      color: active ? '#2f65f6' : '#64748b',
      transition: 'all 0.15s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = '#2f65f6';
      e.currentTarget.style.background = '#f8fafc';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = active ? '#2f65f6' : '#64748b';
      e.currentTarget.style.background = highlighted && active ? '#eef4ff' : 'transparent';
    }}
  >
    <div style={{ color: active ? '#2f65f6' : '#64748b' }}>
      {icon}
    </div>
    <span style={{ fontSize: '0.6875rem', fontWeight: active ? 600 : 500, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  </button>
);

export default MeetingPage;
