import { useEffect } from 'react';
import toast from 'react-hot-toast';

export function useRoomSocketPresence({
    socket,
    roomId,
    participantId,
    participantName,
    isHost,
    isWaiting,
    setParticipantCount,
    setPendingApprovals,
    setIsWaiting,
    setIsDenied,
    navigate,
}) {
    useEffect(() => {
        if (!socket || !participantId) return;

        const emitSocketActions = () => {
            if (!socket.connected) {
                console.warn('⚠️ Socket not connected, skipping emissions. Will re-emit on "connect".');
                return;
            }

            if (isWaiting) {
                console.log('🛎️ Knocking on room:', roomId);
                socket.emit('room:knock', { roomId, userId: participantId, userName: participantName });
            } else if (participantId) {
                console.log('🔗 Joining socket room:', roomId);
                socket.emit('room:join', {
                    roomId,
                    userId: participantId,
                    userName: participantName,
                    isGuest: participantId.startsWith('guest_')
                });

                if (isHost) {
                    console.log('📋 Fetching waiting list for host');
                    socket.emit('room:get-waiting-list', { roomId });
                }
            }
        };

        // Initial emit
        emitSocketActions();

        // Re-emit on socket reconnect
        socket.on('connect', () => {
            console.log('🔄 Socket reconnected, re-emitting actions...');
            emitSocketActions();
        });

        socket.on('room:participant-count', (count) => {
            console.log(`👥 Participant count: ${count}`);
            setParticipantCount(count);
        });

        socket.on('meeting:ended', () => {
            console.log('🏁 Meeting ended by host');
            toast('Meeting ended by host', { icon: '👋' });
            navigate('/dashboard');
        });

        // Handle entry approval/denial for knocking users
        if (isWaiting) {
            socket.on('room:entry-granted', () => {
                console.log('🎊 Entry granted! Reloading room...');
                setIsWaiting(false);
                window.location.reload();
            });

            socket.on('room:entry-denied', () => {
                console.log('🚫 Entry denied');
                setIsWaiting(false);
                setIsDenied(true);
            });
        }

        // Host handlers for knocking users
        if (isHost) {
            socket.on('room:waiting-list', (list) => {
                console.log('🕒 Waiting list received:', list);
                setPendingApprovals(list);
            });
            socket.on('room:request-entry', (data) => {
                console.log('🛎️ New knocking request:', data);
                setPendingApprovals(prev => {
                    if (prev.find(u => u.userId === data.userId)) return prev;
                    return [...prev, data];
                });
                toast(`${data.userName} is knocking...`, { icon: '🔔', position: 'top-right' });
            });
            socket.on('room:knock-cancelled', ({ userId }) => {
                console.log('❌ Knock cancelled by user:', userId);
                setPendingApprovals(prev => prev.filter(u => u.userId !== userId));
            });
        }

        return () => {
            console.log('🧹 Cleaning up socket effect for participant:', participantId);
            socket.emit('room:leave', { roomId, userId: participantId, userName: participantName });
            socket.off('connect');
            socket.off('room:participant-count');
            socket.off('meeting:ended');
            socket.off('room:entry-granted');
            socket.off('room:entry-denied');
            socket.off('room:waiting-list');
            socket.off('room:request-entry');
            socket.off('room:knock-cancelled');
        };
    }, [
        socket,
        roomId,
        participantId,
        participantName,
        navigate,
        isHost,
        isWaiting,
        setParticipantCount,
        setPendingApprovals,
        setIsWaiting,
        setIsDenied,
    ]);
}
