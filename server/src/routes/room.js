const express = require('express');
const Room = require('../models/Room');
const { auth, optionalAuth } = require('../middleware/auth');
const { validateCreateRoom, validateJoinRoom } = require('../middleware/validate');
const {
    createRoom,
    joinRoomHandler,
    startAttendance,
    getRoomInfo,
    updateRoomSettings,
    endRoom,
    toggleScreenSharePermission,
} = require('../modules/rooms/room.controller');

const router = express.Router();

// Create room
router.post('/create', auth, validateCreateRoom, createRoom);

// Join room
router.post('/join/:roomId', optionalAuth, validateJoinRoom, joinRoomHandler);

// Start attendance (host only)
router.post('/:roomId/attendance/start', auth, startAttendance);

// Get room info
router.get('/:roomId', optionalAuth, getRoomInfo);

// Update room settings (host only)
router.put('/:roomId/settings', auth, updateRoomSettings);

// End room (host only)
router.post('/:roomId/end', auth, endRoom);

// Toggle screen share permission
router.post('/:roomId/screen-share-permission', auth, toggleScreenSharePermission);

module.exports = router;
