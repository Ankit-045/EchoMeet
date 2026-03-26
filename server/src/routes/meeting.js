const express = require('express');
const Room = require('../models/Room');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user's meetings
router.get('/my-meetings', auth, async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [
        { host: req.user._id },
        { 'participants.user': req.user._id }
      ]
    })
      .populate('host', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ meetings: rooms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// Get active meetings
router.get('/active', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true })
      .populate('host', 'name email')
      .sort({ startedAt: -1 });

    res.json({ meetings: rooms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active meetings' });
  }
});

module.exports = router;
