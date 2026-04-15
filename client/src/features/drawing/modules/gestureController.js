export const GESTURES = {
    IDLE: "IDLE",
    DRAW: "DRAW",
    ERASE: "ERASE",
    CLEAR: "CLEAR",
};

export class GestureController {
    detectGesture(landmarks) {
        if (!landmarks) return GESTURES.IDLE;

        const isFingerUp = (fingerIndex) => {
            const tip = landmarks[fingerIndex * 4 + 4];
            const pip = landmarks[fingerIndex * 4 + 2];
            return tip.y < pip.y;
        };

        const thumbUp = isFingerUp(0);
        const indexUp = isFingerUp(1);
        const middleUp = isFingerUp(2);
        const ringUp = isFingerUp(3);
        const pinkyUp = isFingerUp(4);

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

        if (pinchDistance < 0.05) return GESTURES.ERASE;
        if (!indexUp && !middleUp && !ringUp && !pinkyUp && !thumbUp) return GESTURES.CLEAR;
        if (indexUp && !middleUp && !ringUp && !pinkyUp) return GESTURES.DRAW;

        return GESTURES.IDLE;
    }
}
