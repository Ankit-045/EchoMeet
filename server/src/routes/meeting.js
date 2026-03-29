const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Room = require('../models/Room');
const Meeting = require('../models/Meeting');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Create scheduled meeting
router.post('/', auth, async (req, res) => {
  try {
    const { title, scheduledAt, duration, isPrivate } = req.body;
    
    if (!title || !scheduledAt) {
      return res.status(400).json({ error: 'Title and scheduled time are required' });
    }

    const meetingId = uuidv4().slice(0, 8).toUpperCase();
    const meeting = new Meeting({
      title,
      meetingId,
      hostId: req.user._id,
      scheduledAt: new Date(scheduledAt),
      duration: duration || 60,
      settings: { isPrivate: isPrivate === true }
    });

    await meeting.save();
    res.status(201).json({ meeting });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

// Get user's meetings (Scheduled + History)
router.get('/my-meetings', auth, async (req, res) => {
  try {
    // 1. Fetch upcoming scheduled meetings
    const scheduled = await Meeting.find({
      hostId: req.user._id,
      scheduledAt: { $gte: new Date(Date.now() - 3600000) } // Show meetings that started in the last hour too
    }).sort({ scheduledAt: 1 });

    // 2. Fetch room history (current and past sessions)
    const rooms = await Room.find({
      $or: [
        { host: req.user._id },
        { 'participants.user': req.user._id }
      ]
    })
      .populate('host', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ 
      scheduled,
      history: rooms 
    });
  } catch (error) {
    console.error('Fetch meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// Delete/Cancel scheduled meeting
router.delete('/:id', auth, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, hostId: req.user._id });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or unauthorized' });
    }

    // Capture meetingId before deleting
    const meetingId = meeting.meetingId;
    await meeting.deleteOne();

    // Also end any active room associated with this meetingId
    try {
      const room = await Room.findOne({ roomId: meetingId, isActive: true });
      if (room) {
        room.isActive = false;
        room.endedAt = new Date();
        await room.save();
        
        // Notify via socket if room was active
        const io = req.app.get('io');
        if (io) {
          io.to(meetingId).emit('meeting:ended', { roomId: meetingId });
        }
      }
    } catch (roomError) {
      console.error('Error ending room on meeting deletion:', roomError);
    }

    res.json({ message: 'Meeting cancelled successfully' });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ error: 'Failed to cancel meeting' });
  }
});

// Get active meetings (Global/Admin view maybe)
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
