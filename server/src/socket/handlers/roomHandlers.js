function registerRoomHandlers({ io, socket, state, helpers, models }) {
    const { Room } = models;
    const { validateRoomId, validateString, isValidObjectId, handleLeave, attendanceService } = helpers;
    const { handRaiseQueues, activeUsers, waitingUsers } = state;

    // ==================== ROOM JOIN/LEAVE ====================
    socket.on('room:join', async (data) => {
        if (!data || !validateRoomId(data.roomId) || !validateString(data.userId, 100)) return;
        const { roomId, userId, userName = 'Anonymous' } = data;

        const isGuestUser = !isValidObjectId(userId);

        socket.join(roomId);
        activeUsers.set(socket.id, { userId, userName, roomId, isGuest: isGuestUser });

        const userNameSafe = String(userName).slice(0, 50);

        // Track attendance sessions in modular service off the hot path
        setImmediate(async () => {
            try {
                await attendanceService.onUserJoined({
                    meetingId: roomId,
                    userId,
                    userName: userNameSafe,
                });
            } catch (err) {
                console.error('Attendance join tracking error:', err);
            }
        });

        // Notify room
        io.to(roomId).emit('room:user-joined', {
            userId,
            userName: userNameSafe,
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

    // ==================== WAITING ROOM (KNOCKING) ====================
    socket.on('room:knock', async (data) => {
        if (!data || !validateRoomId(data.roomId) || !validateString(data.userId, 100)) return;
        const { roomId, userId, userName = 'Guest' } = data;

        socket.join(`waiting:${roomId}`);

        if (!waitingUsers.has(roomId)) waitingUsers.set(roomId, []);
        const queue = waitingUsers.get(roomId);
        if (!queue.find(u => u.userId === userId)) {
            queue.push({ socketId: socket.id, userId, userName, requestedAt: new Date() });
        }

        // Notify host in the main room
        console.log(`🛎️  User ${userName} (${userId}) is knocking for room: ${roomId}`);
        io.to(roomId).emit('room:request-entry', { userId, userName, socketId: socket.id });
    });

    socket.on('room:approve-entry', async (data) => {
        if (!data || !validateRoomId(data.roomId)) return;
        const { roomId, userId, socketId } = data;

        try {
            await Room.updateOne(
                { roomId },
                { $addToSet: { 'settings.approvedParticipants': userId } }
            );

            if (socketId) {
                console.log(`✅ Approving entry for user ${userId} in room ${roomId}`);
                io.to(socketId).emit('room:entry-granted', { roomId });
            }

            if (waitingUsers.has(roomId)) {
                const queue = waitingUsers.get(roomId).filter(u => u.userId !== userId);
                waitingUsers.set(roomId, queue);
            }
        } catch (err) {
            console.error('Approve entry error:', err);
        }
    });

    socket.on('room:deny-entry', (data) => {
        if (!data || !validateRoomId(data.roomId)) return;
        const { roomId, userId, socketId } = data;

        if (socketId) {
            io.to(socketId).emit('room:entry-denied', { roomId });
        }

        if (waitingUsers.has(roomId)) {
            const queue = waitingUsers.get(roomId).filter(u => u.userId !== userId);
            waitingUsers.set(roomId, queue);
        }
    });

    socket.on('room:get-waiting-list', (data) => {
        if (!data || !validateRoomId(data.roomId)) return;
        const list = waitingUsers.get(data.roomId) || [];
        socket.emit('room:waiting-list', list);
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
}

module.exports = { registerRoomHandlers };
