const { v4: uuidv4 } = require('uuid');
const Room = require('../../models/Room');
const Meeting = require('../../models/Meeting');
const attendanceService = require('../attendance/AttendanceService');
const { joinRoom, createRoom: createRoomService } = require('./room.service');

function isHostUser(room, userId) {
    if (!room || !userId) return false;
    const userIdStr = userId.toString();

    if (room.host && room.host.toString() === userIdStr) return true;

    if (Array.isArray(room.participants)) {
        const hasRole = room.participants.some(p =>
            p?.user && p.user.toString() === userIdStr && ['host', 'co-host'].includes(p.role)
        );
        if (hasRole) return true;
    }

    return false;
}

async function createRoom(req, res) {
    try {
        const { name, settings } = req.body;
        const data = await createRoomService({ name, settings, user: req.user });
        res.status(201).json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
}

async function joinRoomHandler(req, res) {
    try {
        const { roomId } = req.params;
        const { guestName } = req.body;
        const data = await joinRoom({ roomId, guestName, user: req.user });
        res.json(data);
    } catch (error) {
        if (error && error.status && error.body) {
            return res.status(error.status).json(error.body);
        }
        console.error('Join room error:', error);
        res.status(500).json({ error: 'Failed to join room' });
    }
}

module.exports = {
    createRoom,
    joinRoomHandler,
    async startAttendance(req, res) {
        try {
            const room = await Room.findOne({ roomId: req.params.roomId });
            if (!room) return res.status(404).json({ error: 'Room not found' });
            if (!isHostUser(room, req.user._id)) {
                return res.status(403).json({ error: 'Only host can take attendance' });
            }
            if (!room.isActive) {
                return res.status(400).json({ error: 'Meeting has ended' });
            }
            if (room.attendanceStartedAt) {
                return res.json({
                    message: 'Attendance already started',
                    attendanceStartedAt: room.attendanceStartedAt,
                });
            }

            const startedAt = new Date();
            room.attendanceStartedAt = startedAt;
            await room.save();

            const io = req.app.get('io');
            const activeUsers = io?.meetingPresence?.activeUsers;
            const participants = [];
            if (activeUsers) {
                for (const data of activeUsers.values()) {
                    if (data.roomId !== room.roomId) continue;
                    participants.push({ userId: data.userId, userName: data.userName });
                }
            }

            await attendanceService.startAttendance({
                meetingId: room.roomId,
                startTime: startedAt,
                participants,
            });

            return res.json({
                message: 'Attendance started',
                attendanceStartedAt: startedAt,
            });
        } catch (error) {
            console.error('Start attendance error:', error);
            res.status(500).json({ error: 'Failed to start attendance' });
        }
    },
    async getRoomInfo(req, res) {
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
    },
    async updateRoomSettings(req, res) {
        try {
            const room = await Room.findOne({ roomId: req.params.roomId });
            if (!room) return res.status(404).json({ error: 'Room not found' });
            if (!isHostUser(room, req.user._id)) {
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
    },
    async endRoom(req, res) {
        try {
            const room = await Room.findOne({ roomId: req.params.roomId });
            if (!room) return res.status(404).json({ error: 'Room not found' });
            let allowed = isHostUser(room, req.user._id);
            if (!allowed) {
                const meeting = await Meeting.findOne({ meetingId: room.roomId })
                    .select('hostId')
                    .lean();
                if (meeting && meeting.hostId?.toString() === req.user._id.toString()) {
                    allowed = true;
                }
            }

            if (!allowed) return res.status(403).json({ error: 'Only host can end meeting' });

            room.isActive = false;
            room.endedAt = new Date();
            room.participants.forEach(p => {
                if (p.isActive) {
                    p.isActive = false;
                    p.leftAt = new Date();
                }
            });
            await room.save();

            await attendanceService.finalizeMeetingAttendance({
                meetingId: room.roomId,
                meetingStartTime: room.attendanceStartedAt || room.startedAt,
                meetingEndTime: room.endedAt,
            });

            // Notify via socket
            const io = req.app.get('io');
            io.to(req.params.roomId).emit('meeting:ended', { roomId: req.params.roomId });

            res.json({ message: 'Meeting ended', room });
        } catch (error) {
            res.status(500).json({ error: 'Failed to end meeting' });
        }
    },
    async toggleScreenSharePermission(req, res) {
        try {
            const room = await Room.findOne({ roomId: req.params.roomId });
            if (!room) return res.status(404).json({ error: 'Room not found' });
            if (!isHostUser(room, req.user._id)) {
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
    }
};
