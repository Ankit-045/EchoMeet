export class StrokeManager {
    constructor() {
        this.strokes = new Map();
        this.redoStack = [];
    }

    addStroke(stroke) {
        this.strokes.set(stroke.id, {
            ...stroke,
            points: [...(stroke.points || [])],
            transform: stroke.transform || { tx: 0, ty: 0, scale: 1, rotation: 0 },
        });
        this.redoStack = [];
    }

    upsertStroke(stroke) {
        const previous = this.strokes.get(stroke.id) || {};
        this.strokes.set(stroke.id, {
            ...previous,
            ...stroke,
            points: stroke.points ? [...stroke.points] : previous.points || [],
            transform: stroke.transform || previous.transform || { tx: 0, ty: 0, scale: 1, rotation: 0 },
        });
    }

    appendPoints(strokeId, points) {
        const stroke = this.strokes.get(strokeId);
        if (!stroke || !Array.isArray(points) || points.length === 0) return;
        if (!Array.isArray(stroke.points)) stroke.points = [];
        stroke.points.push(...points);
    }

    removeStroke(id) {
        this.strokes.delete(id);
    }

    removeMany(ids) {
        ids.forEach((id) => this.strokes.delete(id));
    }

    clear() {
        this.strokes.clear();
        this.redoStack = [];
    }

    undo() {
        const all = Array.from(this.strokes.values());
        const last = all[all.length - 1];
        if (!last) return;
        this.strokes.delete(last.id);
        this.redoStack.push(last);
    }

    redo() {
        const stroke = this.redoStack.pop();
        if (!stroke) return;
        this.strokes.set(stroke.id, stroke);
    }

    getStroke(id) {
        return this.strokes.get(id) || null;
    }

    getAll() {
        return Array.from(this.strokes.values());
    }

    findIntersectingStrokeIds(x, y, radius) {
        const hits = [];
        for (const stroke of this.strokes.values()) {
            if (this.strokeIntersects(stroke, x, y, radius)) {
                hits.push(stroke.id);
            }
        }
        return hits;
    }

    strokeIntersects(stroke, cx, cy, radius) {
        const points = stroke.points || [];
        for (let i = 0; i < points.length - 1; i += 1) {
            const dist = this.distanceToSegment(cx, cy, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
            if (dist <= radius + (stroke.lineWidth || 6) / 2) return true;
        }

        if (points.length === 1) {
            const dist = Math.hypot(cx - points[0].x, cy - points[0].y);
            if (dist <= radius + (stroke.lineWidth || 6) / 2) return true;
        }

        return false;
    }

    distanceToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);

        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        const nx = x1 + t * dx;
        const ny = y1 + t * dy;
        return Math.hypot(px - nx, py - ny);
    }
}
