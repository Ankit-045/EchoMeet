const mongoose = require('mongoose');
const Message = require('../models/Message');
const Attendance = require('../models/Attendance');
const Room = require('../models/Room');

// Server-side ObjectId validation — never trust client's isGuest flag
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

// In-memory stores for real-time state
const handRaiseQueues = new Map(); // roomId -> [{userId, userName, timestamp}]
const activeUsers = new Map(); // socketId -> {userId, userName, roomId}

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ==================== ROOM JOIN/LEAVE ====================
    socket.on('room:join', async (data) => {
      const { roomId, userId, userName } = data;

      // Determine guest status by validating userId format on the server.
      // Never trust the client's isGuest flag — it can be undefined.
      const isGuestUser = !isValidObjectId(userId);

      socket.join(roomId);
      activeUsers.set(socket.id, { userId, userName, roomId, isGuest: isGuestUser });

      // Create attendance record
      try {
        const attendance = new Attendance({
          roomId,
          userName,
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
        userName,
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
      const { roomId, userId, userName } = data;
      await handleLeave(socket, io, roomId, userId, userName);
    });

    // ==================== CHAT ====================
    socket.on('chat:send', async (data) => {
      const { roomId, content, senderName, senderId, type = 'group', recipientId, recipientName } = data;

      try {
        const message = new Message({
          roomId,
          sender: senderId,
          senderName,
          content,
          type,
          recipient: type === 'private' ? recipientId : undefined,
          recipientName: type === 'private' ? recipientName : undefined,
          timestamp: new Date()
        });
        await message.save();

        const msgData = {
          _id: message._id,
          roomId,
          senderName,
          senderId,
          content,
          type,
          recipientId,
          recipientName,
          timestamp: message.timestamp
        };

        if (type === 'private') {
          // Send to sender and recipient only
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
      const { roomId, userId, userName } = data;
      if (!handRaiseQueues.has(roomId)) {
        handRaiseQueues.set(roomId, []);
      }
      const queue = handRaiseQueues.get(roomId);

      // Prevent duplicate raises
      if (!queue.find(h => h.userId === userId)) {
        queue.push({ userId, userName, timestamp: new Date(), socketId: socket.id });
        handRaiseQueues.set(roomId, queue);
      }

      io.to(roomId).emit('hand-raise:queue', queue);
    });

    socket.on('hand-raise:lower', (data) => {
      const { roomId, userId } = data;
      if (handRaiseQueues.has(roomId)) {
        const queue = handRaiseQueues.get(roomId).filter(h => h.userId !== userId);
        handRaiseQueues.set(roomId, queue);
        io.to(roomId).emit('hand-raise:queue', queue);
      }
    });

    socket.on('hand-raise:acknowledge', (data) => {
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
      const { roomId, userId, userName } = data;
      // Forward request to host
      io.to(roomId).emit('screen-share:request', { userId, userName });
    });

    socket.on('screen-share:approve', (data) => {
      const { roomId, userId } = data;
      io.to(roomId).emit('screen-share:approved', { userId });
    });

    socket.on('screen-share:deny', (data) => {
      const { roomId, userId } = data;
      io.to(roomId).emit('screen-share:denied', { userId });
    });

    socket.on('screen-share:started', (data) => {
      const { roomId, userId, userName } = data;
      io.to(roomId).emit('screen-share:active', { userId, userName });
    });

    socket.on('screen-share:stopped', (data) => {
      const { roomId, userId } = data;
      io.to(roomId).emit('screen-share:inactive', { userId });
    });

    // ==================== AIR DRAWING ====================
    socket.on('drawing:data', (data) => {
      const { roomId, points, color, thickness } = data;
      // Broadcast drawing data to all other participants
      socket.to(roomId).emit('drawing:data', { points, color, thickness, userId: data.userId });
    });

    socket.on('drawing:clear', (data) => {
      const { roomId } = data;
      socket.to(roomId).emit('drawing:clear', { userId: data.userId });
    });

    // ==================== TRANSCRIPT ====================
    socket.on('transcript:chunk', (data) => {
      const { roomId, text, speaker } = data;
      io.to(roomId).emit('transcript:chunk', { text, speaker, timestamp: new Date() });
    });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', async () => {
      const userData = activeUsers.get(socket.id);
      if (userData) {
        await handleLeave(socket, io, userData.roomId, userData.userId, userData.userName);
        activeUsers.delete(socket.id);
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

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

          // Mark status based on duration threshold (5 minutes minimum)
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

    // Update room participant status — only for real users (valid ObjectId)
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
