import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { GESTURES } from "@features/drawing/modules/gestureController";
import { CONTROL_GESTURES } from "@features/drawing/modules/gestureInterpreter";
import { StrokeManager } from "@features/drawing/modules/strokeManager";
import { DrawingEngine } from "@features/drawing/modules/drawingEngine";
import { TransformEngine } from "@features/drawing/modules/transformEngine";

function toScreenPoint(landmark, width, height) {
  return {
    x: (1 - landmark.x) * width,
    y: landmark.y * height,
  };
}

const DrawingCanvas = forwardRef(function DrawingCanvas(
  { parsedGesture, settings, syncService, onStatus, cameraVisible = true },
  ref,
) {
  const cameraCanvasRef = useRef(null);
  const drawCanvasRef = useRef(null);

  const strokeManagerRef = useRef(new StrokeManager());
  const drawingEngineRef = useRef(null);
  const transformEngineRef = useRef(null);
  const controlGestureRef = useRef("CTRL_IDLE");

  const currentStrokeIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const appendBufferRef = useRef([]);
  const appendEmitAtRef = useRef(0);
  const transformEmitAtRef = useRef(0);

  useImperativeHandle(ref, () => ({
    drawCameraFrame(resultsImage) {
      const canvas = cameraCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !resultsImage) return;

      if (!cameraVisible) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(resultsImage, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
    applySyncEvent(type, payload) {
      if (type === "state") {
        strokeManagerRef.current.clear();
        (payload?.strokes || []).forEach((stroke) =>
          strokeManagerRef.current.upsertStroke(stroke),
        );
        return;
      }
      if (type === "stroke:start" && payload?.stroke) {
        strokeManagerRef.current.upsertStroke(payload.stroke);
        return;
      }
      if (type === "stroke:append") {
        strokeManagerRef.current.appendPoints(
          payload?.strokeId,
          payload?.points || [],
        );
        return;
      }
      if (
        type === "stroke:transform" &&
        payload?.strokeId &&
        payload?.transform
      ) {
        const local = strokeManagerRef.current.getStroke(payload.strokeId);
        if (local) local.transform = payload.transform;
        return;
      }
      if (type === "stroke:erase") {
        strokeManagerRef.current.removeMany(payload?.strokeIds || []);
        return;
      }
      if (type === "clear") {
        strokeManagerRef.current.clear();
      }
    },
    clearAll() {
      strokeManagerRef.current.clear();
    },
    undo() {
      strokeManagerRef.current.undo();
    },
    redo() {
      strokeManagerRef.current.redo();
    },
    save() {
      const canvas = drawCanvasRef.current;
      return canvas ? canvas.toDataURL("image/png") : null;
    },
  }));

  useEffect(() => {
    const drawCanvas = drawCanvasRef.current;
    const cameraCanvas = cameraCanvasRef.current;
    if (!drawCanvas || !cameraCanvas) return;

    drawingEngineRef.current = new DrawingEngine(drawCanvas);
    transformEngineRef.current = new TransformEngine(strokeManagerRef.current);

    const resize = () => {
      drawingEngineRef.current?.resize(window.innerWidth, window.innerHeight);
      cameraCanvas.width = window.innerWidth;
      cameraCanvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const render = () => {
      const selectedStrokeId =
        transformEngineRef.current?.selectedStrokeId || null;
      drawingEngineRef.current?.draw(
        strokeManagerRef.current.getAll(),
        null,
        selectedStrokeId,
        controlGestureRef.current,
      );
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    controlGestureRef.current =
      parsedGesture?.secondary?.gesture || "CTRL_IDLE";
  }, [parsedGesture]);

  useEffect(() => {
    if (!parsedGesture) return;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const flushAppendBuffer = (force = false) => {
      const now = Date.now();
      if (!force && now - appendEmitAtRef.current < 24) return;
      if (!currentStrokeIdRef.current || appendBufferRef.current.length === 0)
        return;

      const payloadPoints = appendBufferRef.current.splice(
        0,
        appendBufferRef.current.length,
      );
      appendEmitAtRef.current = now;
      syncService?.appendStroke(currentStrokeIdRef.current, payloadPoints);
    };

    const endStroke = () => {
      flushAppendBuffer(true);
      if (currentStrokeIdRef.current) {
        syncService?.endStroke(currentStrokeIdRef.current);
      }
      currentStrokeIdRef.current = null;
      lastPointRef.current = null;
      appendBufferRef.current = [];
    };

    const primary = parsedGesture.primary;
    if (primary.gesture === GESTURES.DRAW && primary.landmark) {
      const point = toScreenPoint(primary.landmark, width, height);

      if (!currentStrokeIdRef.current) {
        const strokeId = syncService?.createStrokeId() || `local-${Date.now()}`;
        currentStrokeIdRef.current = strokeId;
        lastPointRef.current = point;

        const stroke = {
          id: strokeId,
          ownerId: syncService?.userId,
          color: settings.color,
          lineWidth: settings.lineWidth,
          glowIntensity: settings.glowIntensity || 12,
          points: [point],
          transform: { tx: 0, ty: 0, scale: 1, rotation: 0 },
        };

        strokeManagerRef.current.upsertStroke(stroke);
        syncService?.startStroke(stroke);
      } else {
        const prev = lastPointRef.current;
        const smooth = {
          x: prev.x * 0.2 + point.x * 0.8,
          y: prev.y * 0.2 + point.y * 0.8,
        };

        strokeManagerRef.current.appendPoints(currentStrokeIdRef.current, [
          smooth,
        ]);
        appendBufferRef.current.push(smooth);
        lastPointRef.current = smooth;
        flushAppendBuffer(false);
      }

      onStatus?.("Drawing");
    } else if (primary.gesture === GESTURES.ERASE && primary.landmark) {
      endStroke();
      const point = toScreenPoint(primary.landmark, width, height);
      const hitIds = strokeManagerRef.current.findIntersectingStrokeIds(
        point.x,
        point.y,
        28,
      );
      if (hitIds.length) {
        strokeManagerRef.current.removeMany(hitIds);
        syncService?.eraseStrokes(hitIds);
      }
      onStatus?.("Erasing");
    } else if (primary.gesture === GESTURES.CLEAR) {
      endStroke();
      strokeManagerRef.current.clear();
      syncService?.clear();
      onStatus?.("Clearing");
    } else {
      endStroke();
      onStatus?.("Idle");
    }

    const secondary = parsedGesture.secondary;
    if (!secondary?.landmark || secondary.gesture === CONTROL_GESTURES.IDLE) {
      transformEngineRef.current?.releaseAll();
      return;
    }

    const pointer = toScreenPoint(secondary.landmark, width, height);
    let updatedStroke = null;

    if (secondary.gesture === CONTROL_GESTURES.MOVE) {
      updatedStroke =
        transformEngineRef.current?.handleMove(pointer.x, pointer.y) || null;
    } else if (secondary.gesture === CONTROL_GESTURES.SCALE) {
      transformEngineRef.current?.selectNearest(pointer.x, pointer.y);
      updatedStroke =
        transformEngineRef.current?.handleScale(secondary.pinchDelta) || null;
    } else if (secondary.gesture === CONTROL_GESTURES.ROTATE) {
      transformEngineRef.current?.selectNearest(pointer.x, pointer.y);
      updatedStroke =
        transformEngineRef.current?.handleRotate(secondary.angleDelta) || null;
    }

    if (updatedStroke) {
      const now = Date.now();
      if (now - transformEmitAtRef.current >= 40) {
        transformEmitAtRef.current = now;
        syncService?.transformStroke(updatedStroke);
      }
    }
  }, [onStatus, parsedGesture, settings, syncService]);

  return (
    <>
      <canvas
        ref={cameraCanvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </>
  );
});

export default DrawingCanvas;
