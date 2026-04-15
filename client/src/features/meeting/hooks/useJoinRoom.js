import { useEffect, useState } from 'react';
import { joinRoom } from '@/services/api';

export function useJoinRoom({ roomId, user, authLoading }) {
    const [livekitToken, setLivekitToken] = useState(null);
    const [room, setRoom] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [participantId, setParticipantId] = useState('');
    const [participantName, setParticipantName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isWaiting, setIsWaiting] = useState(false);
    const [isDenied, setIsDenied] = useState(false);
    const [isNotStarted, setIsNotStarted] = useState(false);
    const [scheduledAt, setScheduledAt] = useState(null);

    useEffect(() => {
        if (authLoading) return;

        const join = async () => {
            console.log(`🚀 Attempting to join room: ${roomId}`);
            try {
                const res = await joinRoom(roomId, { guestName: user?.name || 'Guest' });
                console.log('📥 Join response:', res.data);

                if (res.data?.requiresApproval) {
                    console.log('🕒 Approval required, moving to waiting state');
                    setIsWaiting(true);
                    setParticipantId(res.data.participantId);
                    setParticipantName(res.data.participantName);
                    setLoading(false);
                    return;
                }

                if (!res.data?.livekitToken) {
                    setError('Video token not received. LiveKit may be misconfigured.');
                    setLoading(false);
                    return;
                }
                setLivekitToken(res.data.livekitToken);
                setRoom(res.data.room);
                setIsHost(res.data.isHost);
                setParticipantId(res.data.participantId);
                setParticipantName(res.data.participantName);
                setLoading(false);
                console.log('✅ Joined successfully as', res.data.isHost ? 'Host' : 'Participant');
            } catch (err) {
                if (err.response?.status === 410) {
                    setError('Room has ended');
                    setLoading(false);
                    return;
                }

                setError(err.response?.data?.error || 'Failed to join meeting');
                if (err.response?.status === 403) {
                    if (err.response.data?.requiresApproval) {
                        console.log('🕒 Approval required (403), moving to waiting state');
                        const data = err.response.data;
                        setIsWaiting(true);
                        setParticipantId(data.participantId);
                        setParticipantName(data.participantName);
                        setLoading(false);
                        return;
                    }
                    if (err.response.data?.notStarted) {
                        console.log('🕒 Meeting not started yet');
                        setIsNotStarted(true);
                        setScheduledAt(new Date(err.response.data.scheduledAt));
                        setLoading(false);
                        return;
                    }
                }
                setLoading(false);
            }
        };

        join();
    }, [roomId, authLoading, user]);

    return {
        livekitToken,
        room,
        isHost,
        participantId,
        participantName,
        loading,
        error,
        isWaiting,
        isDenied,
        isNotStarted,
        scheduledAt,
        setIsWaiting,
        setIsDenied,
    };
}
