import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Palette, Trash2, Minus, Plus } from 'lucide-react';

const COLORS = ['#818cf8', '#ef4444', '#22c55e', '#eab308', '#f97316', '#ec4899', '#ffffff'];

export default function AirDrawingOverlay({ roomId, socket, onClose }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const [color, setColor] = useState(COLORS[0]);
  const [thickness, setThickness] = useState(4);
  const [isTracking, setIsTracking] = useState(false);
  const [handsModule, setHandsModule] = useState(null);
  const lastPointRef = useRef(null);
  const animFrameRef = useRef(null);

  // Initialize MediaPipe Hands
  useEffect(() => {
    let hands = null;
    let camera = null;

    const initMediaPipe = async () => {
      try {
        // Dynamically import MediaPipe
        const handsLib = await import('@mediapipe/hands');
        const cameraLib = await import('@mediapipe/camera_utils');

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const drawCanvas = drawingCanvasRef.current;

        if (!video || !canvas || !drawCanvas) return;

        const ctx = canvas.getContext('2d');
        const drawCtx = drawCanvas.getContext('2d');

        // Set canvas sizes
        canvas.width = drawCanvas.width = 640;
        canvas.height = drawCanvas.height = 480;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';

        hands = new handsLib.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
          // Draw camera feed (mirrored)
          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const indexTip = landmarks[8]; // Index finger tip
            const indexDip = landmarks[6]; // Index finger DIP joint
            const middleTip = landmarks[12]; // Middle finger tip

            // Mirror x coordinate
            const x = (1 - indexTip.x) * drawCanvas.width;
            const y = indexTip.y * drawCanvas.height;

            // Check if index finger is extended (drawing mode)
            const indexExtended = indexTip.y < indexDip.y;
            // Check if middle finger is also extended (erase/pause mode)
            const middleExtended = middleTip.y < landmarks[10].y;

            // Draw finger position indicator on camera canvas
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = indexExtended && !middleExtended ? color : 'rgba(255,255,255,0.5)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (indexExtended && !middleExtended) {
              // Drawing mode - only index finger up
              if (lastPointRef.current) {
                drawCtx.strokeStyle = color;
                drawCtx.lineWidth = thickness;
                drawCtx.beginPath();
                drawCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
                drawCtx.lineTo(x, y);
                drawCtx.stroke();

                // Send drawing data via socket
                socket?.emit('drawing:data', {
                  roomId,
                  points: { from: lastPointRef.current, to: { x, y } },
                  color,
                  thickness,
                  userId: 'local'
                });
              }
              lastPointRef.current = { x, y };
              setIsTracking(true);
            } else {
              // Not drawing
              lastPointRef.current = null;
              setIsTracking(false);
            }
          } else {
            lastPointRef.current = null;
            setIsTracking(false);
          }
        });

        // Start camera
        camera = new cameraLib.Camera(video, {
          onFrame: async () => {
            await hands.send({ image: video });
          },
          width: 640,
          height: 480,
          facingMode: 'user'
        });

        await camera.start();
        setHandsModule(true);
      } catch (err) {
        console.error('MediaPipe init error:', err);
      }
    };

    initMediaPipe();

    return () => {
      if (camera) camera.stop?.();
      if (hands) hands.close?.();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Listen for remote drawing data
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDrawing = (data) => {
      const drawCanvas = drawingCanvasRef.current;
      if (!drawCanvas) return;
      const drawCtx = drawCanvas.getContext('2d');
      drawCtx.strokeStyle = data.color;
      drawCtx.lineWidth = data.thickness;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      drawCtx.beginPath();
      drawCtx.moveTo(data.points.from.x, data.points.from.y);
      drawCtx.lineTo(data.points.to.x, data.points.to.y);
      drawCtx.stroke();
    };

    const handleRemoteClear = () => {
      const drawCanvas = drawingCanvasRef.current;
      if (drawCanvas) {
        const drawCtx = drawCanvas.getContext('2d');
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      }
    };

    socket.on('drawing:data', handleRemoteDrawing);
    socket.on('drawing:clear', handleRemoteClear);

    return () => {
      socket.off('drawing:data', handleRemoteDrawing);
      socket.off('drawing:clear', handleRemoteClear);
    };
  }, [socket]);

  const clearCanvas = () => {
    const drawCanvas = drawingCanvasRef.current;
    if (drawCanvas) {
      const drawCtx = drawCanvas.getContext('2d');
      drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
      socket?.emit('drawing:clear', { roomId, userId: 'local' });
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-dark-950/95 flex flex-col animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 glass shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold gradient-text">Air Drawing</span>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${isTracking ? 'bg-green-500/20 text-green-400' : 'bg-dark-800 text-dark-500'}`}>
            <span className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-400 animate-pulse' : 'bg-dark-600'}`}></span>
            {isTracking ? 'Drawing' : 'Idle'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Colors */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg glass-light">
            <Palette className="w-3.5 h-3.5 text-dark-400 mr-1" />
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>

          {/* Thickness */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg glass-light">
            <button onClick={() => setThickness(Math.max(1, thickness - 1))} className="p-0.5 hover:bg-dark-700 rounded">
              <Minus className="w-3 h-3 text-dark-400" />
            </button>
            <span className="text-xs text-dark-300 w-4 text-center">{thickness}</span>
            <button onClick={() => setThickness(Math.min(20, thickness + 1))} className="p-0.5 hover:bg-dark-700 rounded">
              <Plus className="w-3 h-3 text-dark-400" />
            </button>
          </div>

          <button onClick={clearCanvas} className="p-1.5 hover:bg-dark-700 rounded-lg transition-colors" title="Clear">
            <Trash2 className="w-4 h-4 text-dark-400" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-700 rounded-lg transition-colors" title="Close">
            <X className="w-4 h-4 text-dark-400" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="relative rounded-2xl overflow-hidden border border-dark-700 shadow-2xl">
          {/* Hidden video element for camera feed */}
          <video ref={videoRef} className="hidden" playsInline />

          {/* Camera preview canvas */}
          <canvas ref={canvasRef} className="w-full max-w-2xl rounded-2xl" />

          {/* Drawing overlay canvas */}
          <canvas ref={drawingCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none" />
        </div>

        {!handsModule && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-950/80 rounded-2xl">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-dark-400">Loading hand tracking...</p>
              <p className="text-xs text-dark-600 mt-1">Powered by MediaPipe</p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 text-center text-xs text-dark-500 shrink-0">
        ☝️ Extend index finger to draw • ✌️ Extend two fingers to pause • ✊ Close fist to stop
      </div>
    </div>
  );
}
