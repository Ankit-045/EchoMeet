const express = require('express');
const Attendance = require('../models/Attendance');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all attendance for current user — MUST be before /:roomId
router.get('/my/history', auth, async (req, res) => {
  try {
    const attendance = await Attendance.find({ user: req.user._id })
      .sort({ meetingDate: -1 })
      .limit(50);

    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

// Get attendance for a room
router.get('/:roomId', auth, async (req, res) => {
  try {
    const attendance = await Attendance.find({ roomId: req.params.roomId })
      .populate('user', 'name email')
      .sort({ joinTime: 1 });

    const stats = {
      totalParticipants: attendance.length,
      present: attendance.filter(a => a.status === 'present').length,
      partial: attendance.filter(a => a.status === 'partial').length,
      absent: attendance.filter(a => a.status === 'absent').length,
      averageDuration: attendance.length > 0
        ? Math.round(attendance.reduce((sum, a) => sum + a.duration, 0) / attendance.length)
        : 0
    };

    res.json({ attendance, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

module.exports = router;
