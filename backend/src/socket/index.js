const jwt = require('jsonwebtoken');
const config = require('../config/config');
const Message = require('../models/Message');
const DirectMessage = require('../models/DirectMessage');

// Track active rooms and participants
const rooms = new Map();
// Track active room recordings (roomId -> { isRecording: boolean, hostName: string, startedAt: number })
const roomRecordings = new Map();

const setupSocket = (io) => {
  // Socket.IO authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.userId;
      socket.userName = socket.handshake.auth.userName || 'Anonymous';
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userName} (${socket.id})`);

    // Join personal user room for direct messages & instant notifications
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // ─── Room Management ───────────────────────────────────────
    socket.on('join-room', ({ roomId, userName }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = userName || socket.userName;

      // Track participants in room
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      rooms.get(roomId).set(socket.id, {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.userName,
      });

      // Notify others in the room
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.userName,
      });

      // Send current participants to the new user
      const participants = Array.from(rooms.get(roomId).values())
        .filter((p) => p.socketId !== socket.id);
      socket.emit('room-participants', participants);

      // If room is actively being recorded, notify the newly joined participant
      if (roomRecordings.has(roomId)) {
        const recordingState = roomRecordings.get(roomId);
        socket.emit('recording-status', {
          isRecording: true,
          hostName: recordingState.hostName,
          startedAt: recordingState.startedAt,
        });
      }

      console.log(`👤 ${socket.userName} joined room ${roomId}`);
    });

    // ─── Host: End Meeting for Everyone ───────────────────────
    socket.on('host-end-meeting', ({ roomId }) => {
      console.log(`🛑 Host ${socket.userName} ended meeting in room ${roomId}`);
      // Clean up room recording state
      roomRecordings.delete(roomId);

      // Broadcast to ALL sockets in the room (including sender)
      io.to(roomId).emit('meeting-ended', {
        hostName: socket.userName,
      });
      // Clean up room tracking
      if (rooms.has(roomId)) {
        rooms.delete(roomId);
      }
    });

    // ─── WebRTC Signaling ──────────────────────────────────────
    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', {
        from: socket.id,
        userName: socket.userName,
        offer,
      });
    });

    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', {
        from: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', {
        from: socket.id,
        candidate,
      });
    });

    // ─── Media Controls ────────────────────────────────────────
    socket.on('toggle-media', ({ roomId, type, enabled }) => {
      socket.to(roomId).emit('user-toggle-media', {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.userName,
        type, // 'audio' or 'video'
        enabled,
      });
    });

    socket.on('screen-share-started', ({ roomId }) => {
      socket.to(roomId).emit('user-screen-share-started', {
        socketId: socket.id,
        userName: socket.userName,
      });
    });

    socket.on('screen-share-stopped', ({ roomId }) => {
      socket.to(roomId).emit('user-screen-share-stopped', {
        socketId: socket.id,
        userName: socket.userName,
      });
    });

    // ─── Chat ──────────────────────────────────────────────────
    socket.on('chat-message', async ({ roomId, message, meetingId }) => {
      const chatMsg = {
        senderId: socket.userId,
        senderName: socket.userName,
        message,
        timestamp: new Date(),
      };

      // Broadcast to room
      io.to(roomId).emit('chat-message', chatMsg);

      // Save to database if meetingId provided
      if (meetingId) {
        try {
          await Message.create({
            meetingId,
            senderId: socket.userId,
            senderName: socket.userName,
            message,
          });
        } catch (err) {
          console.error('Failed to save chat message:', err.message);
        }
      }
    });

    // ─── Real-Time 1-on-1 Direct Messaging ────────────────────
    socket.on('direct-message', async ({ receiverId, message }) => {
      if (!receiverId || !message || !message.trim()) return;
      try {
        const dm = await DirectMessage.create({
          senderId: socket.userId,
          receiverId,
          senderName: socket.userName,
          message: message.trim(),
        });
        const payload = {
          _id: dm._id,
          senderId: socket.userId,
          receiverId,
          senderName: socket.userName,
          message: dm.message,
          createdAt: dm.createdAt,
        };
        // Emit to recipient's private user room
        io.to(`user:${receiverId}`).emit('direct-message', payload);
        // Emit back to sender
        socket.emit('direct-message', payload);
      } catch (err) {
        console.error('Failed to send direct message via socket:', err.message);
      }
    });

    // ─── Recording Signals ─────────────────────────────────────
    socket.on('recording-started', ({ roomId }) => {
      const startedAt = Date.now();
      roomRecordings.set(roomId, {
        isRecording: true,
        hostName: socket.userName,
        startedAt,
      });
      socket.to(roomId).emit('recording-started', {
        userName: socket.userName,
        startedAt,
      });
    });

    socket.on('recording-stopped', ({ roomId }) => {
      roomRecordings.delete(roomId);
      socket.to(roomId).emit('recording-stopped', {
        userName: socket.userName,
      });
    });

    // ─── Disconnect ────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${socket.userName} (${socket.id})`);

      if (socket.roomId && rooms.has(socket.roomId)) {
        rooms.get(socket.roomId).delete(socket.id);

        // Notify others
        socket.to(socket.roomId).emit('user-left', {
          socketId: socket.id,
          userId: socket.userId,
          userName: socket.userName,
        });

        // Clean up empty rooms
        if (rooms.get(socket.roomId).size === 0) {
          rooms.delete(socket.roomId);
          roomRecordings.delete(socket.roomId);
        }
      }
    });
  });
};

module.exports = setupSocket;
