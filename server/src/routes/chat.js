const express = require('express');
const { auth, optionalAuth } = require('../middleware/auth');
const { getChatHistory } = require('../modules/chat/chat.controller');

const router = express.Router();

// Get chat history for a room
router.get('/:roomId', optionalAuth, getChatHistory);

module.exports = router;
