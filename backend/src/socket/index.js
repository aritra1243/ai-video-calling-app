const jwt = require('jsonwebtoken');
const config = require('../config/config');
const Message = require('../models/Message');

// Track active rooms and participants
const rooms = new Map();

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

      console.log(`👤 ${socket.userName} joined room ${roomId}`);
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

    // ─── Recording Signals ─────────────────────────────────────
    socket.on('recording-started', ({ roomId }) => {
      socket.to(roomId).emit('recording-started', {
        userName: socket.userName,
      });
    });

    socket.on('recording-stopped', ({ roomId }) => {
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
        }
      }
    });
  });
};

module.exports = setupSocket;
