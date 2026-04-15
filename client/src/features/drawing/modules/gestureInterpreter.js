import { GestureController, GESTURES } from "./gestureController";

export const CONTROL_GESTURES = {
    IDLE: "CTRL_IDLE",
    MOVE: "CTRL_MOVE",
    SCALE: "CTRL_SCALE",
    ROTATE: "CTRL_ROTATE",
};

export class GestureInterpreter {
    constructor() {
        this.primaryController = new GestureController();
        this.lastPinchDistance = null;
        this.lastHandAngle = null;
        this.lastControlGesture = CONTROL_GESTURES.IDLE;
        this.idleFrames = 0;
    }

    interpret(results) {
        const output = {
            primary: {
                gesture: GESTURES.IDLE,
                landmark: null,
                fingertips: [],
            },
            secondary: {
                gesture: CONTROL_GESTURES.IDLE,
                landmark: null,
                fingertips: [],
                pinchDelta: 0,
                angleDelta: 0,
            },
        };

        if (!results?.multiHandLandmarks?.length) {
            this.lastPinchDistance = null;
            this.lastHandAngle = null;
            return output;
        }

        let primaryLandmarks = null;
        let secondaryLandmarks = null;

        if (results.multiHandLandmarks.length === 1) {
            primaryLandmarks = results.multiHandLandmarks[0];
            this.lastPinchDistance = null;
            this.lastHandAngle = null;
        } else if (results.multiHandLandmarks.length >= 2) {
            const handedness = results.multiHandedness || [];
            let primaryIdx = 0;
            let secondaryIdx = 1;

            if (handedness.length >= 2) {
                const label0 = handedness[0]?.label || "";
                if (label0 === "Right") {
                    primaryIdx = 1;
                    secondaryIdx = 0;
                }
            }

            primaryLandmarks = results.multiHandLandmarks[primaryIdx];
            secondaryLandmarks = results.multiHandLandmarks[secondaryIdx];
        }

        if (primaryLandmarks) {
            output.primary.gesture = this.primaryController.detectGesture(primaryLandmarks);
            output.primary.landmark = primaryLandmarks?.[8] || null;
            output.primary.fingertips = [4, 8, 12, 16, 20].map((i) => primaryLandmarks[i]);
        }

        if (!secondaryLandmarks) {
            this.lastControlGesture = CONTROL_GESTURES.IDLE;
            this.idleFrames = 0;
            return output;
        }

        const control = this.detectControlGesture(secondaryLandmarks);
        const raw = control.gesture;

        if (raw === CONTROL_GESTURES.IDLE) {
            this.idleFrames += 1;
            if (this.idleFrames < 4 && this.lastControlGesture !== CONTROL_GESTURES.IDLE) {
                control.gesture = this.lastControlGesture;
            } else {
                this.lastControlGesture = CONTROL_GESTURES.IDLE;
            }
        } else {
            this.idleFrames = 0;
            this.lastControlGesture = raw;
        }

        output.secondary = {
            gesture: control.gesture,
            landmark: secondaryLandmarks[8],
            fingertips: [4, 8, 12, 16, 20].map((i) => secondaryLandmarks[i]),
            pinchDelta: control.pinchDelta,
            angleDelta: control.angleDelta,
        };

        return output;
    }

    detectControlGesture(landmarks) {
        const isFingerUp = (fingerIndex) => {
            const tip = landmarks[fingerIndex * 4 + 4];
            const pip = landmarks[fingerIndex * 4 + 2];
            return tip.y < pip.y;
        };

        const indexUp = isFingerUp(1);
        const middleUp = isFingerUp(2);
        const ringUp = isFingerUp(3);
        const pinkyUp = isFingerUp(4);

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const wrist = landmarks[0];
        const middleBase = landmarks[9];

        const pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const handAngle = Math.atan2(middleBase.y - wrist.y, middleBase.x - wrist.x);

        if (pinchDistance < 0.06) {
            const pinchDelta = this.lastPinchDistance === null ? 0 : pinchDistance - this.lastPinchDistance;
            this.lastPinchDistance = pinchDistance;
            this.lastHandAngle = null;
            return { gesture: CONTROL_GESTURES.SCALE, pinchDelta, angleDelta: 0 };
        }
        this.lastPinchDistance = null;

        if (indexUp && middleUp && ringUp && pinkyUp) {
            let angleDelta = this.lastHandAngle === null ? 0 : handAngle - this.lastHandAngle;
            if (Math.abs(angleDelta) > Math.PI) angleDelta = 0;
            this.lastHandAngle = handAngle;
            return { gesture: CONTROL_GESTURES.ROTATE, pinchDelta: 0, angleDelta };
        }
        this.lastHandAngle = null;

        if (indexUp && middleUp && !ringUp && !pinkyUp) {
            return { gesture: CONTROL_GESTURES.MOVE, pinchDelta: 0, angleDelta: 0 };
        }

        return { gesture: CONTROL_GESTURES.IDLE, pinchDelta: 0, angleDelta: 0 };
    }
}
