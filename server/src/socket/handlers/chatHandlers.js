function registerChatHandlers({ io, socket, helpers, models }) {
    const { Message } = models;
    const { validateRoomId, validateString, isValidObjectId, findSocketByUserId } = helpers;

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
}

module.exports = { registerChatHandlers };
