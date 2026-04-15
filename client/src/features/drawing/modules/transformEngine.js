export class TransformEngine {
    constructor(strokeManager) {
        this.strokeManager = strokeManager;
        this.selectedStrokeId = null;
        this.lastX = null;
        this.lastY = null;
        this.moveThreshold = 60;
    }

    static transformedPoints(stroke) {
        const points = stroke.points || [];
        if (!points.length) return [];
        const transform = stroke.transform || { tx: 0, ty: 0, scale: 1, rotation: 0 };

        let cx = 0;
        let cy = 0;
        points.forEach((p) => {
            cx += p.x;
            cy += p.y;
        });
        cx /= points.length;
        cy /= points.length;

        const cos = Math.cos(transform.rotation || 0);
        const sin = Math.sin(transform.rotation || 0);

        return points.map((p) => {
            let x = p.x - cx;
            let y = p.y - cy;
            x *= transform.scale || 1;
            y *= transform.scale || 1;
            const rx = x * cos - y * sin;
            const ry = x * sin + y * cos;
            return {
                x: rx + cx + (transform.tx || 0),
                y: ry + cy + (transform.ty || 0),
            };
        });
    }

    selectNearest(x, y) {
        if (this.selectedStrokeId !== null) return;

        let closestId = null;
        let closest = this.moveThreshold;

        for (const stroke of this.strokeManager.getAll()) {
            const points = TransformEngine.transformedPoints(stroke);
            for (let i = 0; i < points.length - 1; i += 1) {
                const dist = this.distanceToSegment(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
                if (dist < closest) {
                    closest = dist;
                    closestId = stroke.id;
                }
            }
        }

        if (closestId !== null) {
            this.selectedStrokeId = closestId;
            this.lastX = x;
            this.lastY = y;
        }
    }

    handleMove(x, y) {
        if (this.selectedStrokeId === null) {
            this.selectNearest(x, y);
            return null;
        }

        const stroke = this.strokeManager.getStroke(this.selectedStrokeId);
        if (!stroke) return null;

        const dx = this.lastX === null ? 0 : x - this.lastX;
        const dy = this.lastY === null ? 0 : y - this.lastY;

        stroke.transform = stroke.transform || { tx: 0, ty: 0, scale: 1, rotation: 0 };
        stroke.transform.tx += dx;
        stroke.transform.ty += dy;

        this.lastX = x;
        this.lastY = y;
        return stroke;
    }

    handleScale(delta) {
        if (this.selectedStrokeId === null) return null;
        const stroke = this.strokeManager.getStroke(this.selectedStrokeId);
        if (!stroke) return null;

        stroke.transform = stroke.transform || { tx: 0, ty: 0, scale: 1, rotation: 0 };
        stroke.transform.scale = Math.max(0.1, Math.min(5, stroke.transform.scale * (1 + delta * 8)));
        return stroke;
    }

    handleRotate(delta) {
        if (this.selectedStrokeId === null) return null;
        const stroke = this.strokeManager.getStroke(this.selectedStrokeId);
        if (!stroke) return null;

        stroke.transform = stroke.transform || { tx: 0, ty: 0, scale: 1, rotation: 0 };
        stroke.transform.rotation += delta;
        return stroke;
    }

    snapRotation() {
        if (this.selectedStrokeId === null) return;
        const stroke = this.strokeManager.getStroke(this.selectedStrokeId);
        if (!stroke) return;
        const snap = Math.PI / 4;
        stroke.transform.rotation = Math.round(stroke.transform.rotation / snap) * snap;
    }

    releaseAll() {
        if (this.selectedStrokeId !== null) {
            this.snapRotation();
        }
        this.selectedStrokeId = null;
        this.lastX = null;
        this.lastY = null;
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
