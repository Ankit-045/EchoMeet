class SessionTracker {
    constructor() {
        this.activeSessions = new Map();
    }

    getSessionKey(meetingId, userIdentity) {
        return `${meetingId}:${userIdentity}`;
    }

    trackJoin({ meetingId, userIdentity, user, userName, isGuest, joinedAt }) {
        const key = this.getSessionKey(meetingId, userIdentity);
        const existing = this.activeSessions.get(key);

        // Ignore duplicate joins while a session is already active.
        if (existing) {
            return null;
        }

        const session = {
            meetingId,
            userIdentity,
            user,
            userName,
            isGuest,
            joinTime: joinedAt,
        };

        this.activeSessions.set(key, session);
        return session;
    }

    trackLeave({ meetingId, userIdentity, leftAt }) {
        const key = this.getSessionKey(meetingId, userIdentity);
        const session = this.activeSessions.get(key);
        if (!session) {
            return null;
        }

        this.activeSessions.delete(key);
        const durationMs = Math.max(0, leftAt.getTime() - session.joinTime.getTime());

        return {
            ...session,
            leaveTime: leftAt,
            durationMs,
        };
    }

    closeMeetingSessions(meetingId, endTime) {
        const closed = [];
        for (const [key, session] of this.activeSessions.entries()) {
            if (session.meetingId !== meetingId) continue;

            this.activeSessions.delete(key);
            closed.push({
                ...session,
                leaveTime: endTime,
                durationMs: Math.max(0, endTime.getTime() - session.joinTime.getTime()),
            });
        }
        return closed;
    }

    getMeetingActiveSessions(meetingId) {
        const sessions = [];
        for (const session of this.activeSessions.values()) {
            if (session.meetingId === meetingId) {
                sessions.push({ ...session });
            }
        }
        return sessions;
    }
}

module.exports = new SessionTracker();
