const AttendanceService = require('./AttendanceService');
const Room = require('../../models/Room');

async function getMyAttendance(req, res) {
    try {
        const data = await AttendanceService.getMyAttendance(req.user);
        res.json(data);
    } catch (error) {
        console.error('Get my attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance history' });
    }
}

async function getRoomAttendance(req, res) {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId })
            .select('host isActive')
            .lean();

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (room.host?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only host can view attendance' });
        }

        if (room.isActive) {
            return res.status(400).json({ error: 'Attendance is available only after meeting ends' });
        }

        const data = await AttendanceService.getRoomAttendance(req.params.roomId);
        res.json(data);
    } catch (error) {
        console.error('Get room attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
}

module.exports = {
    getMyAttendance,
    getRoomAttendance,
};
