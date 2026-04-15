const chatService = require('./chat.service');

async function getChatHistory(req, res) {
    try {
        const { roomId } = req.params;
        const { type = 'group', limit = 100 } = req.query;
        const data = await chatService.getChatHistory({ roomId, type, limit, user: req.user });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
}

module.exports = { getChatHistory };
