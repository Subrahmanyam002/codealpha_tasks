// ===================================
// LUMINA MEET - NODE.JS BACKEND
// Real-Time Communication Server with Security
// ===================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Security imports
const authRoutes = require('./auth-routes');
const {
  encryptMessage,
  decryptMessage,
  socketAuthMiddleware,
  logSecurityEvent
} = require('./auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Add authentication middleware
  // See socketAuthMiddleware in auth.js for strict auth
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication API Routes
app.use('/api/auth', authRoutes);

// ===================================
// SOCKET.IO REAL-TIME COMMUNICATION
// ===================================

// Store active rooms and participants
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // User joins a meeting room
  socket.on('join-meeting', (data) => {
    const { roomId, userName, userId } = data;
    
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: [],
        createdAt: new Date()
      });
    }

    const room = rooms.get(roomId);
    const participant = {
      id: userId,
      socketId: socket.id,
      name: userName,
      muted: false,
      videoOn: true,
      screenSharing: false
    };

    room.participants.push(participant);

    // Notify all users in room about new participant
    io.to(roomId).emit('user-joined', {
      participant,
      totalParticipants: room.participants.length
    });

    console.log(`👤 ${userName} joined room ${roomId}`);
  });

  // WebRTC Signaling - Offer
  socket.on('webrtc-offer', (data) => {
    const { roomId, targetSocketId, offer } = data;
    io.to(targetSocketId).emit('webrtc-offer', {
      offer,
      fromSocketId: socket.id
    });
  });

  // WebRTC Signaling - Answer
  socket.on('webrtc-answer', (data) => {
    const { roomId, targetSocketId, answer } = data;
    io.to(targetSocketId).emit('webrtc-answer', {
      answer,
      fromSocketId: socket.id
    });
  });

  // ICE Candidates for NAT traversal
  socket.on('ice-candidate', (data) => {
    const { roomId, targetSocketId, candidate } = data;
    io.to(targetSocketId).emit('ice-candidate', {
      candidate,
      fromSocketId: socket.id
    });
  });

  // Mic toggle
  socket.on('toggle-mic', (data) => {
    const { roomId, userId, muted } = data;
    const room = rooms.get(roomId);
    if (room) {
      const participant = room.participants.find(p => p.id === userId);
      if (participant) {
        participant.muted = muted;
        io.to(roomId).emit('participant-updated', {
          userId,
          muted,
          videoOn: participant.videoOn
        });
      }
    }
  });

  // Video toggle
  socket.on('toggle-video', (data) => {
    const { roomId, userId, videoOn } = data;
    const room = rooms.get(roomId);
    if (room) {
      const participant = room.participants.find(p => p.id === userId);
      if (participant) {
        participant.videoOn = videoOn;
        io.to(roomId).emit('participant-updated', {
          userId,
          muted: participant.muted,
          videoOn
        });
      }
    }
  });

  // Chat messages
  socket.on('send-message', (data) => {
    const { roomId, userName, message, timestamp } = data;
    
    // Encrypt the message for secure transmission
    const encryptedMessage = encryptMessage(message, userName);
    
    // Broadcast encrypted message to all in room
    io.to(roomId).emit('receive-message', {
      userName,
      encryptedMessage,
      timestamp,
      encrypted: true
    });
    
    // Log security event
    logSecurityEvent('message-sent', socket.id, {
      roomId,
      messageLength: message.length
    });
    
    console.log(`💬 [${roomId}] ${userName}: [ENCRYPTED MESSAGE]`);
  });

  // Whiteboard drawing sync
  socket.on('draw', (data) => {
    const { roomId, ...drawData } = data;
    socket.to(roomId).emit('remote-draw', drawData);
  });

  // Clear whiteboard
  socket.on('clear-whiteboard', (data) => {
    io.to(data.roomId).emit('whiteboard-cleared');
  });

  // Screen sharing
  socket.on('start-screen-share', (data) => {
    const { roomId, userId } = data;
    io.to(roomId).emit('screen-share-started', { userId });
    console.log(`🖥️ Screen share started by ${userId}`);
  });

  socket.on('stop-screen-share', (data) => {
    const { roomId, userId } = data;
    io.to(roomId).emit('screen-share-stopped', { userId });
    console.log(`🖥️ Screen share stopped by ${userId}`);
  });

  // File sharing
  socket.on('share-file', (data) => {
    const { roomId, fileName, fileSize, fileType } = data;
    io.to(roomId).emit('file-shared', {
      fileName,
      fileSize,
      fileType,
      sharedBy: socket.id,
      timestamp: new Date()
    });
  });

  // Get room info
  socket.on('get-room-info', (roomId) => {
    const room = rooms.get(roomId);
    socket.emit('room-info', room ? room.participants : []);
  });

  // User leaves
  socket.on('leave-meeting', (data) => {
    const { roomId, userId } = data;
    const room = rooms.get(roomId);
    
    if (room) {
      room.participants = room.participants.filter(p => p.id !== userId);
      io.to(roomId).emit('user-left', {
        userId,
        totalParticipants: room.participants.length
      });

      // Clean up empty rooms
      if (room.participants.length === 0) {
        rooms.delete(roomId);
      }
    }
    
    socket.leave(roomId);
    console.log(`👋 User ${userId} left room ${roomId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    
    // Remove from all rooms
    for (let [roomId, room] of rooms.entries()) {
      room.participants = room.participants.filter(p => p.socketId !== socket.id);
      if (room.participants.length === 0) {
        rooms.delete(roomId);
      }
    }
  });
});

// ===================================
// API ENDPOINTS
// ===================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running ✅', timestamp: new Date() });
});

// Create new room
app.post('/api/create-room', (req, res) => {
  const roomId = 'LUM-' + Math.floor(10000 + Math.random() * 90000);
  res.json({ roomId, joinUrl: `http://localhost:3000?room=${roomId}` });
});

// Get active rooms
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    roomId: id,
    participantCount: room.participants.length,
    createdAt: room.createdAt
  }));
  res.json(roomList);
});

// ===================================
// ERROR HANDLING
// ===================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ===================================
// SERVER START
// ===================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🎉 LUMINA MEET SERVER RUNNING            ║
║   http://localhost:${PORT}                      ║
║   WebRTC + Socket.io + Express             ║
║   Real-Time Communication Ready ✅         ║
╚════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
