import { useEffect, useMemo, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import toast from 'react-hot-toast';

export function useLiveKitRoom() {
    const lowLatencyMode = import.meta.env.VITE_LOW_LATENCY_MODE === '1';
    const lowLatencyWidth = Number(import.meta.env.VITE_LOW_LATENCY_WIDTH || 480);
    const lowLatencyHeight = Number(import.meta.env.VITE_LOW_LATENCY_HEIGHT || 270);
    const lowLatencyFps = Number(import.meta.env.VITE_LOW_LATENCY_FPS || 20);
    const logStats = import.meta.env.VITE_LK_LOG_STATS === '1';

    const roomInstance = useMemo(() => {
        return new Room({
            adaptiveStream: true,
            dynacast: true,
            audioCaptureDefaults: {
                autoGainControl: true,
                echoCancellation: true,
                noiseSuppression: true,
            },
            videoCaptureDefaults: {
                resolution: lowLatencyMode
                    ? { width: lowLatencyWidth, height: lowLatencyHeight, frameRate: lowLatencyFps }
                    : { width: 640, height: 480, frameRate: 24 },
            },
            disconnectOnPageLeave: true,
        });
    }, [lowLatencyMode, lowLatencyWidth, lowLatencyHeight, lowLatencyFps]);

    const notifiedParticipantsRef = useRef(new Set());

    useEffect(() => {
        return () => {
            roomInstance.disconnect().catch(() => { });
        };
    }, [roomInstance]);

    useEffect(() => {
        if (!roomInstance) return;

        notifiedParticipantsRef.current.clear();

        const handleParticipantConnected = (participant) => {
            if (notifiedParticipantsRef.current.has(participant.sid)) return;
            notifiedParticipantsRef.current.add(participant.sid);

            const name = participant.name || participant.identity || 'Someone';
            toast.success(`${name} joined the meeting`, {
                position: 'top-right',
                duration: 3000,
            });
        };

        const handleParticipantDisconnected = (participant) => {
            notifiedParticipantsRef.current.delete(participant.sid);

            const name = participant.name || participant.identity || 'Someone';
            toast(`${name} left the meeting`, {
                icon: '🏃',
                position: 'top-right',
                duration: 3000,
            });
        };

        const handleQualityChanged = (quality, participant) => {
            if (!logStats) return;
            const name = participant?.name || participant?.identity || 'unknown';
            console.log(`📶 LiveKit quality ${name}:`, quality);
        };

        roomInstance.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
        roomInstance.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        roomInstance.on(RoomEvent.ConnectionQualityChanged, handleQualityChanged);

        console.log('✅ Room instance events initialized');
        return () => {
            roomInstance.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
            roomInstance.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
            roomInstance.off(RoomEvent.ConnectionQualityChanged, handleQualityChanged);
        };
    }, [roomInstance, logStats]);

    useEffect(() => {
        if (!roomInstance || !logStats) return;
        if (typeof roomInstance.getStats !== 'function') return;

        const intervalId = setInterval(async () => {
            try {
                const stats = await roomInstance.getStats();
                console.log('📊 LiveKit stats:', stats);
            } catch (_) {
                // Ignore stats errors to avoid noisy logs
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [roomInstance, logStats]);

    return { roomInstance };
}
