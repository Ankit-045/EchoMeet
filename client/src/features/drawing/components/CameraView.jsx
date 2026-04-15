import { useEffect, useRef } from "react";

export default function CameraView({ onResults, onReady }) {
  const videoRef = useRef(null);

  useEffect(() => {
    let hands = null;
    let camera = null;
    let stopped = false;

    const start = async () => {
      try {
        const handsLib = await import("@mediapipe/hands");
        const cameraLib = await import("@mediapipe/camera_utils");

        const video = videoRef.current;
        if (!video) return;

        hands = new handsLib.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          if (!stopped) onResults?.(results);
        });

        camera = new cameraLib.Camera(video, {
          onFrame: async () => {
            await hands.send({ image: video });
          },
          width: 640,
          height: 360,
          facingMode: "user",
        });

        await camera.start();
        onReady?.(true);
      } catch (error) {
        console.error("CameraView init error:", error);
        onReady?.(false);
      }
    };

    start();

    return () => {
      stopped = true;
      camera?.stop?.();
      hands?.close?.();
    };
  }, [onReady, onResults]);

  return <video ref={videoRef} className="hidden" playsInline />;
}
