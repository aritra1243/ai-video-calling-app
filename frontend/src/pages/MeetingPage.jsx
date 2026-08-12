import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { meetingService } from '../services/meetingService';
import useMediaStream from '../hooks/useMediaStream';
import useWebRTC from '../hooks/useWebRTC';
import useRecording from '../hooks/useRecording';
import {
  HiMicrophone, HiVideoCamera, HiDesktopComputer,
  HiChat, HiPhone, HiUsers, HiClipboardCopy,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const MeetingPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  // State
  const [meeting, setMeeting] = useState(null);
  const [joined, setJoined] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
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
    startRecording, stopRecording, formatTime,
  } = useRecording();

  // ── Derive if current user is the host ──────────────────────
  const isHost = meeting
    ? (meeting.hostId?._id || meeting.hostId)?.toString() === user?._id?.toString()
    : false;

  // ── Load meeting info ────────────────────────────────────────
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const data = await meetingService.getById(roomId);
        setMeeting(data.meeting);
      } catch (err) {
        setMeeting({ roomId, title: 'Corporate Video Sync' });
      } finally {
        setLoading(false);
      }
    };
    loadMeeting();
  }, [roomId]);

  // ── Start camera preview immediately in lobby ────────────────
  useEffect(() => {
    if (!loading && !joined && !previewStarted) {
      const startPreview = async () => {
        try {
          await startMedia(true, true);
          setPreviewStarted(true);
        } catch {
          // Permissions denied or no camera
          setPreviewError(true);
          setPreviewStarted(true);
        }
      };
      startPreview();
    }
    // Cleanup preview if user navigates away from lobby without joining
    return () => {
      if (!joined) {
        // stopMedia is called on leave, not here — stream carries into meeting
      }
    };
  }, [loading, joined]);

  // ── Set local video whenever stream changes ──────────────────
  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // ── Auto-scroll chat ─────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Socket event listeners ───────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleChat = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleMeetingEnded = ({ hostName }) => {
      toast(`🛑 ${hostName} ended the meeting`, { icon: '📋', duration: 3000 });
      stopMedia();
      navigate('/dashboard');
    };

    socket.on('chat-message', handleChat);
    socket.on('meeting-ended', handleMeetingEnded);

    socket.on('recording-started', ({ userName }) => {
      toast(`🔴 ${userName} started recording`, { icon: '⏺️' });
    });
    socket.on('recording-stopped', ({ userName }) => {
      toast(`${userName} stopped recording`, { icon: '⏹️' });
    });

    return () => {
      socket.off('chat-message', handleChat);
      socket.off('meeting-ended', handleMeetingEnded);
      socket.off('recording-started');
      socket.off('recording-stopped');
    };
  }, [socket]);

  // ── Join meeting (stream is already running from preview) ────
  const handleJoin = async () => {
    try {
      // If preview failed, try starting media now
      if (!stream) {
        await startMedia(true, true);
      }

      try {
        const data = await meetingService.join(roomId);
        setMeeting(data.meeting);
      } catch {
        // Fallback for standalone join
      }

      if (socket) {
        socket.emit('join-room', { roomId, userName: user?.name, userId: user?._id });
      }

      setJoined(true);
      toast.success('Connected to meeting!');
    } catch {
      toast.error('Failed to access camera/microphone. Please verify browser permissions.');
    }
  };

  // ── Helper to ensure recording is fully saved & uploaded ────────
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
        console.error('Recording upload failed:', err);
        toast.error(err.response?.data?.message || 'Failed to upload recording', { id: 'upload' });
      }
    }
  };

  // ── Leave meeting (participant only) ─────────────────────────
  const handleLeave = async () => {
    await ensureRecordingUploaded();
    stopMedia();
    if (socket) socket.emit('leave-room', { roomId });
    navigate('/dashboard');
  };

  // ── End meeting (host only) ──────────────────────────────────
  const handleEndMeeting = async () => {
    if (!window.confirm('End this meeting for everyone?')) return;
    setEnding(true);
    try {
      // 1. Ensure any active/pending recording is fully uploaded
      await ensureRecordingUploaded();

      // 2. Update meeting status in DB
      await meetingService.end(meeting?._id || roomId);

      // 3. Broadcast to all participants via socket
      if (socket) socket.emit('host-end-meeting', { roomId });

      // 4. Cleanup media & navigate
      stopMedia();
      toast.success('Meeting ended');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end meeting');
      setEnding(false);
    }
  };

  // ── Toggle audio ─────────────────────────────────────────────
  const handleToggleAudio = () => {
    const enabled = toggleAudio();
    if (joined && socket) {
      socket.emit('toggle-media', { roomId, type: 'audio', enabled });
    }
  };

  // ── Toggle video ─────────────────────────────────────────────
  const handleToggleVideo = () => {
    const enabled = toggleVideo();
    if (joined && socket) {
      socket.emit('toggle-media', { roomId, type: 'video', enabled });
    }
  };

  // ── Screen share ─────────────────────────────────────────────
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
        // User cancelled
      }
    }
  };

  // ── Recording ────────────────────────────────────────────────
  const handleRecording = async () => {
    if (isRecording) {
      toast.loading('Saving recording...', { id: 'upload' });
      const blob = await stopRecording();
      socket?.emit('recording-stopped', { roomId });
      if (blob) {
        try {
          const targetId = meeting?._id || roomId;
          await meetingService.uploadRecording(targetId, blob);
          toast.success('Recording saved successfully!', { id: 'upload' });
        } catch (err) {
          console.error('Recording upload error:', err?.response?.data || err);
          toast.error(err?.response?.data?.message || 'Failed to upload recording', { id: 'upload' });
        }
      }
    } else {
      if (stream) {
        startRecording(stream);
        socket?.emit('recording-started', { roomId });
        toast.success('Recording started');
      }
    }
  };


  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Meeting link copied!');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !socket) return;
    socket.emit('chat-message', {
      roomId,
      message: messageInput.trim(),
      meetingId: meeting?._id,
    });
    setMessageInput('');
  };

  // Combine local + remote streams
  const allStreams = [];
  if (stream) {
    allStreams.push({ id: 'local', stream, userName: user?.name || 'You', isLocal: true });
  }
  remoteStreams.forEach((data, socketId) => {
    allStreams.push({ id: socketId, stream: data.stream, userName: data.userName, isLocal: false });
  });
  const gridCols = allStreams.length <= 1 ? 1 : allStreams.length <= 4 ? 2 : 3;

  // ═══════════════════════════════════════════════════════════
  // LOBBY SCREEN
  // ═══════════════════════════════════════════════════════════
  if (!joined) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'var(--color-bg-primary)',
      }}>
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: '560px', textAlign: 'center' }}>
          {/* Title */}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.375rem' }}>
            {meeting?.title || 'Join Call'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
            Room ID: <span style={{ fontFamily: 'monospace', color: 'var(--color-accent-light)' }}>{roomId}</span>
            {isHost && (
              <span style={{
                marginLeft: '0.75rem', fontSize: '0.6875rem', fontWeight: 700,
                background: 'rgba(2,132,199,0.15)', color: '#38bdf8',
                padding: '0.125rem 0.625rem', borderRadius: '9999px',
                border: '1px solid rgba(56,189,248,0.25)',
              }}>
                👑 Host
              </span>
            )}
          </p>

          {/* Camera Preview */}
          <div className="glass-card" style={{
            width: '100%', aspectRatio: '16/9', marginBottom: '1rem',
            overflow: 'hidden', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,10,15,0.9)',
          }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: videoEnabled && stream ? 'block' : 'none',
              }}
            />

            {/* Camera off / no stream overlay */}
            {(!stream || !videoEnabled) && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              }}>
                {/* Avatar circle */}
                <div style={{
                  width: '5rem', height: '5rem', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', fontWeight: 700, color: 'white',
                  boxShadow: '0 0 30px rgba(2,132,199,0.4)',
                }}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
                  {previewError ? 'Camera unavailable' : !stream ? 'Starting camera...' : 'Camera is off'}
                </p>
              </div>
            )}

            {/* Mic/Cam status badges */}
            <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              {!audioEnabled && (
                <div style={{
                  padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.6875rem',
                  background: 'rgba(239,68,68,0.8)', color: 'white', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                }}>
                  🔇 Muted
                </div>
              )}
              {!videoEnabled && stream && (
                <div style={{
                  padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.6875rem',
                  background: 'rgba(239,68,68,0.8)', color: 'white', fontWeight: 600,
                }}>
                  📷 Off
                </div>
              )}
            </div>
          </div>

          {/* Mic & Camera toggle buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
            {/* Mic button */}
            <button
              onClick={handleToggleAudio}
              disabled={!stream}
              title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem',
                padding: '0', background: 'transparent', border: 'none', cursor: stream ? 'pointer' : 'not-allowed',
                opacity: stream ? 1 : 0.4,
              }}
            >
              <div style={{
                width: '3.5rem', height: '3.5rem', borderRadius: '50%',
                background: audioEnabled ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(239,68,68,0.2)',
                border: audioEnabled ? '2px solid rgba(56,189,248,0.4)' : '2px solid rgba(239,68,68,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: audioEnabled ? '0 0 20px rgba(2,132,199,0.3)' : '0 0 15px rgba(239,68,68,0.2)',
              }}>
                <HiMicrophone size={22} color={audioEnabled ? 'white' : '#ef4444'} />
              </div>
              <span style={{ fontSize: '0.75rem', color: audioEnabled ? 'var(--color-text-secondary)' : '#ef4444', fontWeight: 500 }}>
                {audioEnabled ? 'Mic On' : 'Mic Off'}
              </span>
            </button>

            {/* Camera button */}
            <button
              onClick={handleToggleVideo}
              disabled={!stream}
              title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem',
                padding: '0', background: 'transparent', border: 'none', cursor: stream ? 'pointer' : 'not-allowed',
                opacity: stream ? 1 : 0.4,
              }}
            >
              <div style={{
                width: '3.5rem', height: '3.5rem', borderRadius: '50%',
                background: videoEnabled ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'rgba(239,68,68,0.2)',
                border: videoEnabled ? '2px solid rgba(56,189,248,0.4)' : '2px solid rgba(239,68,68,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: videoEnabled ? '0 0 20px rgba(2,132,199,0.3)' : '0 0 15px rgba(239,68,68,0.2)',
              }}>
                <HiVideoCamera size={22} color={videoEnabled ? 'white' : '#ef4444'} />
              </div>
              <span style={{ fontSize: '0.75rem', color: videoEnabled ? 'var(--color-text-secondary)' : '#ef4444', fontWeight: 500 }}>
                {videoEnabled ? 'Cam On' : 'Cam Off'}
              </span>
            </button>
          </div>

          {/* Join button */}
          <button
            className="btn btn-primary"
            onClick={handleJoin}
            style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: 600 }}
          >
            Join Meeting Room
          </button>

          {loading && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Loading meeting info...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MEETING ROOM SCREEN
  // ═══════════════════════════════════════════════════════════
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg-primary)', overflow: 'hidden',
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        padding: '0.75rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)',
        background: 'rgba(10, 10, 15, 0.8)', backdropFilter: 'blur(20px)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
              {meeting?.title || 'Corporate Meeting'}
            </h2>
            {isHost && (
              <span style={{
                fontSize: '0.625rem', fontWeight: 700,
                background: 'rgba(2,132,199,0.15)', color: '#38bdf8',
                padding: '0.125rem 0.5rem', borderRadius: '9999px',
                border: '1px solid rgba(56,189,248,0.2)',
              }}>
                👑 HOST
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            Room: <span style={{ fontFamily: 'monospace' }}>{roomId}</span> · {allStreams.length} participant{allStreams.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={copyLink} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
            <HiClipboardCopy size={14} /> Copy Link
          </button>
          {isRecording && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 0.75rem',
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-danger)',
            }}>
              <div style={{
                width: '0.5rem', height: '0.5rem', borderRadius: '50%',
                background: 'var(--color-danger)', animation: 'recording-pulse 1.5s infinite',
              }} />
              REC {formatTime(recordingTime)}
            </div>
          )}
        </div>
      </div>

      {/* ── Main: Video Grid + Side Panels ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Video Grid */}
        <div style={{
          flex: 1, padding: '1rem',
          display: allStreams.length === 1 ? 'flex' : 'grid',
          alignItems: allStreams.length === 1 ? 'center' : 'stretch',
          justifyContent: allStreams.length === 1 ? 'center' : 'stretch',
          gridTemplateColumns: allStreams.length === 2
            ? 'repeat(auto-fit, minmax(320px, 1fr))'
            : allStreams.length <= 4
            ? 'repeat(2, 1fr)'
            : 'repeat(auto-fit, minmax(280px, 1fr))',
          gridTemplateRows: allStreams.length <= 2
            ? '1fr'
            : allStreams.length <= 4
            ? 'repeat(2, 1fr)'
            : 'auto',
          gap: '0.875rem',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}>
          {allStreams.map(({ id, stream: s, userName, isLocal }) => (
            <VideoTile
              key={id}
              stream={s}
              userName={userName}
              isLocal={isLocal}
              muted={isLocal}
              isHost={isLocal && isHost}
              isSingle={allStreams.length === 1}
            />
          ))}
        </div>

        {/* Participants Panel */}
        {participantsOpen && (
          <div className="animate-slide-right" style={{
            width: '300px', borderLeft: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', background: 'var(--color-bg-secondary)',
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.875rem' }}>
              Participants ({allStreams.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allStreams.map((p, i) => {
                const participantIsHost = p.isLocal ? isHost : false;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.625rem', borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
                  }}>
                    <div style={{
                      width: '2rem', height: '2rem', borderRadius: '50%',
                      background: participantIsHost ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #0284c7, #3b82f6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, color: 'white',
                    }}>
                      {p.userName?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.userName} {p.isLocal ? '(You)' : ''}
                      </div>
                    </div>
                    <span className={participantIsHost ? 'badge badge-warning' : 'badge badge-info'} style={{ fontSize: '0.625rem' }}>
                      {participantIsHost ? '👑 Host' : 'Member'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {chatOpen && (
          <div className="animate-slide-right" style={{
            width: '320px', borderLeft: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', background: 'var(--color-bg-secondary)',
          }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: '0.875rem' }}>
              Meeting Chat
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '2rem 0' }}>
                  No messages yet
                </p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.senderId === user?._id ? 'own' : ''}`}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-accent-light)', marginBottom: '0.25rem' }}>
                    {msg.senderName}
                  </div>
                  <div style={{ fontSize: '0.8125rem' }}>{msg.message}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                placeholder="Send message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                style={{ fontSize: '0.8125rem' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Controls Bar ── */}
      <div style={{
        padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: '0.75rem', flexWrap: 'wrap',
        borderTop: '1px solid var(--color-border)',
        background: 'rgba(10, 10, 15, 0.9)', backdropFilter: 'blur(20px)',
      }}>
        {/* Mic */}
        <ControlBtn
          active={audioEnabled}
          onClick={handleToggleAudio}
          title={audioEnabled ? 'Mute' : 'Unmute'}
          icon={<HiMicrophone size={20} />}
          danger={!audioEnabled}
        />
        {/* Camera */}
        <ControlBtn
          active={videoEnabled}
          onClick={handleToggleVideo}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          icon={<HiVideoCamera size={20} />}
          danger={!videoEnabled}
        />
        {/* Screen share */}
        <ControlBtn
          active={isScreenSharing}
          onClick={handleScreenShare}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          icon={<HiDesktopComputer size={20} />}
        />
        {/* Participants */}
        <ControlBtn
          active={participantsOpen}
          onClick={() => { setParticipantsOpen(!participantsOpen); if (chatOpen) setChatOpen(false); }}
          title="Participants"
          icon={<HiUsers size={20} />}
        />
        {/* Chat */}
        <ControlBtn
          active={chatOpen}
          onClick={() => { setChatOpen(!chatOpen); if (participantsOpen) setParticipantsOpen(false); }}
          title="Chat"
          icon={<HiChat size={20} />}
        />
        {/* Record */}
        <button
          className={`btn-icon ${isRecording ? 'danger' : ''}`}
          onClick={handleRecording}
          title={isRecording ? 'Stop recording' : 'Start recording'}
          style={{ cursor: 'pointer' }}
        >
          <div style={{
            width: '14px', height: '14px',
            borderRadius: isRecording ? '3px' : '50%',
            background: '#ef4444', transition: 'all 0.2s ease',
          }} />
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '28px', background: 'var(--color-border-light)' }} />

        {/* ── HOST: End Meeting button ── */}
        {isHost && (
          <button
            onClick={handleEndMeeting}
            disabled={ending}
            title="End meeting for everyone"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444', fontWeight: 700, fontSize: '0.8125rem',
              cursor: ending ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
          >
            {ending
              ? <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px', borderTopColor: '#ef4444' }} />
              : <HiPhone size={16} style={{ transform: 'rotate(135deg)' }} />
            }
            End Meeting
          </button>
        )}

        {/* ── ALL: Leave button ── */}
        <button
          onClick={handleLeave}
          title={isHost ? 'Leave (meeting stays active)' : 'Leave call'}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: isHost ? 'var(--color-bg-elevated)' : 'rgba(239, 68, 68, 0.15)',
            border: isHost ? '1px solid var(--color-border)' : '1px solid rgba(239, 68, 68, 0.4)',
            color: isHost ? 'var(--color-text-secondary)' : '#ef4444',
            fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <HiPhone size={16} style={{ transform: 'rotate(135deg)' }} />
          {isHost ? 'Leave' : 'Leave Call'}
        </button>
      </div>
    </div>
  );
};

// ── Control Button helper ──────────────────────────────────────
const ControlBtn = ({ active, onClick, title, icon, danger }) => (
  <button
    className={`btn-icon ${danger ? 'danger' : active ? 'active' : ''}`}
    onClick={onClick}
    title={title}
    style={{ cursor: 'pointer' }}
  >
    {icon}
  </button>
);

// ── Video Tile ────────────────────────────────────────────────
const VideoTile = ({ stream, userName, isLocal, muted, isHost, isSingle }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className="video-tile-wrapper"
      style={{
        width: '100%',
        height: '100%',
        maxHeight: isSingle ? 'calc(100vh - 160px)' : '100%',
        maxWidth: isSingle ? '1100px' : '100%',
        margin: '0 auto',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        borderRadius: '1rem',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isLocal ? 'scaleX(-1)' : 'none',
          background: '#000',
        }}
      />
      <div
        className="video-label"
        style={{
          position: 'absolute',
          bottom: '0.875rem',
          left: '0.875rem',
          background: 'rgba(10, 13, 20, 0.8)',
          backdropFilter: 'blur(12px)',
          padding: '0.375rem 0.875rem',
          borderRadius: '9999px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {isHost && <span title="Host">👑</span>}
        {userName} {isLocal ? '(You)' : ''}
      </div>
    </div>
  );
};


export default MeetingPage;
