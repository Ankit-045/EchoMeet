const express = require('express');
const { auth, optionalAuth } = require('../middleware/auth');
const {
    validateCreateRoom,
    validateJoinRoom,
    validateRoomIdParam,
} = require('../middleware/validate');
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
router.post('/join/:roomId', optionalAuth, validateRoomIdParam, validateJoinRoom, joinRoomHandler);

// Start attendance (host only)
router.post('/:roomId/attendance/start', auth, validateRoomIdParam, startAttendance);

// Get room info
router.get('/:roomId', optionalAuth, validateRoomIdParam, getRoomInfo);

// Update room settings (host only)
router.put('/:roomId/settings', auth, validateRoomIdParam, updateRoomSettings);

// End room (host only)
router.post('/:roomId/end', auth, validateRoomIdParam, endRoom);

// Toggle screen share permission
router.post('/:roomId/screen-share-permission', auth, validateRoomIdParam, toggleScreenSharePermission);

module.exports = router;
