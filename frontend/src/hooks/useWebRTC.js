import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const useWebRTC = (socket, localStream, roomId) => {
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const peerConnections = useRef(new Map());
  const pendingCandidates = useRef(new Map());

  const createPeerConnection = useCallback((socketId, userName) => {
    if (peerConnections.current.has(socketId)) {
      return peerConnections.current.get(socketId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => {
        const updated = new Map(prev);
        updated.set(socketId, { stream: remoteStream, userName });
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

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handlePeerDisconnect(socketId);
      }
    };

    peerConnections.current.set(socketId, pc);
    return pc;
  }, [localStream, socket]);

  const handlePeerDisconnect = useCallback((socketId) => {
    const pc = peerConnections.current.get(socketId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(socketId);
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
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { to: socketId, offer });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [createPeerConnection, socket]);

  const handleOffer = useCallback(async (data) => {
    const { from, offer, userName } = data;
    const pc = createPeerConnection(from, userName);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Apply any pending ICE candidates
      const pending = pendingCandidates.current.get(from) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current.delete(from);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [createPeerConnection, socket]);

  const handleAnswer = useCallback(async (data) => {
    const { from, answer } = data;
    const pc = peerConnections.current.get(from);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Apply any pending ICE candidates
        const pending = pendingCandidates.current.get(from) || [];
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.current.delete(from);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }, []);

  const handleIceCandidate = useCallback(async (data) => {
    const { from, candidate } = data;
    const pc = peerConnections.current.get(from);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    } else {
      // Queue candidate if remote description not yet set
      if (!pendingCandidates.current.has(from)) {
        pendingCandidates.current.set(from, []);
      }
      pendingCandidates.current.get(from).push(candidate);
    }
  }, []);

  // Replace video track for screen sharing
  const replaceTrack = useCallback((newTrack, oldTrack) => {
    peerConnections.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track === oldTrack);
      if (sender) {
        sender.replaceTrack(newTrack);
      }
    });
  }, []);

  // Setup socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('room-participants', (existingParticipants) => {
      setParticipants(existingParticipants);
      // Create offers to all existing participants
      existingParticipants.forEach((p) => {
        createOffer(p.socketId, p.userName);
      });
    });

    socket.on('user-joined', (userData) => {
      setParticipants((prev) => [...prev, userData]);
      // The new user will create an offer to us
    });

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);

    socket.on('user-left', (userData) => {
      handlePeerDisconnect(userData.socketId);
    });

    return () => {
      socket.off('room-participants');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
    };
  }, [socket, createOffer, handleOffer, handleAnswer, handleIceCandidate, handlePeerDisconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
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
