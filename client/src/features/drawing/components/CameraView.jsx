import { useEffect, useRef } from "react";

export default function CameraView({ onResults, onReady, onError }) {
  const videoRef = useRef(null);

  useEffect(() => {
    let hands = null;
    let camera = null;
    let stopped = false;

    const start = async () => {
      let timeoutId = null;
      try {
        timeoutId = setTimeout(() => {
          if (!stopped) {
            stopped = true;
            camera?.stop?.();
            hands?.close?.();
            onError?.("Camera startup timed out. Check permissions or reload.");
            onReady?.(false);
          }
        }, 10000);

        const handsLib = await import("@mediapipe/hands");
        const cameraLib = await import("@mediapipe/camera_utils");

        const HandsCtor =
          handsLib?.Hands || handsLib?.default?.Hands || handsLib?.default;
        const CameraCtor =
          cameraLib?.Camera || cameraLib?.default?.Camera || cameraLib?.default;

        if (!HandsCtor || !CameraCtor) {
          throw new TypeError("MediaPipe modules failed to load.");
        }

        const video = videoRef.current;
        if (!video) return;

        hands = new HandsCtor({
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

        camera = new CameraCtor(video, {
          onFrame: async () => {
            await hands.send({ image: video });
          },
          width: 640,
          height: 360,
          facingMode: "user",
        });

        await camera.start();
        if (video && video.paused) {
          video.play().catch(() => undefined);
        }
        if (!stopped) {
          onReady?.(true);
        }
      } catch (error) {
        console.error("CameraView init error:", error);
        const name = error?.name || "";
        let message = "Unable to start camera.";
        if (error instanceof TypeError && /MediaPipe/i.test(error.message)) {
          message = "MediaPipe failed to initialize. Try a hard refresh.";
        }
        if (name === "NotAllowedError") {
          message = "Camera permission denied. Allow access and retry.";
        } else if (name === "NotFoundError") {
          message = "No camera device found.";
        } else if (name === "NotReadableError") {
          message = "Camera is in use by another app.";
        }
        onError?.(message);
        onReady?.(false);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    start();

    return () => {
      stopped = true;
      camera?.stop?.();
      hands?.close?.();
    };
  }, [onReady, onResults]);

  return (
    <video
      ref={videoRef}
      className="absolute opacity-0 pointer-events-none"
      playsInline
      muted
      autoPlay
      width={640}
      height={360}
    />
  );
}
