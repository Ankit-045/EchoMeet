const { v4: uuidv4 } = require('uuid');
const Room = require('../../models/Room');
const Meeting = require('../../models/Meeting');
const attendanceService = require('../attendance/AttendanceService');

async function createMeeting({ title, scheduledAt, duration, isPrivate, user }) {
    if (!title || !scheduledAt) {
        throw { status: 400, body: { error: 'Title and scheduled time are required' } };
    }

    const meetingId = uuidv4().slice(0, 8).toUpperCase();
    const meeting = new Meeting({
        title,
        meetingId,
        hostId: user._id,
        scheduledAt: new Date(scheduledAt),
        duration: duration || 60,
        settings: { isPrivate: isPrivate === true }
    });

    await meeting.save();
    return { meeting };
}

async function getMyMeetings(user) {
    const scheduled = await Meeting.find({
        hostId: user._id,
        scheduledAt: { $gte: new Date(Date.now() - 3600000) }
    })
        .select('title meetingId scheduledAt duration settings isPrivate createdAt')
        .sort({ scheduledAt: 1 })
        .lean();

    const rooms = await Room.find({
        $or: [
            { host: user._id },
            { 'participants.user': user._id }
        ]
    })
        .select('roomId name host participants startedAt createdAt isActive')
        .populate('host', 'name email')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    return { scheduled, history: rooms };
}

async function deleteMeeting({ id, user, io }) {
    const meeting = await Meeting.findOne({ _id: id, hostId: user._id });
    if (!meeting) {
        throw { status: 404, body: { error: 'Meeting not found or unauthorized' } };
    }

    const meetingId = meeting.meetingId;
    await meeting.deleteOne();

    try {
        const room = await Room.findOne({ roomId: meetingId, isActive: true });
        if (room) {
            room.isActive = false;
            room.endedAt = new Date();
            await room.save();

            await attendanceService.finalizeMeetingAttendance({
                meetingId,
                meetingStartTime: room.attendanceStartedAt || room.startedAt,
                meetingEndTime: room.endedAt,
            });

            if (io) {
                io.to(meetingId).emit('meeting:ended', { roomId: meetingId });
            }
        }
    } catch (roomError) {
        console.error('Error ending room on meeting deletion:', roomError);
    }

    return { message: 'Meeting cancelled successfully' };
}

async function getActiveMeetings() {
    const rooms = await Room.find({ isActive: true })
        .select('roomId name host participants startedAt createdAt isActive')
        .populate('host', 'name email')
        .sort({ startedAt: -1 })
        .lean();

    return { meetings: rooms };
}

module.exports = {
    createMeeting,
    getMyMeetings,
    deleteMeeting,
    getActiveMeetings,
};
