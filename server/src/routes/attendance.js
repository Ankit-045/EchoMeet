const express = require('express');
const { auth } = require('../middleware/auth');
const { getMyAttendance, getRoomAttendance } = require('../modules/attendance/AttendanceController');

const router = express.Router();

// Get all attendance for current user — MUST be before /:roomId
router.get('/my/history', auth, getMyAttendance);

// Get attendance for a room
router.get('/:roomId', auth, getRoomAttendance);

module.exports = router;
