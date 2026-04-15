function registerDisconnectHandlers({ io, socket, state, helpers }) {
    const { activeUsers, waitingUsers, socketRateLimits } = state;
    const { handleLeave } = helpers;

    // ==================== DISCONNECT ====================
    socket.on('disconnect', async () => {
        const userData = activeUsers.get(socket.id);
        if (userData) {
            await handleLeave(socket, io, userData.roomId, userData.userId, userData.userName);
            activeUsers.delete(socket.id);
        }

        // Clean up waiting users if they disconnect before being approved
        for (const [roomId, queue] of waitingUsers.entries()) {
            const index = queue.findIndex(u => u.socketId === socket.id);
            if (index !== -1) {
                const entry = queue[index];
                waitingUsers.set(roomId, queue.filter(u => u.socketId !== socket.id));
                io.to(roomId).emit('room:knock-cancelled', { userId: entry.userId });
                break;
            }
        }
        // Clean up rate limit entries for this socket
        for (const key of socketRateLimits.keys()) {
            if (key.startsWith(socket.id)) {
                socketRateLimits.delete(key);
            }
        }
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
}

module.exports = { registerDisconnectHandlers };
