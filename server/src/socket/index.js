const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Room = require('../models/Room');
const attendanceService = require('../modules/attendance/AttendanceService');
const { validateString, validateRoomId, isValidObjectId } = require('../lib/validation/common');
const { registerRoomHandlers } = require('./handlers/roomHandlers');
const { registerChatHandlers } = require('./handlers/chatHandlers');
const { registerHandRaiseHandlers } = require('./handlers/handRaiseHandlers');
const { registerDrawingHandlers } = require('./handlers/drawingHandlers');
const { registerTranscriptHandlers } = require('./handlers/transcriptHandlers');
const { registerDisconnectHandlers } = require('./handlers/disconnectHandlers');

// In-memory stores for real-time state
const handRaiseQueues = new Map(); // roomId -> [{userId, userName, timestamp}]
const activeUsers = new Map(); // socketId -> {userId, userName, roomId}
const waitingUsers = new Map(); // roomId -> [{socketId, userId, userName}]
const roomDrawingStates = new Map(); // roomId -> Map(strokeId -> stroke)

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

function setupSocketHandlers(io) {
  io.meetingPresence = { activeUsers };

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
    const state = { handRaiseQueues, activeUsers, waitingUsers, socketRateLimits, roomDrawingStates };
    const helpers = {
      validateString,
      validateRoomId,
      isValidObjectId,
      isRateLimited,
      handleLeave,
      findSocketByUserId,
      attendanceService,
    };
    const models = { Room, Message };

    registerRoomHandlers({ io, socket, state, helpers, models });
    registerChatHandlers({ io, socket, helpers, models });
    registerHandRaiseHandlers({ io, socket, state, helpers });
    registerDrawingHandlers({ io, socket, state, helpers });
    registerTranscriptHandlers({ io, socket, helpers });
    registerDisconnectHandlers({ io, socket, state, helpers });
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

    // Clean drawing state for empty rooms
    for (const [roomId] of roomDrawingStates.entries()) {
      try {
        const sockets = await io.in(roomId).allSockets();
        if (sockets.size === 0) {
          roomDrawingStates.delete(roomId);
        }
      } catch (_) {
        roomDrawingStates.delete(roomId);
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

    // Track leave in session-based attendance service.
    try {
      await attendanceService.onUserLeft({
        meetingId: roomId,
        userId,
      });
    } catch (err) {
      console.error('Attendance leave tracking error:', err);
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
