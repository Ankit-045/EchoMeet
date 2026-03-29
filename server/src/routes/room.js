const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { AccessToken } = require('livekit-server-sdk');
const Room = require('../models/Room');
const Meeting = require('../models/Meeting');
const { auth, optionalAuth } = require('../middleware/auth');
const { validateCreateRoom, validateJoinRoom } = require('../middleware/validate');

const router = express.Router();

// Create room
router.post('/create', auth, validateCreateRoom, async (req, res) => {
  try {
    const { name, settings } = req.body;
    const roomId = uuidv4().slice(0, 8).toUpperCase();

    const room = new Room({
      roomId,
      name: name || `Meeting-${roomId}`,
      host: req.user._id,
      participants: [{
        user: req.user._id,
        role: 'host',
        joinedAt: new Date(),
        isActive: true
      }],
      settings: {
        maxParticipants: settings?.maxParticipants || 25,
        allowGuestAccess: settings?.allowGuestAccess !== false,
        allowScreenShare: settings?.allowScreenShare !== false,
        allowChat: settings?.allowChat !== false,
        allowHandRaise: settings?.allowHandRaise !== false,
        isPrivate: settings?.isPrivate === true,
        approvedParticipants: [req.user._id.toString()]
      }
    });

    await room.save();

    // Generate LiveKit token for host
    const livekitToken = await generateLivekitToken(roomId, req.user._id.toString(), req.user.name, true);
    if (!livekitToken) {
      return res.status(500).json({ error: 'Failed to generate video token. Check LiveKit configuration.' });
    }

    res.status(201).json({ room, livekitToken, joinLink: `/meeting/${roomId}` });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join room
router.post('/join/:roomId', optionalAuth, validateJoinRoom, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { guestName } = req.body;
    let room = await Room.findOne({ roomId, isActive: true });
    
    if (!room) {
      const meeting = await Meeting.findOne({ meetingId: roomId });
      if (meeting) {
        const now = new Date();
        const startTime = new Date(meeting.scheduledAt);
        const joinWindow = new Date(startTime.getTime() - 5 * 60000); // 5 mins before

        if (now < joinWindow) {
          return res.status(403).json({ 
            error: 'Meeting has not started yet', 
            notStarted: true,
            scheduledAt: meeting.scheduledAt 
          });
        }

        // Auto-create room for the scheduled meeting
        room = new Room({
          roomId: meeting.meetingId,
          name: meeting.title,
          host: meeting.hostId,
          participants: [],
          settings: {
            ...meeting.settings, // Inherit if exists
            maxParticipants: 25,
            allowGuestAccess: true,
            allowScreenShare: true,
            allowChat: true,
            allowHandRaise: true
          }
        });
        await room.save();
      } else {
        return res.status(404).json({ error: 'Room found or ended' });
      }
    }

    const activeParticipants = room.participants.filter(p => p.isActive);
    if (activeParticipants.length >= room.settings.maxParticipants) {
      return res.status(400).json({ error: 'Room is full' });
    }

    const isGuest = !req.user;
    if (isGuest && !room.settings.allowGuestAccess) {
      return res.status(403).json({ error: 'Guest access is not allowed' });
    }

    const participantName = req.user ? req.user.name : (guestName || `Guest_${uuidv4().slice(0, 6)}`);
    const participantId = req.user ? req.user._id.toString() : `guest_${uuidv4().slice(0, 8)}`;

    // Check if already in room
    const existingIdx = room.participants.findIndex(
      p => req.user && p.user?.toString() === req.user._id.toString() && p.isActive
    );

    if (existingIdx === -1) {
      room.participants.push({
        user: req.user ? req.user._id : undefined,
        guestName: isGuest ? participantName : undefined,
        role: isGuest ? 'guest' : 'participant',
        joinedAt: new Date(),
        isActive: true
      });
      await room.save();
    }

    const isHost = room.host.toString() === (req.user?._id?.toString() || '');
    
    // Privacy check
    if (room.settings.isPrivate && !isHost) {
      const isApproved = room.settings.approvedParticipants.includes(participantId);
      if (!isApproved) {
        return res.status(403).json({ 
          error: 'Approval required to join this meeting', 
          requiresApproval: true,
          roomId,
          participantId,
          participantName
        });
      }
    }

    const livekitToken = await generateLivekitToken(roomId, participantId, participantName, isHost);
    if (!livekitToken) {
      return res.status(500).json({ error: 'Failed to generate video token. Check LiveKit configuration.' });
    }

    res.json({
      room: {
        _id: room._id,
        roomId: room.roomId,
        name: room.name,
        settings: room.settings,
        startedAt: room.startedAt,
        isActive: room.isActive,
      },
      livekitToken,
      participantId,
      participantName,
      isHost
    });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get room info
router.get('/:roomId', optionalAuth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate('host', 'name email')
      .populate('participants.user', 'name email');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

// Update room settings (host only)
router.put('/:roomId/settings', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can update settings' });
    }

    const { settings } = req.body;
    if (settings) {
      Object.assign(room.settings, settings);
    }
    await room.save();
    res.json({ room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// End room (host only)
router.post('/:roomId/end', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can end meeting' });
    }

    room.isActive = false;
    room.endedAt = new Date();
    room.participants.forEach(p => {
      if (p.isActive) {
        p.isActive = false;
        p.leftAt = new Date();
      }
    });
    await room.save();

    // Notify via socket
    const io = req.app.get('io');
    io.to(req.params.roomId).emit('meeting:ended', { roomId: req.params.roomId });

    res.json({ message: 'Meeting ended', room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to end meeting' });
  }
});

// Toggle screen share permission
router.post('/:roomId/screen-share-permission', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can manage screen share' });
    }

    const { userId, allowed } = req.body;
    if (allowed) {
      if (!room.settings.screenShareWhitelist.includes(userId)) {
        room.settings.screenShareWhitelist.push(userId);
      }
    } else {
      room.settings.screenShareWhitelist = room.settings.screenShareWhitelist.filter(
        id => id.toString() !== userId
      );
    }
    await room.save();

    const io = req.app.get('io');
    io.to(req.params.roomId).emit('screen-share:permission-updated', { userId, allowed });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// Helper: Generate LiveKit token
async function generateLivekitToken(roomName, participantId, participantName, isHost = false) {
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    console.error('LiveKit API key/secret not configured in environment');
    return null;
  }

  try {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: participantId,
        name: participantName,
        ttl: '6h',
      }
    );

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost,
    });

    const token = await at.toJwt();
    if (!token) {
      console.error('LiveKit toJwt() returned falsy value');
      return null;
    }
    return token;
  } catch (error) {
    console.error('LiveKit token generation error:', error);
    return null;
  }
}

module.exports = router;
