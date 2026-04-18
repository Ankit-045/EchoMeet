const { v4: uuidv4 } = require('uuid');
const Room = require('../../models/Room');
const Meeting = require('../../models/Meeting');
const { generateLivekitToken } = require('../../lib/livekit/tokenService');
const { validateRoomId } = require('../../lib/validation/common');

async function joinRoom({ roomId, guestName, user }) {
    const normalizedRoomId = String(roomId || '').trim().toUpperCase();
    if (!validateRoomId(normalizedRoomId)) {
        throw { status: 400, body: { error: 'Invalid meeting code format' } };
    }

    let room = await Room.findOne({ roomId: normalizedRoomId });

    if (room && !room.isActive) {
        throw { status: 410, body: { error: 'Room has ended' } };
    }

    if (!room) {
        const meeting = await Meeting.findOne({ meetingId: normalizedRoomId });
        if (meeting) {
            const now = new Date();
            const startTime = new Date(meeting.scheduledAt);
            const joinWindow = new Date(startTime.getTime() - 5 * 60000); // 5 mins before

            if (now < joinWindow) {
                throw {
                    status: 403,
                    body: {
                        error: 'Meeting has not started yet',
                        notStarted: true,
                        scheduledAt: meeting.scheduledAt
                    }
                };
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
            throw { status: 404, body: { error: 'Meeting not found or has ended' } };
        }
    }

    const activeParticipants = room.participants.filter(p => p.isActive);
    if (activeParticipants.length >= room.settings.maxParticipants) {
        throw { status: 400, body: { error: 'Room is full' } };
    }

    const isGuest = !user;
    if (isGuest && !room.settings.allowGuestAccess) {
        throw { status: 403, body: { error: 'Guest access is not allowed' } };
    }

    const participantName = user ? user.name : (guestName || `Guest_${uuidv4().slice(0, 6)}`);
    const participantId = user ? user._id.toString() : `guest_${uuidv4().slice(0, 8)}`;

    // Check if already in room
    const existingIdx = room.participants.findIndex(
        p => user && p.user?.toString() === user._id.toString() && p.isActive
    );

    if (existingIdx === -1) {
        room.participants.push({
            user: user ? user._id : undefined,
            guestName: isGuest ? participantName : undefined,
            role: isGuest ? 'guest' : 'participant',
            joinedAt: new Date(),
            isActive: true
        });
        await room.save();
    }

    const isHost = room.host.toString() === (user?._id?.toString() || '');

    // Privacy check
    if (room.settings.isPrivate && !isHost) {
        const isApproved = room.settings.approvedParticipants.includes(participantId);
        if (!isApproved) {
            throw {
                status: 403,
                body: {
                    error: 'Approval required to join this meeting',
                    requiresApproval: true,
                    roomId: normalizedRoomId,
                    participantId,
                    participantName
                }
            };
        }
    }

    const livekitToken = await generateLivekitToken(normalizedRoomId, participantId, participantName, isHost);
    if (!livekitToken) {
        throw { status: 500, body: { error: 'Failed to generate video token. Check LiveKit configuration.' } };
    }

    return {
        room: {
            _id: room._id,
            roomId: room.roomId,
            name: room.name,
            settings: room.settings,
            attendanceStartedAt: room.attendanceStartedAt,
            startedAt: room.startedAt,
            isActive: room.isActive,
        },
        livekitToken,
        participantId,
        participantName,
        isHost
    };
}

async function createRoom({ name, settings, user }) {
    const roomId = uuidv4().slice(0, 8).toUpperCase();

    const room = new Room({
        roomId,
        name: name || `Meeting-${roomId}`,
        host: user._id,
        participants: [{
            user: user._id,
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
            approvedParticipants: [user._id.toString()]
        }
    });

    await room.save();

    const livekitToken = await generateLivekitToken(roomId, user._id.toString(), user.name, true);
    if (!livekitToken) {
        throw { status: 500, body: { error: 'Failed to generate video token. Check LiveKit configuration.' } };
    }

    return { room, livekitToken, joinLink: `/meeting/${roomId}` };
}

module.exports = { joinRoom, createRoom };
