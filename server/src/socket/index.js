const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Attendance = require('../models/Attendance');
const Room = require('../models/Room');

// Server-side ObjectId validation
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

// In-memory stores for real-time state
const handRaiseQueues = new Map(); // roomId -> [{userId, userName, timestamp}]
const activeUsers = new Map(); // socketId -> {userId, userName, roomId}

// Simple socket-level rate limiter for high-frequency events
const socketRateLimits = new Map(); // socketId -> { event: lastTimestamp }
function isRateLimited(socketId, event, minIntervalMs = 50) {
  const key = `${socketId}:${event}`;
  const now = Date.now();
  const last = socketRateLimits.get(key) || 0;
  if (now - last < minIntervalMs) return true;
  socketRateLimits.set(key, now);
  return false;
}

// Payload validation helpers
function validateString(val, maxLen = 500) {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

function validateRoomId(val) {
  return typeof val === 'string' && val.length >= 4 && val.length <= 20;
}

function setupSocketHandlers(io) {
  // ==================== SOCKET AUTHENTICATION ====================
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      // Allow unauthenticated connections but mark them
      socket.userData = { authenticated: false };
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userData = { authenticated: true, userId: decoded.id };
      next();
    } catch (err) {
      // Allow connection but mark as unauthenticated (guest flow)
      socket.userData = { authenticated: false };
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (auth: ${socket.userData?.authenticated})`);

    // ==================== ROOM JOIN/LEAVE ====================
    socket.on('room:join', async (data) => {
      if (!data || !validateRoomId(data.roomId) || !validateString(data.userId, 100)) return;
      const { roomId, userId, userName = 'Anonymous' } = data;

      const isGuestUser = !isValidObjectId(userId);

      socket.join(roomId);
      activeUsers.set(socket.id, { userId, userName, roomId, isGuest: isGuestUser });

      // Create attendance record
      try {
        // Look up room name for the attendance record
        let roomName = '';
        try {
          const room = await Room.findOne({ roomId }, 'name').lean();
          roomName = room?.name || '';
        } catch (_) { }

        const attendance = new Attendance({
          roomId,
          roomName,
          userName: String(userName).slice(0, 50),
          user: isGuestUser ? undefined : userId,
          isGuest: isGuestUser,
          joinTime: new Date(),
          status: 'present'
        });
        await attendance.save();
        socket.attendanceId = attendance._id;
      } catch (err) {
        console.error('Attendance create error:', err);
      }

      // Notify room
      io.to(roomId).emit('room:user-joined', {
        userId,
        userName: String(userName).slice(0, 50),
        socketId: socket.id,
        timestamp: new Date()
      });

      // Send current hand raise queue
      const queue = handRaiseQueues.get(roomId) || [];
      socket.emit('hand-raise:queue', queue);

      // Send participant count
      const roomSockets = await io.in(roomId).allSockets();
      io.to(roomId).emit('room:participant-count', roomSockets.size);
    });

    socket.on('room:leave', async (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      const { roomId, userId, userName } = data;
      await handleLeave(socket, io, roomId, userId, userName);
    });

    // ==================== CHAT ====================
    socket.on('chat:send', async (data) => {
      if (!data || !validateRoomId(data.roomId) || !validateString(data.content, 2000)) return;
      const { roomId, content, senderName = 'Anonymous', senderId, type = 'group', recipientId, recipientName } = data;

      // Validate type enum
      if (!['group', 'private'].includes(type)) return;

      try {
        // For guest senders, don't set the ObjectId `sender` field
        const isGuestSender = !isValidObjectId(senderId);

        const message = new Message({
          roomId,
          sender: isGuestSender ? undefined : senderId,
          senderName: String(senderName).slice(0, 50),
          content: String(content).slice(0, 2000),
          type,
          recipient: (type === 'private' && isValidObjectId(recipientId)) ? recipientId : undefined,
          recipientName: type === 'private' ? String(recipientName || '').slice(0, 50) : undefined,
          timestamp: new Date()
        });
        await message.save();

        const msgData = {
          _id: message._id,
          roomId,
          senderName: message.senderName,
          senderId,
          content: message.content,
          type,
          recipientId,
          recipientName,
          timestamp: message.timestamp
        };

        if (type === 'private') {
          const recipientSocket = findSocketByUserId(recipientId);
          socket.emit('chat:message', msgData);
          if (recipientSocket) {
            recipientSocket.emit('chat:message', msgData);
          }
        } else {
          io.to(roomId).emit('chat:message', msgData);
        }
      } catch (err) {
        console.error('Chat error:', err);
        socket.emit('chat:error', { error: 'Failed to send message' });
      }
    });

    // ==================== HAND RAISE ====================
    socket.on('hand-raise:raise', (data) => {
      if (!data || !validateRoomId(data.roomId) || !validateString(data.userId, 100)) return;
      const { roomId, userId, userName = 'Anonymous' } = data;

      if (!handRaiseQueues.has(roomId)) {
        handRaiseQueues.set(roomId, []);
      }
      const queue = handRaiseQueues.get(roomId);

      if (!queue.find(h => h.userId === userId)) {
        queue.push({ userId, userName: String(userName).slice(0, 50), timestamp: new Date(), socketId: socket.id });
        handRaiseQueues.set(roomId, queue);
      }

      io.to(roomId).emit('hand-raise:queue', queue);
    });

    socket.on('hand-raise:lower', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      const { roomId, userId } = data;
      if (handRaiseQueues.has(roomId)) {
        const queue = handRaiseQueues.get(roomId).filter(h => h.userId !== userId);
        handRaiseQueues.set(roomId, queue);
        io.to(roomId).emit('hand-raise:queue', queue);
      }
    });

    socket.on('hand-raise:acknowledge', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      const { roomId, userId } = data;
      if (handRaiseQueues.has(roomId)) {
        const queue = handRaiseQueues.get(roomId).filter(h => h.userId !== userId);
        handRaiseQueues.set(roomId, queue);
        io.to(roomId).emit('hand-raise:queue', queue);
        io.to(roomId).emit('hand-raise:acknowledged', { userId });
      }
    });

    // ==================== SCREEN SHARE ====================
    socket.on('screen-share:request', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      const { roomId, userId, userName } = data;
      io.to(roomId).emit('screen-share:request', { userId, userName });
    });

    socket.on('screen-share:approve', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      io.to(data.roomId).emit('screen-share:approved', { userId: data.userId });
    });

    socket.on('screen-share:deny', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      io.to(data.roomId).emit('screen-share:denied', { userId: data.userId });
    });

    socket.on('screen-share:started', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      io.to(data.roomId).emit('screen-share:active', { userId: data.userId, userName: data.userName });
    });

    socket.on('screen-share:stopped', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      io.to(data.roomId).emit('screen-share:inactive', { userId: data.userId });
    });

    // ==================== AIR DRAWING ====================
    socket.on('drawing:data', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      // Rate limit drawing events (max ~20/sec per socket)
      if (isRateLimited(socket.id, 'drawing', 50)) return;
      socket.to(data.roomId).emit('drawing:data', {
        points: data.points,
        color: data.color,
        thickness: data.thickness,
        userId: data.userId
      });
    });

    socket.on('drawing:clear', (data) => {
      if (!data || !validateRoomId(data.roomId)) return;
      socket.to(data.roomId).emit('drawing:clear', { userId: data.userId });
    });

    // ==================== TRANSCRIPT ====================
    socket.on('transcript:chunk', (data) => {
      if (!data || !validateRoomId(data.roomId) || !validateString(data.text, 5000)) return;
      io.to(data.roomId).emit('transcript:chunk', {
        text: String(data.text).slice(0, 5000),
        speaker: String(data.speaker || 'Unknown').slice(0, 50),
        timestamp: new Date()
      });
    });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', async () => {
      const userData = activeUsers.get(socket.id);
      if (userData) {
        await handleLeave(socket, io, userData.roomId, userData.userId, userData.userName);
        activeUsers.delete(socket.id);
      }
      // Clean up rate limit entries for this socket
      for (const key of socketRateLimits.keys()) {
        if (key.startsWith(socket.id)) {
          socketRateLimits.delete(key);
        }
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  // ==================== PERIODIC CLEANUP ====================
  // Clean up stale activeUsers entries and hand raise queues every 60 seconds
  setInterval(async () => {
    // Clean hand raise queues for rooms with no sockets
    for (const [roomId, queue] of handRaiseQueues.entries()) {
      try {
        const sockets = await io.in(roomId).allSockets();
        if (sockets.size === 0) {
          handRaiseQueues.delete(roomId);
        }
      } catch (_) {
        handRaiseQueues.delete(roomId);
      }
    }

    // Clean stale rate limit entries (older than 10 seconds)
    const now = Date.now();
    for (const [key, timestamp] of socketRateLimits.entries()) {
      if (now - timestamp > 10000) {
        socketRateLimits.delete(key);
      }
    }
  }, 60000);

  // Helper: find socket by user ID
  function findSocketByUserId(userId) {
    for (const [socketId, data] of activeUsers) {
      if (data.userId === userId) {
        return io.sockets.sockets.get(socketId);
      }
    }
    return null;
  }

  // Helper: handle user leaving
  async function handleLeave(socket, io, roomId, userId, userName) {
    socket.leave(roomId);

    // Update attendance
    if (socket.attendanceId) {
      try {
        const attendance = await Attendance.findById(socket.attendanceId);
        if (attendance) {
          attendance.leaveTime = new Date();
          attendance.duration = Math.floor((attendance.leaveTime - attendance.joinTime) / 1000);

          const THRESHOLD_SECONDS = 300;
          if (attendance.duration >= THRESHOLD_SECONDS) {
            attendance.status = 'present';
          } else if (attendance.duration >= THRESHOLD_SECONDS / 2) {
            attendance.status = 'partial';
          } else {
            attendance.status = 'absent';
          }

          await attendance.save();
        }
      } catch (err) {
        console.error('Attendance update error:', err);
      }
    }

    // Update room participant status — only for real users
    if (isValidObjectId(userId)) {
      try {
        await Room.updateOne(
          { roomId, 'participants.user': userId, 'participants.isActive': true },
          {
            $set: {
              'participants.$.isActive': false,
              'participants.$.leftAt': new Date()
            }
          }
        );
      } catch (err) {
        console.error('Room participant update error:', err);
      }
    }

    // Remove from hand raise queue
    if (handRaiseQueues.has(roomId)) {
      const queue = handRaiseQueues.get(roomId).filter(h => h.userId !== userId);
      handRaiseQueues.set(roomId, queue);
      io.to(roomId).emit('hand-raise:queue', queue);
    }

    // Notify room
    io.to(roomId).emit('room:user-left', { userId, userName, timestamp: new Date() });

    // Update participant count
    const roomSockets = await io.in(roomId).allSockets();
    io.to(roomId).emit('room:participant-count', roomSockets.size);
  }
}

module.exports = setupSocketHandlers;
