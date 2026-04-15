function registerDrawingHandlers({ io, socket, state, helpers }) {
    const { validateRoomId, isRateLimited } = helpers;
    const { roomDrawingStates } = state;

    function getRoomState(roomId) {
        if (!roomDrawingStates.has(roomId)) {
            roomDrawingStates.set(roomId, new Map());
        }
        return roomDrawingStates.get(roomId);
    }

    // ==================== AIR DRAWING V2 ====================
    socket.on('drawing:sync:request', (data) => {
        if (!data || !validateRoomId(data.roomId)) return;
        const roomState = getRoomState(data.roomId);
        socket.emit('drawing:sync:state', {
            roomId: data.roomId,
            strokes: Array.from(roomState.values()),
        });
    });

    socket.on('drawing:stroke:start', (data) => {
        if (!data || !validateRoomId(data.roomId) || !data.stroke || !data.stroke.id) return;
        if (isRateLimited(socket.id, 'drawing:start', 10)) return;

        const roomState = getRoomState(data.roomId);
        const stroke = {
            id: String(data.stroke.id),
            ownerId: data.userId,
            color: String(data.stroke.color || '#00ffff'),
            lineWidth: Number(data.stroke.lineWidth || 6),
            glowIntensity: Number(data.stroke.glowIntensity || 12),
            points: Array.isArray(data.stroke.points) ? data.stroke.points : [],
            transform: data.stroke.transform || { tx: 0, ty: 0, scale: 1, rotation: 0 },
        };

        roomState.set(stroke.id, stroke);
        socket.to(data.roomId).emit('drawing:stroke:start', { roomId: data.roomId, stroke });
    });

    socket.on('drawing:stroke:append', (data) => {
        if (!data || !validateRoomId(data.roomId) || !data.strokeId || !Array.isArray(data.points)) return;
        if (isRateLimited(socket.id, 'drawing:append', 16)) return;

        const roomState = getRoomState(data.roomId);
        const strokeId = String(data.strokeId);
        const existing = roomState.get(strokeId);
        if (!existing) return;

        const nextPoints = data.points
            .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
            .map((p) => ({ x: Number(p.x), y: Number(p.y) }));

        if (nextPoints.length === 0) return;
        existing.points.push(...nextPoints);

        socket.to(data.roomId).emit('drawing:stroke:append', {
            roomId: data.roomId,
            strokeId,
            points: nextPoints,
        });
    });

    socket.on('drawing:stroke:end', (data) => {
        if (!data || !validateRoomId(data.roomId) || !data.strokeId) return;
        socket.to(data.roomId).emit('drawing:stroke:end', {
            roomId: data.roomId,
            strokeId: String(data.strokeId),
        });
    });

    socket.on('drawing:stroke:transform', (data) => {
        if (!data || !validateRoomId(data.roomId) || !data.strokeId || !data.transform) return;
        if (isRateLimited(socket.id, 'drawing:transform', 25)) return;

        const roomState = getRoomState(data.roomId);
        const existing = roomState.get(String(data.strokeId));
        if (!existing) return;

        existing.transform = {
            tx: Number(data.transform.tx || 0),
            ty: Number(data.transform.ty || 0),
            scale: Number(data.transform.scale || 1),
            rotation: Number(data.transform.rotation || 0),
        };

        socket.to(data.roomId).emit('drawing:stroke:transform', {
            roomId: data.roomId,
            strokeId: String(data.strokeId),
            transform: existing.transform,
        });
    });

    socket.on('drawing:stroke:erase', (data) => {
        if (!data || !validateRoomId(data.roomId) || !Array.isArray(data.strokeIds)) return;
        const roomState = getRoomState(data.roomId);
        const removedIds = [];

        data.strokeIds.forEach((id) => {
            const normalized = String(id);
            if (roomState.delete(normalized)) {
                removedIds.push(normalized);
            }
        });

        if (removedIds.length > 0) {
            socket.to(data.roomId).emit('drawing:stroke:erase', {
                roomId: data.roomId,
                strokeIds: removedIds,
            });
        }
    });

    socket.on('drawing:clear', (data) => {
        if (!data || !validateRoomId(data.roomId)) return;
        getRoomState(data.roomId).clear();
        socket.to(data.roomId).emit('drawing:clear', { roomId: data.roomId, userId: data.userId });
    });
}

module.exports = { registerDrawingHandlers };
