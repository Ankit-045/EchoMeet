const mongoose = require('mongoose');
const Room = require('../../models/Room');
const AttendanceSession = require('../../models/AttendanceSession');
const AttendanceSummary = require('../../models/AttendanceSummary');
const SessionTracker = require('./SessionTracker');
const AttendanceCalculator = require('./AttendanceCalculator');

const attendanceStartCache = new Map();

function normalizeIdentity({ userId, isGuest }) {
    const value = String(userId || '').trim();
    if (!value) return null;

    if (isGuest) {
        return value.startsWith('guest_') ? value : `guest_${value}`;
    }

    return value;
}

function toObjectIdOrUndefined(value) {
    if (!value) return undefined;
    if (!mongoose.Types.ObjectId.isValid(value)) return undefined;
    return new mongoose.Types.ObjectId(value);
}

function toAttendanceRow(summary) {
    return {
        _id: `${summary.meetingId}:${summary.userIdentity}`,
        roomId: summary.meetingId,
        user: summary.user,
        userName: summary.userName,
        isGuest: summary.isGuest,
        joinTime: summary.firstJoinTime,
        leaveTime: summary.lastLeaveTime,
        duration: Math.round(summary.totalTimeMs / 1000),
        totalTime: Math.round(summary.totalTimeMs / 1000),
        status: summary.status,
    };
}

async function persistClosedSession(session) {
    await AttendanceSession.create({
        meetingId: session.meetingId,
        userIdentity: session.userIdentity,
        user: session.user,
        userName: session.userName,
        isGuest: session.isGuest,
        joinTime: session.joinTime,
        leaveTime: session.leaveTime,
        durationMs: session.durationMs,
    });
}

async function closeAndPersistOpenMeetingSessions(meetingId, endTime) {
    const openSessions = SessionTracker.closeMeetingSessions(meetingId, endTime);
    if (openSessions.length === 0) return;

    await AttendanceSession.insertMany(openSessions.map(session => ({
        meetingId: session.meetingId,
        userIdentity: session.userIdentity,
        user: session.user,
        userName: session.userName,
        isGuest: session.isGuest,
        joinTime: session.joinTime,
        leaveTime: session.leaveTime,
        durationMs: session.durationMs,
    })));
}

async function aggregatePersistedSessions(meetingId) {
    return AttendanceSession.aggregate([
        { $match: { meetingId } },
        { $sort: { leaveTime: -1 } },
        {
            $group: {
                _id: '$userIdentity',
                userIdentity: { $first: '$userIdentity' },
                user: { $first: '$user' },
                userName: { $first: '$userName' },
                isGuest: { $first: '$isGuest' },
                totalTimeMs: { $sum: '$durationMs' },
                firstJoinTime: { $min: '$joinTime' },
                lastLeaveTime: { $max: '$leaveTime' },
            }
        },
    ]);
}

class AttendanceService {
    async getAttendanceStartTime(meetingId) {
        if (attendanceStartCache.has(meetingId)) {
            return attendanceStartCache.get(meetingId);
        }

        const room = await Room.findOne({ roomId: meetingId })
            .select('attendanceStartedAt')
            .lean();

        const startedAt = room?.attendanceStartedAt ? new Date(room.attendanceStartedAt) : null;
        attendanceStartCache.set(meetingId, startedAt);
        return startedAt;
    }

    clearAttendanceStartCache(meetingId) {
        attendanceStartCache.delete(meetingId);
    }

    async startAttendance({ meetingId, startTime, participants = [] }) {
        const startedAt = new Date(startTime || Date.now());
        attendanceStartCache.set(meetingId, startedAt);

        const deduped = new Map();
        for (const participant of participants) {
            const identity = normalizeIdentity({
                userId: participant.userId,
                isGuest: !mongoose.Types.ObjectId.isValid(String(participant.userId || '')),
            });
            if (!identity) continue;
            deduped.set(identity, participant);
        }

        for (const participant of deduped.values()) {
            const identity = normalizeIdentity({
                userId: participant.userId,
                isGuest: !mongoose.Types.ObjectId.isValid(String(participant.userId || '')),
            });
            if (!identity) continue;

            const isGuest = identity.startsWith('guest_');
            SessionTracker.trackJoin({
                meetingId,
                userIdentity: identity,
                user: isGuest ? undefined : toObjectIdOrUndefined(identity),
                userName: String(participant.userName || 'Anonymous').slice(0, 50),
                isGuest,
                joinedAt: startedAt,
            });
        }
    }

    async onUserJoined({ meetingId, userId, userName }) {
        const startedAt = await this.getAttendanceStartTime(meetingId);
        if (!startedAt) return;

        const identity = normalizeIdentity({ userId, isGuest: !mongoose.Types.ObjectId.isValid(String(userId || '')) });
        if (!identity) return;

        const isGuest = identity.startsWith('guest_');
        SessionTracker.trackJoin({
            meetingId,
            userIdentity: identity,
            user: isGuest ? undefined : toObjectIdOrUndefined(identity),
            userName: String(userName || 'Anonymous').slice(0, 50),
            isGuest,
            joinedAt: new Date(),
        });
    }

    async onUserLeft({ meetingId, userId }) {
        const startedAt = await this.getAttendanceStartTime(meetingId);
        if (!startedAt) return;

        const identity = normalizeIdentity({ userId, isGuest: !mongoose.Types.ObjectId.isValid(String(userId || '')) });
        if (!identity) return;

        const closedSession = SessionTracker.trackLeave({
            meetingId,
            userIdentity: identity,
            leftAt: new Date(),
        });

        if (!closedSession) return;
        await persistClosedSession(closedSession);
    }

    async finalizeMeetingAttendance({ meetingId, meetingStartTime, meetingEndTime }) {
        const attendanceStart = await this.getAttendanceStartTime(meetingId);
        if (!attendanceStart) {
            await AttendanceSummary.deleteMany({ meetingId });
            return { attendance: [], stats: AttendanceCalculator.buildStats([]) };
        }

        const start = new Date(attendanceStart);
        const end = meetingEndTime ? new Date(meetingEndTime) : new Date();
        const meetingDurationMs = Math.max(0, end.getTime() - start.getTime());

        await closeAndPersistOpenMeetingSessions(meetingId, end);

        const grouped = await aggregatePersistedSessions(meetingId);

        if (grouped.length === 0) {
            await AttendanceSummary.deleteMany({ meetingId });
            return { attendance: [], stats: AttendanceCalculator.buildStats([]) };
        }

        const summaries = grouped.map(row => ({
            ...row,
            status: AttendanceCalculator.getStatus(row.totalTimeMs, meetingDurationMs),
            meetingStartTime: start,
            meetingEndTime: end,
            meetingDurationMs,
            finalizedAt: new Date(),
        }));

        await Promise.all(summaries.map(summary =>
            AttendanceSummary.updateOne(
                { meetingId, userIdentity: summary.userIdentity },
                {
                    $set: {
                        meetingId,
                        userIdentity: summary.userIdentity,
                        user: summary.user,
                        userName: summary.userName,
                        isGuest: summary.isGuest,
                        totalTimeMs: summary.totalTimeMs,
                        status: summary.status,
                        firstJoinTime: summary.firstJoinTime,
                        lastLeaveTime: summary.lastLeaveTime,
                        meetingStartTime: summary.meetingStartTime,
                        meetingEndTime: summary.meetingEndTime,
                        meetingDurationMs: summary.meetingDurationMs,
                        finalizedAt: summary.finalizedAt,
                    }
                },
                { upsert: true }
            )
        ));

        const rows = summaries.map(toAttendanceRow);
        return { attendance: rows, stats: AttendanceCalculator.buildStats(summaries) };
    }

    async getRoomAttendance(meetingId) {
        const room = await Room.findOne({ roomId: meetingId })
            .select('isActive startedAt endedAt attendanceStartedAt')
            .lean();

        if (!room) {
            return { attendance: [], stats: AttendanceCalculator.buildStats([]) };
        }

        if (room.isActive) {
            return { attendance: [], stats: AttendanceCalculator.buildStats([]) };
        }

        return this.finalizeMeetingAttendance({
            meetingId,
            meetingStartTime: room.attendanceStartedAt || room.startedAt,
            meetingEndTime: room.endedAt || new Date(),
        });
    }

    async getMyAttendance(user) {
        const summaries = await AttendanceSummary.find({ user: user._id })
            .select('meetingId user userName isGuest totalTimeMs status firstJoinTime lastLeaveTime meetingStartTime meetingEndTime meetingDurationMs finalizedAt')
            .sort({ meetingEndTime: -1 })
            .limit(50)
            .lean();

        return {
            attendance: summaries.map(summary => ({
                _id: `${summary.meetingId}:${summary.userName}`,
                roomId: summary.meetingId,
                user: summary.user,
                userName: summary.userName,
                isGuest: summary.isGuest,
                joinTime: summary.firstJoinTime,
                leaveTime: summary.lastLeaveTime,
                duration: Math.round(summary.totalTimeMs / 1000),
                totalTime: Math.round(summary.totalTimeMs / 1000),
                status: summary.status,
                meetingStartTime: summary.meetingStartTime,
                meetingEndTime: summary.meetingEndTime,
            })),
        };
    }
}

module.exports = new AttendanceService();
