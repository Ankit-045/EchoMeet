const Message = require('../../models/Message');

async function getChatHistory({ roomId, type = 'group', limit = 100, user }) {
    let query = { roomId, type };

    if (type === 'private' && user) {
        query = {
            roomId,
            type: 'private',
            $or: [
                { sender: user._id },
                { recipient: user._id }
            ]
        };
    }

    const messages = await Message.find(query)
        .select('roomId sender senderName content type recipient recipientName timestamp')
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .populate('sender', 'name')
        .populate('recipient', 'name')
        .lean();

    return { messages: messages.reverse() };
}

module.exports = { getChatHistory };
