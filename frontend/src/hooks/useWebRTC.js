import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

const useWebRTC = (socket, localStream, roomId) => {
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);

  const peerConnections = useRef(new Map());
  const pendingCandidates = useRef(new Map());
  const localStreamRef = useRef(localStream);
  const offerTimeoutRef = useRef(new Map());

  // Keep localStreamRef synced
  useEffect(() => {
    localStreamRef.current = localStream;
    // Update existing peer connections if new local tracks are added
    if (localStream) {
      peerConnections.current.forEach((pc) => {
        const senders = pc.getSenders();
        localStream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(() => {});
          } else {
            try {
              pc.addTrack(track, localStream);
            } catch (e) {}
          }
        });
      });
    }
  }, [localStream]);

  // Create or retrieve an RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback((socketId, userName) => {
    if (peerConnections.current.has(socketId)) {
      const existingPc = peerConnections.current.get(socketId);
      if (existingPc.signalingState !== 'closed') {
        return existingPc;
      }
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Attach local tracks immediately
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, currentStream);
        } catch (e) {
          console.warn(`[WebRTC] Error adding local track to peer ${socketId}:`, e);
        }
      });
    }

    // Handle incoming remote media tracks
    pc.ontrack = (event) => {
      console.log(`📡 [WebRTC] Received remote ${event.track.kind} track from ${userName || socketId}`);
      
      const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);

      event.track.onunmute = () => {
        setRemoteStreams((prev) => {
          const updated = new Map(prev);
          const current = updated.get(socketId);
          if (current) {
            updated.set(socketId, { stream: current.stream, userName: userName || current.userName });
          }
          return updated;
        });
      };

      setRemoteStreams((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(socketId);

        if (existing && existing.stream) {
          // If stream exists, ensure this track is in it
          if (!existing.stream.getTracks().some((t) => t.id === event.track.id)) {
            existing.stream.addTrack(event.track);
          }
          updated.set(socketId, { stream: existing.stream, userName: userName || existing.userName });
        } else {
          updated.set(socketId, { stream: incomingStream, userName: userName || 'Participant' });
        }
        return updated;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          to: socketId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state with ${socketId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        handlePeerDisconnect(socketId);
      }
    };

    peerConnections.current.set(socketId, pc);
    return pc;
  }, [socket]);

  const handlePeerDisconnect = useCallback((socketId) => {
    const pc = peerConnections.current.get(socketId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      peerConnections.current.delete(socketId);
    }
    pendingCandidates.current.delete(socketId);
    if (offerTimeoutRef.current.has(socketId)) {
      clearTimeout(offerTimeoutRef.current.get(socketId));
      offerTimeoutRef.current.delete(socketId);
    }

    setRemoteStreams((prev) => {
      const updated = new Map(prev);
      updated.delete(socketId);
      return updated;
    });
    setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  const createOffer = useCallback(async (socketId, userName) => {
    const pc = createPeerConnection(socketId, userName);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('offer', { to: socketId, offer, userName: socket.userName });
      }
    } catch (error) {
      console.error(`[WebRTC] Error creating offer for ${socketId}:`, error);
    }
  }, [createPeerConnection, socket]);

  const handleOffer = useCallback(async (data) => {
    const { from, offer, userName } = data;
    const pc = createPeerConnection(from, userName);
    try {
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
        console.warn(`[WebRTC] Signaling state is ${pc.signalingState}, rolling back before handling offer`);
        await Promise.all([
          pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
        ]);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush any queued ICE candidates for this peer
      const pending = pendingCandidates.current.get(from) || [];
      for (const candidate of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] Error adding queued ICE candidate:', e);
        }
      }
      pendingCandidates.current.delete(from);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('answer', { to: from, answer, userName: socket.userName });
      }
    } catch (error) {
      console.error(`[WebRTC] Error handling offer from ${from}:`, error);
    }
  }, [createPeerConnection, socket]);

  const handleAnswer = useCallback(async (data) => {
    const { from, answer } = data;
    const pc = peerConnections.current.get(from);
    if (pc) {
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));

          // Flush any queued ICE candidates
          const pending = pendingCandidates.current.get(from) || [];
          for (const candidate of pending) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('[WebRTC] Error adding queued ICE candidate after answer:', e);
            }
          }
          pendingCandidates.current.delete(from);
        }
      } catch (error) {
        console.error(`[WebRTC] Error handling answer from ${from}:`, error);
      }
    }
  }, []);

  const handleIceCandidate = useCallback(async (data) => {
    const { from, candidate } = data;
    if (!candidate) return;

    const pc = peerConnections.current.get(from);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error(`[WebRTC] Error adding ICE candidate from ${from}:`, error);
      }
    } else {
      // Queue candidate until remote description is set
      if (!pendingCandidates.current.has(from)) {
        pendingCandidates.current.set(from, []);
      }
      pendingCandidates.current.get(from).push(candidate);
    }
  }, []);

  // Replace video track for screen sharing or camera toggle
  const replaceTrack = useCallback((newTrack, oldTrack) => {
    peerConnections.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track === oldTrack || (s.track && s.track.kind === 'video'));
      if (sender && newTrack) {
        sender.replaceTrack(newTrack).catch((err) => console.warn('[WebRTC] replaceTrack error:', err));
      }
    });
  }, []);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    // When joining an existing room, receive list of active participants and send offers
    const onRoomParticipants = (existingParticipants) => {
      console.log('👥 [WebRTC] Active room participants received:', existingParticipants);
      setParticipants(existingParticipants);
      existingParticipants.forEach((p) => {
        createOffer(p.socketId, p.userName);
      });
    };

    // When a new user joins the room while we are already in the call
    const onUserJoined = (userData) => {
      console.log(`👤 [WebRTC] New user joined room: ${userData.userName} (${userData.socketId})`);
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === userData.socketId)) return prev;
        return [...prev, userData];
      });

      // Prepare peer connection immediately
      createPeerConnection(userData.socketId, userData.userName);

      // Fallback handshake: If no offer arrives from the new user within 1.5s, host/existing peer creates offer
      if (offerTimeoutRef.current.has(userData.socketId)) {
        clearTimeout(offerTimeoutRef.current.get(userData.socketId));
      }
      const timer = setTimeout(() => {
        const pc = peerConnections.current.get(userData.socketId);
        if (pc && !pc.remoteDescription) {
          console.log(`⚡ [WebRTC] Initiating fallback offer to ${userData.userName}`);
          createOffer(userData.socketId, userData.userName);
        }
      }, 1500);
      offerTimeoutRef.current.set(userData.socketId, timer);
    };

    socket.on('room-participants', onRoomParticipants);
    socket.on('user-joined', onUserJoined);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', (userData) => {
      handlePeerDisconnect(userData.socketId);
    });

    return () => {
      socket.off('room-participants', onRoomParticipants);
      socket.off('user-joined', onUserJoined);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left');
    };
  }, [socket, createOffer, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, handlePeerDisconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      offerTimeoutRef.current.forEach((t) => clearTimeout(t));
      offerTimeoutRef.current.clear();
    };
  }, []);

  return {
    remoteStreams,
    participants,
    replaceTrack,
    peerConnections,
  };
};

export default useWebRTC;
