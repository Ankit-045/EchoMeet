import React, { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GestureInterpreter,
  CONTROL_GESTURES,
} from "@features/drawing/modules/gestureInterpreter";
import { RealtimeSyncService } from "@features/drawing/modules/realtimeSync";
import CameraView from "@features/drawing/components/CameraView";
import DrawingCanvas from "@features/drawing/components/DrawingCanvas";
import ControlPanel from "@features/drawing/components/ControlPanel";
import HelpPanel from "@features/drawing/components/HelpPanel";

export default function AirDrawingOverlay({
  roomId,
  socket,
  userId = "local",
  onClose,
}) {
  const drawingCanvasRef = useRef(null);
  const lastGestureAtRef = useRef(0);

  const [settings, setSettings] = useState({
    color: "#00ffff",
    lineWidth: 8,
    glowIntensity: 20,
  });
  const [isReady, setIsReady] = useState(false);
  const [readyError, setReadyError] = useState("");
  const [cameraKey, setCameraKey] = useState(0);
  const [status, setStatus] = useState("Idle");
  const [parsedGesture, setParsedGesture] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [gesturesEnabled, setGesturesEnabled] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const interpreter = useMemo(() => new GestureInterpreter(), []);

  const syncServiceRef = useRef(
    new RealtimeSyncService({
      socket,
      roomId,
      userId,
      onEvent: (type, payload) => {
        drawingCanvasRef.current?.applySyncEvent(type, payload);
      },
    }),
  );

  React.useEffect(() => {
    syncServiceRef.current.bind();
    return () => syncServiceRef.current.unbind();
  }, []);

  const handleResults = React.useCallback(
    (results) => {
      drawingCanvasRef.current?.drawCameraFrame(results?.image);
      if (!gesturesEnabled) {
        setParsedGesture(null);
        setStatus("Idle");
        return;
      }
      const now = performance.now();
      if (now - lastGestureAtRef.current < 33) return;
      lastGestureAtRef.current = now;
      setParsedGesture(interpreter.interpret(results));
    },
    [gesturesEnabled, interpreter],
  );

  const handleReady = React.useCallback((ready) => {
    if (ready) {
      setIsReady(true);
      setReadyError("");
      return;
    }
    setIsReady(false);
  }, []);

  const handleCameraError = React.useCallback((message) => {
    setIsReady(false);
    setReadyError(message || "Unable to start camera.");
  }, []);

  const handleClear = () => {
    drawingCanvasRef.current?.clearAll();
    syncServiceRef.current.clear();
  };

  const handleSave = () => {
    const dataUrl = drawingCanvasRef.current?.save();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `air-drawing-${Date.now()}.png`;
    link.click();
  };

  const activeMode = parsedGesture?.secondary?.gesture
    ? parsedGesture.secondary.gesture.replace("CTRL_", "")
    : parsedGesture?.primary?.gesture || "IDLE";

  return (
    <div className="absolute inset-0 z-50 bg-dark-950/85 flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2 glass shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold gradient-text">
            Air Drawing
          </span>
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${status !== "Idle" ? "bg-green-500/20 text-green-400" : "bg-dark-800 text-dark-500"}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${status !== "Idle" ? "bg-green-400 animate-pulse" : "bg-dark-600"}`}
            ></span>
            {status}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-dark-700 rounded-lg transition-colors"
          title="Close"
        >
          <X className="w-4 h-4 text-dark-400" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <CameraView
          key={`camera-${cameraKey}`}
          onResults={handleResults}
          onReady={handleReady}
          onError={handleCameraError}
        />
        <DrawingCanvas
          ref={drawingCanvasRef}
          parsedGesture={parsedGesture}
          settings={settings}
          syncService={syncServiceRef.current}
          onStatus={setStatus}
          cameraVisible={cameraVisible}
        />

        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-950/80">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-dark-300">
                {readyError || "Loading AirDrawer engine..."}
              </p>
              {readyError && (
                <button
                  className="mt-3 px-3 py-1.5 text-xs rounded-md bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 transition"
                  onClick={() => {
                    setReadyError("");
                    setCameraKey((value) => value + 1);
                  }}
                >
                  Retry camera
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 text-center text-xs text-dark-500 shrink-0">
        Primary hand: point to draw, pinch to erase, fist to clear. Secondary
        hand: two-finger move, pinch scale, open palm rotate.
      </div>

      <ControlPanel
        settings={settings}
        onSettingsChange={(next) =>
          setSettings((prev) => ({ ...prev, ...next }))
        }
        onClear={handleClear}
        onUndo={() => drawingCanvasRef.current?.undo()}
        onRedo={() => drawingCanvasRef.current?.redo()}
        onSave={handleSave}
        onToggleCamera={() => setCameraVisible((prev) => !prev)}
        cameraVisible={cameraVisible}
        gestureVisible={gesturesEnabled}
        onToggleGestures={() => setGesturesEnabled((prev) => !prev)}
        onHelp={() => setIsHelpOpen(true)}
      />

      <HelpPanel isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <AnimatePresence>
        {activeMode !== "IDLE" && activeMode !== CONTROL_GESTURES.IDLE && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="gesture-status glass-meta"
          >
            {activeMode} MODE
          </motion.div>
        )}
      </AnimatePresence>

      {(parsedGesture?.primary?.fingertips || []).map((tip, i) => {
        if (!tip) return null;
        const x = (1 - tip.x) * window.innerWidth;
        const y = tip.y * window.innerHeight;
        const gesture = parsedGesture?.primary?.gesture;

        let size = "10px";
        let opacity = 0.6;
        let color = settings.color;
        let shadow = `0 0 10px 2px ${color}`;

        if (i === 1) {
          if (gesture === "ERASE") {
            size = "60px";
            color = "transparent";
            shadow =
              "0 0 15px 4px rgba(255, 0, 0, 0.8), inset 0 0 10px 2px rgba(255, 0, 0, 0.5)";
            opacity = 1;
          } else {
            size = "16px";
            opacity = 1;
            shadow = `0 0 15px 4px ${settings.color}`;
          }
        }

        return (
          <div
            key={`p-${i}`}
            style={{
              position: "fixed",
              left: x,
              top: y,
              width: size,
              height: size,
              backgroundColor: color,
              border:
                gesture === "ERASE"
                  ? "2px solid rgba(255, 50, 50, 0.8)"
                  : "none",
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              boxShadow: shadow,
              opacity,
              zIndex: 40,
              pointerEvents: "none",
              transition: "width 0.1s, height 0.1s",
            }}
          />
        );
      })}

      {(parsedGesture?.secondary?.fingertips || []).map((tip, i) => {
        if (!tip) return null;
        const x = (1 - tip.x) * window.innerWidth;
        const y = tip.y * window.innerHeight;

        let size = "10px";
        let opacity = 0.5;
        let color = "transparent";
        let shadow = "0 0 8px 2px rgba(255, 165, 0, 0.5)";
        let border = "1.5px solid rgba(255, 165, 0, 0.6)";

        if (i === 1) {
          size = "18px";
          opacity = 1;
          if (parsedGesture?.secondary?.gesture === CONTROL_GESTURES.MOVE) {
            shadow = "0 0 20px 4px rgba(100, 180, 255, 0.8)";
            border = "2px solid rgba(100, 180, 255, 0.8)";
          } else if (
            parsedGesture?.secondary?.gesture === CONTROL_GESTURES.SCALE
          ) {
            shadow = "0 0 20px 4px rgba(0, 255, 200, 0.8)";
            border = "2px solid rgba(0, 255, 200, 0.8)";
          } else if (
            parsedGesture?.secondary?.gesture === CONTROL_GESTURES.ROTATE
          ) {
            shadow = "0 0 20px 4px rgba(255, 165, 0, 0.8)";
            border = "2px solid rgba(255, 165, 0, 0.8)";
          }
        }

        return (
          <div
            key={`s-${i}`}
            style={{
              position: "fixed",
              left: x,
              top: y,
              width: size,
              height: size,
              backgroundColor: color,
              border,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              boxShadow: shadow,
              opacity,
              zIndex: 40,
              pointerEvents: "none",
              transition: "width 0.1s, height 0.1s",
            }}
          />
        );
      })}

      {!parsedGesture?.primary?.landmark &&
        !parsedGesture?.secondary?.landmark && (
          <div className="overlay-message">
            {isReady
              ? "No hands detected. Keep your hand within the camera frame."
              : "Raise your hand to start drawing"}
          </div>
        )}
    </div>
  );
}
