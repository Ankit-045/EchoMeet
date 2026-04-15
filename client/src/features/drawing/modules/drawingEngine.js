import { TransformEngine } from "./transformEngine";

export class DrawingEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(strokes, currentPath, selectedStrokeId, controlGesture = "CTRL_IDLE") {
        const ctx = this.ctx;
        this.clearCanvas();

        const all = [...strokes];
        if (currentPath?.points?.length) all.push(currentPath);

        all.forEach((stroke) => {
            if (!stroke.points?.length) return;

            const points = stroke.transform ? TransformEngine.transformedPoints(stroke) : stroke.points;
            if (!points.length) return;

            const isSelected = selectedStrokeId && stroke.id === selectedStrokeId;
            ctx.save();
            ctx.beginPath();

            if (points.length === 1) {
                ctx.arc(points[0].x, points[0].y, (stroke.lineWidth || 6) / 2, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? "#ffffff" : stroke.color;
                ctx.fill();
                ctx.restore();
                return;
            }

            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i += 1) {
                ctx.lineTo(points[i].x, points[i].y);
            }

            ctx.strokeStyle = isSelected ? "#ffffff" : stroke.color;
            ctx.lineWidth = (stroke.lineWidth || 6) * (stroke.transform?.scale || 1);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            if (isSelected) {
                ctx.shadowBlur = (stroke.glowIntensity || 12) * 2.5;
                ctx.shadowColor = "#ffffff";
                ctx.strokeStyle = "#ffffff";
            } else {
                ctx.shadowBlur = stroke.glowIntensity || 0;
                ctx.shadowColor = stroke.color;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (isSelected) {
                this.drawSelectionGuides(ctx, points, stroke, controlGesture);
            }
            ctx.restore();
        });
    }

    drawSelectionGuides(ctx, points, stroke, controlGesture) {
        let cx = 0;
        let cy = 0;
        points.forEach((p) => {
            cx += p.x;
            cy += p.y;
        });
        cx /= points.length;
        cy /= points.length;

        let maxR = 0;
        points.forEach((p) => {
            const d = Math.hypot(p.x - cx, p.y - cy);
            if (d > maxR) maxR = d;
        });
        const guideRadius = maxR + 20;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, guideRadius, 0, Math.PI * 2);
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        if (controlGesture === "CTRL_ROTATE") {
            const angle = stroke.transform?.rotation || 0;
            ctx.beginPath();
            ctx.arc(cx, cy, guideRadius + 8, -Math.PI / 2, -Math.PI / 2 + angle, angle < 0);
            ctx.strokeStyle = "rgba(255, 165, 0, 0.7)";
            ctx.lineWidth = 3;
            ctx.stroke();

            const endAngle = -Math.PI / 2 + angle;
            const ax = cx + (guideRadius + 8) * Math.cos(endAngle);
            const ay = cy + (guideRadius + 8) * Math.sin(endAngle);
            ctx.beginPath();
            ctx.arc(ax, ay, 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 165, 0, 0.9)";
            ctx.fill();
        } else if (controlGesture === "CTRL_SCALE") {
            const scale = stroke.transform?.scale || 1;
            for (let i = 1; i <= 3; i += 1) {
                ctx.beginPath();
                ctx.arc(cx, cy, guideRadius * (0.5 + i * 0.2), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 200, ${0.15 * (4 - i)})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.fillStyle = "rgba(0, 255, 200, 0.8)";
            ctx.font = "12px monospace";
            ctx.fillText(`${Math.round(scale * 100)}%`, cx - 15, cy - guideRadius - 12);
        } else if (controlGesture === "CTRL_MOVE") {
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(100, 180, 255, 0.6)";
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - 12, cy);
            ctx.lineTo(cx + 12, cy);
            ctx.moveTo(cx, cy - 12);
            ctx.lineTo(cx, cy + 12);
            ctx.strokeStyle = "rgba(100, 180, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();
    }
}
