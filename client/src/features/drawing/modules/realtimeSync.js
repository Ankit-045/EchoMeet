export class RealtimeSyncService {
    constructor({ socket, roomId, userId, onEvent }) {
        this.socket = socket;
        this.roomId = roomId;
        this.userId = userId;
        this.onEvent = onEvent;
        this.bound = false;

        this.handleState = (payload) => this.onEvent?.("state", payload);
        this.handleStart = (payload) => this.onEvent?.("stroke:start", payload);
        this.handleAppend = (payload) => this.onEvent?.("stroke:append", payload);
        this.handleEnd = (payload) => this.onEvent?.("stroke:end", payload);
        this.handleTransform = (payload) => this.onEvent?.("stroke:transform", payload);
        this.handleErase = (payload) => this.onEvent?.("stroke:erase", payload);
        this.handleClear = (payload) => this.onEvent?.("clear", payload);
    }

    bind() {
        if (!this.socket || this.bound) return;
        this.bound = true;
        this.socket.on("drawing:sync:state", this.handleState);
        this.socket.on("drawing:stroke:start", this.handleStart);
        this.socket.on("drawing:stroke:append", this.handleAppend);
        this.socket.on("drawing:stroke:end", this.handleEnd);
        this.socket.on("drawing:stroke:transform", this.handleTransform);
        this.socket.on("drawing:stroke:erase", this.handleErase);
        this.socket.on("drawing:clear", this.handleClear);
        this.socket.emit("drawing:sync:request", { roomId: this.roomId });
    }

    unbind() {
        if (!this.socket || !this.bound) return;
        this.bound = false;
        this.socket.off("drawing:sync:state", this.handleState);
        this.socket.off("drawing:stroke:start", this.handleStart);
        this.socket.off("drawing:stroke:append", this.handleAppend);
        this.socket.off("drawing:stroke:end", this.handleEnd);
        this.socket.off("drawing:stroke:transform", this.handleTransform);
        this.socket.off("drawing:stroke:erase", this.handleErase);
        this.socket.off("drawing:clear", this.handleClear);
    }

    createStrokeId() {
        return `${this.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    startStroke(stroke) {
        this.socket?.emit("drawing:stroke:start", {
            roomId: this.roomId,
            userId: this.userId,
            stroke,
        });
    }

    appendStroke(strokeId, points) {
        if (!strokeId || !Array.isArray(points) || points.length === 0) return;
        this.socket?.emit("drawing:stroke:append", {
            roomId: this.roomId,
            userId: this.userId,
            strokeId,
            points,
        });
    }

    endStroke(strokeId) {
        if (!strokeId) return;
        this.socket?.emit("drawing:stroke:end", {
            roomId: this.roomId,
            userId: this.userId,
            strokeId,
        });
    }

    transformStroke(stroke) {
        this.socket?.emit("drawing:stroke:transform", {
            roomId: this.roomId,
            userId: this.userId,
            strokeId: stroke.id,
            transform: stroke.transform,
        });
    }

    eraseStrokes(strokeIds) {
        this.socket?.emit("drawing:stroke:erase", {
            roomId: this.roomId,
            userId: this.userId,
            strokeIds,
        });
    }

    clear() {
        this.socket?.emit("drawing:clear", {
            roomId: this.roomId,
            userId: this.userId,
        });
    }
}
