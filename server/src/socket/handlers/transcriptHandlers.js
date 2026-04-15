const roomTranscriptBuffers = new Map();
const TRANSCRIPT_FLUSH_MS = 250;

function flushTranscriptBuffer(io, roomId) {
    const buffer = roomTranscriptBuffers.get(roomId);
    if (!buffer) return;

    roomTranscriptBuffers.delete(roomId);
    const chunks = buffer.chunks;
    if (!chunks || chunks.length === 0) return;

    chunks.forEach((payload) => {
        io.to(roomId).emit('transcript:chunk', payload);
    });
}

function registerTranscriptHandlers({ io, socket, helpers }) {
    const { validateRoomId, validateString } = helpers;

    // ==================== TRANSCRIPT ====================
    socket.on('transcript:chunk', (data) => {
        if (!data || !validateRoomId(data.roomId) || !validateString(data.text, 5000)) return;
        const payload = {
            text: String(data.text).slice(0, 5000),
            speaker: String(data.speaker || 'Unknown').slice(0, 50),
            timestamp: new Date()
        };

        if (!roomTranscriptBuffers.has(data.roomId)) {
            const timer = setTimeout(() => flushTranscriptBuffer(io, data.roomId), TRANSCRIPT_FLUSH_MS);
            roomTranscriptBuffers.set(data.roomId, { chunks: [payload], timer });
            return;
        }

        const buffer = roomTranscriptBuffers.get(data.roomId);
        buffer.chunks.push(payload);
    });
}

module.exports = { registerTranscriptHandlers };
