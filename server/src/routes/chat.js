const express = require('express');
const Message = require('../models/Message');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get chat history for a room
router.get('/:roomId', optionalAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { type = 'group', limit = 100 } = req.query;

    let query = { roomId, type };

    // For private messages, only show those involving the user
    if (type === 'private' && req.user) {
      query = {
        roomId,
        type: 'private',
        $or: [
          { sender: req.user._id },
          { recipient: req.user._id }
        ]
      };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'name')
      .populate('recipient', 'name');

    res.json({ messages: messages.reverse() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

module.exports = router;
