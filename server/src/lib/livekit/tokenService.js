const { AccessToken } = require('livekit-server-sdk');

async function generateLivekitToken(roomName, participantId, participantName, isHost = false) {
    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
        console.error('LiveKit API key/secret not configured in environment');
        return null;
    }

    try {
        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: participantId,
                name: participantName,
                ttl: '6h',
            }
        );

        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            roomAdmin: isHost,
        });

        const token = await at.toJwt();
        if (!token) {
            console.error('LiveKit toJwt() returned falsy value');
            return null;
        }
        return token;
    } catch (error) {
        console.error('LiveKit token generation error:', error);
        return null;
    }
}

module.exports = { generateLivekitToken };
