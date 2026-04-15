const express = require('express');
const { auth } = require('../middleware/auth');
const {
  createMeeting,
  getMyMeetings,
  deleteMeeting,
  getActiveMeetings,
} = require('../modules/meetings/meeting.controller');

const router = express.Router();

// Create scheduled meeting
router.post('/', auth, createMeeting);

// Get user's meetings (Scheduled + History)
router.get('/my-meetings', auth, getMyMeetings);

// Delete/Cancel scheduled meeting
router.delete('/:id', auth, deleteMeeting);

// Get active meetings (Global/Admin view maybe)
router.get('/active', auth, getActiveMeetings);

module.exports = router;
