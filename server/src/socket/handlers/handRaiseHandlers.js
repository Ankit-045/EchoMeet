function registerHandRaiseHandlers({ io, socket, state, helpers }) {
    const { handRaiseQueues } = state;
    const { validateRoomId, validateString } = helpers;

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
}

module.exports = { registerHandRaiseHandlers };
