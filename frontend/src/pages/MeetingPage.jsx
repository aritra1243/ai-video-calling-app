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

  // Load meeting info
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

  // Set local video
  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for chat & recording signals
  useEffect(() => {
    if (!socket) return;
    const handleChat = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on('chat-message', handleChat);

    socket.on('recording-started', ({ userName }) => {
      toast(`🔴 ${userName} started recording`, { icon: '⏺️' });
    });
    socket.on('recording-stopped', ({ userName }) => {
      toast(`${userName} stopped recording`, { icon: '⏹️' });
    });

    return () => {
      socket.off('chat-message', handleChat);
      socket.off('recording-started');
      socket.off('recording-stopped');
    };
  }, [socket]);

  // Handle recording blob upload
  useEffect(() => {
    if (recordingBlob && meeting) {
      const uploadRecording = async () => {
        try {
          toast.loading('Uploading recording file to storage...', { id: 'upload' });
          await meetingService.uploadRecording(meeting._id || roomId, recordingBlob);
          toast.success('Recording saved! Transcribe & Summarize available in details.', { id: 'upload' });
        } catch (err) {
          toast.error('Failed to upload recording', { id: 'upload' });
        }
      };
      uploadRecording();
    }
  }, [recordingBlob]);

  // Join meeting
  const handleJoin = async () => {
    try {
      const mediaStream = await startMedia(true, true);

      try {
        const data = await meetingService.join(roomId);
        setMeeting(data.meeting);
      } catch (e) {
        // Fallback for standalone link join
      }

      if (socket) {
        socket.emit('join-room', { roomId, userName: user?.name });
      }

      setJoined(true);
      toast.success('Connected to meeting!');
    } catch (err) {
      toast.error('Failed to access camera/microphone. Please verify browser permissions.');
    }
  };

  // Leave meeting
  const handleLeave = () => {
    if (isRecording) stopRecording();
    stopMedia();
    if (socket) {
      socket.emit('leave-room', { roomId });
    }
    navigate('/dashboard');
  };

  // Toggle audio
  const handleToggleAudio = () => {
    const enabled = toggleAudio();
    if (socket) {
      socket.emit('toggle-media', { roomId, type: 'audio', enabled });
    }
  };

  // Toggle video
  const handleToggleVideo = () => {
    const enabled = toggleVideo();
    if (socket) {
      socket.emit('toggle-media', { roomId, type: 'video', enabled });
    }
  };

  // Screen share
  const handleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      if (streamRef.current) {
        const cameraTrack = streamRef.current.getVideoTracks()[0];
        if (cameraTrack) {
          replaceTrack(cameraTrack, null);
        }
      }
      socket?.emit('screen-share-stopped', { roomId });
    } else {
      try {
        const displayStream = await startScreenShare();
        const screenTrack = displayStream.getVideoTracks()[0];
        const cameraTrack = streamRef.current?.getVideoTracks()[0];
        if (screenTrack) {
          replaceTrack(screenTrack, cameraTrack);
        }
        socket?.emit('screen-share-started', { roomId });

        screenTrack.addEventListener('ended', () => {
          if (cameraTrack) {
            replaceTrack(cameraTrack, screenTrack);
          }
          socket?.emit('screen-share-stopped', { roomId });
        });
      } catch (err) {
        // User cancelled screen share selection
      }
    }
  };

  // Recording
  const handleRecording = () => {
    if (isRecording) {
      stopRecording();
      socket?.emit('recording-stopped', { roomId });
    } else {
      if (stream) {
        startRecording(stream);
        socket?.emit('recording-started', { roomId });
        toast.success('Recording started');
      }
    }
  };

  const copyLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    toast.success('Meeting link copied!');
  };

  // Send chat message
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

  // Combine local and remote video streams
  const allStreams = [];
  if (stream) {
    allStreams.push({ id: 'local', stream, userName: user?.name || 'You', isLocal: true });
  }
  remoteStreams.forEach((data, socketId) => {
    allStreams.push({ id: socketId, stream: data.stream, userName: data.userName, isLocal: false });
  });

  const gridCols = allStreams.length <= 1 ? 1 : allStreams.length <= 4 ? 2 : 3;

  // ─── Lobby Screen ──────────────────────────────────────────
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
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: '520px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {meeting?.title || 'Join Call'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Room ID: <span style={{ fontFamily: 'monospace', color: 'var(--color-accent-light)' }}>{roomId}</span>
          </p>

          {/* Video Preview */}
          <div className="glass-card" style={{
            width: '100%',
            aspectRatio: '16/9',
            marginBottom: '1.5rem',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
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
              }}
            />
            {!stream && (
              <div style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <HiVideoCamera size={48} style={{ color: 'var(--color-text-muted)' }} />
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                  Camera preview will activate when you join
                </p>
              </div>
            )}
          </div>

          {/* Media Toggles */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <button
              className={`btn-icon ${audioEnabled ? '' : 'danger'}`}
              onClick={handleToggleAudio}
              style={{ cursor: 'pointer', padding: '0.875rem' }}
              title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
            >
              <HiMicrophone size={20} />
            </button>
            <button
              className={`btn-icon ${videoEnabled ? '' : 'danger'}`}
              onClick={handleToggleVideo}
              style={{ cursor: 'pointer', padding: '0.875rem' }}
              title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              <HiVideoCamera size={20} />
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleJoin}
            style={{ padding: '0.875rem 3rem', fontSize: '1rem', width: '100%' }}
          >
            Join Meeting Room
          </button>
        </div>
      </div>
    );
  }

  // ─── Meeting Room Screen ───────────────────────────────────
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg-primary)',
      overflow: 'hidden',
    }}>
      {/* Top Bar */}
      <div style={{
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)',
        background: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(20px)',
      }}>
        <div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
            {meeting?.title || 'Corporate Meeting'}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            Room: <span style={{ fontFamily: 'monospace' }}>{roomId}</span> · {allStreams.length} participant{allStreams.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={copyLink} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>
            <HiClipboardCopy size={14} />
            Copy Link
          </button>

          {isRecording && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.75rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-danger)',
            }}>
              <div style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                background: 'var(--color-danger)',
                animation: 'recording-pulse 1.5s infinite',
              }} />
              REC {formatTime(recordingTime)}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid & Side Panels */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* Video Grid */}
        <div style={{
          flex: 1,
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          gap: '0.75rem',
          alignContent: 'center',
        }}>
          {allStreams.map(({ id, stream: s, userName, isLocal }) => (
            <VideoTile
              key={id}
              stream={s}
              userName={userName}
              isLocal={isLocal}
              muted={isLocal}
            />
          ))}
        </div>

        {/* Participants Panel */}
        {participantsOpen && (
          <div className="animate-slide-right" style={{
            width: '300px',
            borderLeft: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-secondary)',
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--color-border)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}>
              Participants ({allStreams.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allStreams.map((p, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0284c7, #3b82f6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'white',
                  }}>
                    {p.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.userName} {p.isLocal ? '(You)' : ''}
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>
                    {p.isLocal ? 'Host' : 'Peer'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Panel */}
        {chatOpen && (
          <div className="animate-slide-right" style={{
            width: '320px',
            borderLeft: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-secondary)',
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid var(--color-border)',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}>
              Meeting Chat
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              {messages.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '2rem 0' }}>
                  No messages sent yet
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-message ${msg.senderId === user?._id ? 'own' : ''}`}
                >
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-accent-light)', marginBottom: '0.25rem' }}>
                    {msg.senderName}
                  </div>
                  <div style={{ fontSize: '0.8125rem' }}>{msg.message}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} style={{
              padding: '0.75rem',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              gap: '0.5rem',
            }}>
              <input
                className="input"
                placeholder="Send message to meeting..."
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

      {/* Controls Bar */}
      <div style={{
        padding: '1rem',
        display: 'flex',
        justifyContent: 'center',
        borderTop: '1px solid var(--color-border)',
        background: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(20px)',
      }}>
        <div className="controls-bar">
          <button
            className={`btn-icon ${!audioEnabled ? 'danger' : ''}`}
            onClick={handleToggleAudio}
            title={audioEnabled ? 'Mute' : 'Unmute'}
            style={{ cursor: 'pointer' }}
          >
            <HiMicrophone size={20} />
          </button>

          <button
            className={`btn-icon ${!videoEnabled ? 'danger' : ''}`}
            onClick={handleToggleVideo}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            style={{ cursor: 'pointer' }}
          >
            <HiVideoCamera size={20} />
          </button>

          <button
            className={`btn-icon ${isScreenSharing ? 'active' : ''}`}
            onClick={handleScreenShare}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            style={{ cursor: 'pointer' }}
          >
            <HiDesktopComputer size={20} />
          </button>

          <button
            className={`btn-icon ${participantsOpen ? 'active' : ''}`}
            onClick={() => {
              setParticipantsOpen(!participantsOpen);
              if (chatOpen) setChatOpen(false);
            }}
            title="Participants"
            style={{ cursor: 'pointer' }}
          >
            <HiUsers size={20} />
          </button>

          <button
            className={`btn-icon ${chatOpen ? 'active' : ''}`}
            onClick={() => {
              setChatOpen(!chatOpen);
              if (participantsOpen) setParticipantsOpen(false);
            }}
            title="Chat"
            style={{ cursor: 'pointer' }}
          >
            <HiChat size={20} />
          </button>

          <button
            className={`btn-icon ${isRecording ? 'danger' : ''}`}
            onClick={handleRecording}
            title={isRecording ? 'Stop recording' : 'Start recording'}
            style={{ cursor: 'pointer' }}
          >
            <div style={{
              width: '14px',
              height: '14px',
              borderRadius: isRecording ? '3px' : '50%',
              background: isRecording ? 'var(--color-danger)' : '#ef4444',
              transition: 'all 0.2s ease',
            }} />
          </button>

          <div style={{ width: '1px', height: '24px', background: 'var(--color-border-light)', margin: '0 0.25rem' }} />

          <button
            className="btn-icon danger"
            onClick={handleLeave}
            title="Leave call"
            style={{ cursor: 'pointer', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)' }}
          >
            <HiPhone size={20} style={{ transform: 'rotate(135deg)' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Video Tile Subcomponent ───────────────────────────────
const VideoTile = ({ stream, userName, isLocal, muted }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-container" style={{
      aspectRatio: '16/9',
      maxHeight: '100%',
    }}>
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
        }}
      />
      <div className="video-label">
        {userName} {isLocal ? '(You)' : ''}
      </div>
    </div>
  );
};

export default MeetingPage;
