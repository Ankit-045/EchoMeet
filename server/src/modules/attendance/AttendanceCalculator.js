const PRESENT_THRESHOLD_RATIO = 0.7;

function getStatus(totalTimeMs, meetingDurationMs) {
    if (meetingDurationMs <= 0) {
        return totalTimeMs > 0 ? 'present' : 'absent';
    }

    return totalTimeMs >= meetingDurationMs * PRESENT_THRESHOLD_RATIO ? 'present' : 'absent';
}

function buildStats(rows) {
    const present = rows.filter(r => r.status === 'present').length;
    const absent = rows.filter(r => r.status === 'absent').length;
    const totalParticipants = rows.length;
    const averageDurationMs = totalParticipants > 0
        ? Math.round(rows.reduce((sum, row) => sum + row.totalTimeMs, 0) / totalParticipants)
        : 0;

    return {
        totalParticipants,
        present,
        absent,
        partial: 0,
        averageDuration: Math.round(averageDurationMs / 1000),
    };
}

module.exports = {
    PRESENT_THRESHOLD_RATIO,
    getStatus,
    buildStats,
};
