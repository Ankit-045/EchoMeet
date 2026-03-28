import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { joinRoom, endRoom as endRoomApi, generateSummary } from '../services/api';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import { Room, RoomEvent } from 'livekit-client';
import toast from 'react-hot-toast';
import ChatPanel from '../components/ChatPanel';
import HandRaisePanel from '../components/HandRaisePanel';
import AttendancePanel from '../components/AttendancePanel';
import SummaryPanel from '../components/SummaryPanel';
import AirDrawingOverlay from '../components/AirDrawingOverlay';
import {
  MessageSquare, Hand, Users, Brain, Pencil, X, Copy, Settings,
  LogOut, Monitor, UserCheck, ChevronRight
} from 'lucide-react';

// --- Error Boundary for LiveKit ---
class LiveKitErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('LiveKit Error Boundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center p-6">
            <X className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Video Error</h3>
            <p className="text-dark-400 text-sm mb-4">{this.state.error?.message || 'Something went wrong with the video connection.'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm font-medium transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MeetingRoom() {
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [livekitToken, setLivekitToken] = useState(null);
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [participantId, setParticipantId] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Panel states
  const [activePanel, setActivePanel] = useState(null);
  const [drawingActive, setDrawingActive] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);

  // Transcript state
  const transcriptRef = useRef('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isTranscribingRef = useRef(false); // ref version to avoid stale closures
  const recognitionRef = useRef(null);

  // --- Create a STABLE Room instance that survives React re-renders ---
  const roomInstance = useMemo(() => {
    return new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      videoCaptureDefaults: {
        resolution: { width: 640, height: 480, frameRate: 24 },
      },
      disconnectOnPageLeave: true,
    });
  }, []);

  // Cleanup room instance on unmount
  useEffect(() => {
    return () => {
      roomInstance.disconnect().catch(() => { });
    };
  }, [roomInstance]);

  // Join room on mount — wait for auth to resolve first
  useEffect(() => {
    if (authLoading) return;

    const join = async () => {
      try {
        const res = await joinRoom(roomId, { guestName: user?.name || 'Guest' });
        if (!res.data.livekitToken) {
          setError('Video token not received. LiveKit may be misconfigured.');
          setLoading(false);
          return;
        }
        setLivekitToken(res.data.livekitToken);
        setRoom(res.data.room);
        setIsHost(res.data.isHost);
        setParticipantId(res.data.participantId);
        setParticipantName(res.data.participantName);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to join meeting');
        setLoading(false);
      }
    };
    join();
  }, [roomId, authLoading]);

  // Socket events + reconnect re-join
  useEffect(() => {
    if (!socket || !participantId) return;

    const isGuestParticipant = participantId.startsWith('guest_');

    const emitJoin = () => {
      socket.emit('room:join', {
        roomId,
        userId: participantId,
        userName: participantName,
        isGuest: isGuestParticipant
      });
    };

    // Join the room immediately
    emitJoin();

    // Re-join on socket reconnect so server participant tracking stays accurate
    socket.on('connect', emitJoin);

    socket.on('room:participant-count', (count) => setParticipantCount(count));
    socket.on('meeting:ended', () => {
      toast('Meeting ended by host', { icon: '👋' });
      navigate('/dashboard');
    });

    return () => {
      socket.emit('room:leave', { roomId, userId: participantId, userName: participantName });
      socket.off('connect', emitJoin);
      socket.off('room:participant-count');
      socket.off('meeting:ended');
    };
  }, [socket, roomId, participantId, participantName, navigate]);

  // Speech-to-text (fixed closure bug)
  const toggleTranscription = useCallback(() => {
    if (isTranscribing) {
      recognitionRef.current?.stop();
      setIsTranscribing(false);
      isTranscribingRef.current = false;
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + '. ';
        }
      }
      if (finalTranscript) {
        transcriptRef.current += `${participantName}: ${finalTranscript}\n`;
        socket?.emit('transcript:chunk', {
          roomId,
          text: finalTranscript,
          speaker: participantName
        });
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        console.error('Speech recognition error:', e.error);
      }
    };

    recognition.onend = () => {
      // Use ref to check current state — avoids stale closure over isTranscribing
      if (isTranscribingRef.current) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsTranscribing(true);
    isTranscribingRef.current = true;
    toast.success('Transcription started');
  }, [isTranscribing, participantName, socket, roomId]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      isTranscribingRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  const handleEndMeeting = async () => {
    if (!window.confirm('End meeting for all participants?')) return;
    try {
      await endRoomApi(roomId);
      toast.success('Meeting ended');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to end meeting');
    }
  };

  const handleGenerateSummary = async () => {
    const transcript = transcriptRef.current;
    if (!transcript || transcript.trim().length < 10) {
      return toast.error('Not enough transcript data. Enable transcription first.');
    }
    try {
      await generateSummary({
        roomId,
        roomName: room?.name,
        transcript,
        participantCount,
        duration: room ? Math.floor((Date.now() - new Date(room.startedAt)) / 1000) : 0
      });
      toast.success('Summary generated!');
      setActivePanel('summary');
    } catch (err) {
      toast.error('Failed to generate summary');
    }
  };

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}`);
    toast.success('Meeting link copied!');
  };

  const togglePanel = (panel) => setActivePanel(prev => prev === panel ? null : panel);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-dark-400">Joining meeting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <X className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Cannot Join Meeting</h2>
          <p className="text-dark-400 mb-6">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-medium transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <div className="h-screen bg-dark-950 flex flex-col protected-content">
      {/* Top Bar */}
      <div className="glass px-4 py-2 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold gradient-text text-lg">{room?.name || 'Meeting'}</span>
          <span className="px-2 py-0.5 rounded-full bg-dark-800 text-xs font-mono text-dark-400">{roomId}</span>
          <button onClick={copyMeetingLink} className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors" title="Copy link">
            <Copy className="w-4 h-4 text-dark-400" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-dark-400 mr-2">
            <Users className="w-4 h-4" /> {participantCount}
          </span>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${isTranscribing ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-dark-800 text-dark-500'}`}>
            {isTranscribing ? '● REC' : '○ REC'}
          </div>
          {isHost && (
            <button onClick={handleEndMeeting} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-1">
              <LogOut className="w-3.5 h-3.5" /> End
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 relative">
          {livekitToken ? (
            <LiveKitErrorBoundary>
              <LiveKitRoom
                room={roomInstance}
                serverUrl={LIVEKIT_URL}
                token={livekitToken}
                connect={true}
                video={true}
                audio={true}
                data-lk-theme="default"
                style={{ height: '100%' }}
                onConnected={() => {
                  console.log('✅ LiveKit connected to room:', roomId);
                }}
                onDisconnected={() => {
                  console.log('❌ LiveKit disconnected from room:', roomId);
                }}
                onError={(error) => {
                  console.error('LiveKit connection error:', error);
                  toast.error(`Video error: ${error.message}`);
                }}
              >
                <VideoConference />
                <RoomAudioRenderer />
              </LiveKitRoom>
            </LiveKitErrorBoundary>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-dark-400">Connecting to video...</p>
            </div>
          )}

          {/* Air Drawing Overlay */}
          {drawingActive && (
            <AirDrawingOverlay
              roomId={roomId}
              socket={socket}
              onClose={() => setDrawingActive(false)}
            />
          )}
        </div>

        {/* Side Panel */}
        {activePanel && (
          <div className="w-80 lg:w-96 glass border-l border-dark-800 flex flex-col animate-slide-in-right shrink-0">
            <div className="px-4 py-3 border-b border-dark-800 flex items-center justify-between">
              <h3 className="font-semibold capitalize">{activePanel}</h3>
              <button onClick={() => setActivePanel(null)} className="p-1 rounded hover:bg-dark-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activePanel === 'chat' && (
                <ChatPanel roomId={roomId} userId={participantId} userName={participantName} socket={socket} />
              )}
              {activePanel === 'hand' && (
                <HandRaisePanel roomId={roomId} userId={participantId} userName={participantName} isHost={isHost} socket={socket} />
              )}
              {activePanel === 'attendance' && (
                <AttendancePanel roomId={roomId} />
              )}
              {activePanel === 'summary' && (
                <SummaryPanel roomId={roomId} onGenerate={handleGenerateSummary} transcript={transcriptRef.current} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="glass px-4 py-2 flex items-center justify-center gap-2 shrink-0 z-50">
        <ToolButton icon={MessageSquare} label="Chat" active={activePanel === 'chat'} onClick={() => togglePanel('chat')} />
        <ToolButton icon={Hand} label="Raise Hand" active={activePanel === 'hand'} onClick={() => togglePanel('hand')} />
        <ToolButton icon={UserCheck} label="Attendance" active={activePanel === 'attendance'} onClick={() => togglePanel('attendance')} />
        <ToolButton
          icon={Brain}
          label={isTranscribing ? 'Stop Rec' : 'Start Rec'}
          active={isTranscribing}
          onClick={toggleTranscription}
          variant={isTranscribing ? 'danger' : 'default'}
        />
        <ToolButton icon={Brain} label="Summary" active={activePanel === 'summary'} onClick={() => togglePanel('summary')} />
        <ToolButton
          icon={Pencil}
          label="Air Draw"
          active={drawingActive}
          onClick={() => setDrawingActive(!drawingActive)}
        />
      </div>
    </div>
  );
}

function ToolButton({ icon: Icon, label, active, onClick, variant = 'default' }) {
  const variants = {
    default: active ? 'bg-primary-500/20 text-primary-400 border-primary-500/30' : 'text-dark-400 hover:text-white hover:bg-dark-800 border-transparent',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30'
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 ${variants[variant]}`}
      title={label}
    >
      <Icon className="w-5 h-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
