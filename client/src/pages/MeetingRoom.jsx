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
  LogOut, Monitor, UserCheck, ChevronRight, User, Clock
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
  const [isWaiting, setIsWaiting] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [isNotStarted, setIsNotStarted] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);

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

  const notifiedParticipantsRef = useRef(new Set());

  // Handle participant join/leave notifications
  useEffect(() => {
    if (!roomInstance) return;

    // Reset notified participants on new room instance or reconnection
    notifiedParticipantsRef.current.clear();

    const handleParticipantConnected = (participant) => {
      // Prevent duplicate notifications for the same session ID
      if (notifiedParticipantsRef.current.has(participant.sid)) return;
      notifiedParticipantsRef.current.add(participant.sid);

      const name = participant.name || participant.identity || 'Someone';
      toast.success(`${name} joined the meeting`, {
        position: 'top-right',
        duration: 3000,
      });
    };

    const handleParticipantDisconnected = (participant) => {
      // Remove from set when they leave so they can be notified if they rejoin with a new SID
      notifiedParticipantsRef.current.delete(participant.sid);

      const name = participant.name || participant.identity || 'Someone';
      toast(`${name} left the meeting`, {
        icon: '🏃',
        position: 'top-right',
        duration: 3000,
      });
    };

    roomInstance.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    roomInstance.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    console.log('✅ Room instance events initialized');
    return () => {
      roomInstance.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      roomInstance.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [roomInstance]);

  // Join room on mount — wait for auth to resolve first
  useEffect(() => {
    if (authLoading) return;

    const join = async () => {
      console.log(`🚀 Attempting to join room: ${roomId}`);
      try {
        const res = await joinRoom(roomId, { guestName: user?.name || 'Guest' });
        console.log('📥 Join response:', res.data);
        
        if (res.data?.requiresApproval) {
          console.log('🕒 Approval required, moving to waiting state');
          setIsWaiting(true);
          setParticipantId(res.data.participantId);
          setParticipantName(res.data.participantName);
          setLoading(false);
          return;
        }

        if (!res.data?.livekitToken) {
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
        console.log('✅ Joined successfully as', res.data.isHost ? 'Host' : 'Participant');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to join meeting');
        if (err.response?.status === 403) {
          if (err.response.data?.requiresApproval) {
            console.log('🕒 Approval required (403), moving to waiting state');
            const data = err.response.data;
            setIsWaiting(true);
            setParticipantId(data.participantId);
            setParticipantName(data.participantName);
            setLoading(false);
            return;
          }
          if (err.response.data?.notStarted) {
            console.log('🕒 Meeting not started yet');
            setIsNotStarted(true);
            setScheduledAt(new Date(err.response.data.scheduledAt));
            setLoading(false);
            return;
          }
        }
        setLoading(false);
      }
    };
    join();
  }, [roomId, authLoading]);

  // Socket events + reconnect re-join
  useEffect(() => {
    if (!socket || !participantId) return;

    const emitSocketActions = () => {
      if (!socket.connected) {
        console.warn('⚠️ Socket not connected, skipping emissions. Will re-emit on "connect".');
        return;
      }

      if (isWaiting) {
        console.log('🛎️ Knocking on room:', roomId);
        socket.emit('room:knock', { roomId, userId: participantId, userName: participantName });
      } else if (participantId) {
        console.log('🔗 Joining socket room:', roomId);
        socket.emit('room:join', {
          roomId,
          userId: participantId,
          userName: participantName,
          isGuest: participantId.startsWith('guest_')
        });

        if (isHost) {
          console.log('📋 Fetching waiting list for host');
          socket.emit('room:get-waiting-list', { roomId });
        }
      }
    };

    // Initial emit
    emitSocketActions();

    // Re-emit on socket reconnect
    socket.on('connect', () => {
      console.log('🔄 Socket reconnected, re-emitting actions...');
      emitSocketActions();
    });

    socket.on('room:participant-count', (count) => {
      console.log(`👥 Participant count: ${count}`);
      setParticipantCount(count);
    });

    socket.on('meeting:ended', () => {
      console.log('🏁 Meeting ended by host');
      toast('Meeting ended by host', { icon: '👋' });
      navigate('/dashboard');
    });

    // Handle entry approval/denial for knocking users
    if (isWaiting) {
      socket.on('room:entry-granted', () => {
        console.log('🎊 Entry granted! Reloading room...');
        setIsWaiting(false);
        window.location.reload(); 
      });

      socket.on('room:entry-denied', () => {
        console.log('🚫 Entry denied');
        setIsWaiting(false);
        setIsDenied(true);
      });
    }

    // Host handlers for knocking users
    if (isHost) {
      socket.on('room:waiting-list', (list) => {
        console.log('🕒 Waiting list received:', list);
        setPendingApprovals(list);
      });
      socket.on('room:request-entry', (data) => {
        console.log('🛎️ New knocking request:', data);
        setPendingApprovals(prev => {
          if (prev.find(u => u.userId === data.userId)) return prev;
          return [...prev, data];
        });
        toast(`${data.userName} is knocking...`, { icon: '🔔', position: 'top-right' });
      });
      socket.on('room:knock-cancelled', ({ userId }) => {
        console.log('❌ Knock cancelled by user:', userId);
        setPendingApprovals(prev => prev.filter(u => u.userId !== userId));
      });
    }

    return () => {
      console.log('🧹 Cleaning up socket effect for participant:', participantId);
      socket.emit('room:leave', { roomId, userId: participantId, userName: participantName });
      socket.off('connect');
      socket.off('room:participant-count');
      socket.off('meeting:ended');
      socket.off('room:entry-granted');
      socket.off('room:entry-denied');
      socket.off('room:waiting-list');
      socket.off('room:request-entry');
      socket.off('room:knock-cancelled');
    };
  }, [socket, roomId, participantId, participantName, navigate, isHost, isWaiting]);

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

  const handleApproveEntry = (p) => {
    socket?.emit('room:approve-entry', { roomId, userId: p.userId, socketId: p.socketId });
    setPendingApprovals(prev => prev.filter(u => u.userId !== p.userId));
  };

  const handleDenyEntry = (p) => {
    socket?.emit('room:deny-entry', { roomId, userId: p.userId, socketId: p.socketId });
    setPendingApprovals(prev => prev.filter(u => u.userId !== p.userId));
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

  if (isNotStarted) {
    const timeStr = scheduledAt ? scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const dateStr = scheduledAt ? scheduledAt.toLocaleDateString() : '';

    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-10 text-center max-w-md animate-fade-in">
          <div className="w-20 h-20 bg-accent-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-accent-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3">Not Started Yet</h2>
          <p className="text-dark-300 mb-2">This meeting is scheduled for:</p>
          <div className="bg-dark-800/50 rounded-xl p-4 mb-8">
            <p className="text-xl font-bold text-accent-400">{timeStr}</p>
            <p className="text-sm text-dark-400">{dateStr}</p>
          </div>
          <p className="text-dark-400 mb-8 text-sm">
            Please come back 5 minutes before the start time to join the room.
          </p>
          <button onClick={() => navigate('/dashboard')} className="w-full py-3 bg-dark-800 hover:bg-dark-700 rounded-xl font-semibold transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isWaiting) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-primary-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Waiting for Approval</h2>
          <p className="text-dark-400 mb-8">The host has been notified that you're waiting. Please hang tight!</p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
          <button onClick={() => navigate('/dashboard')} className="text-dark-500 hover:text-dark-300 transition-colors">
            Cancel and Return
          </button>
        </div>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <X className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Entry Denied</h2>
          <p className="text-dark-400 mb-6">The host did not allow you to join this meeting.</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-medium transition-colors">
            Back to Dashboard
          </button>
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
                  // Only redirect non-hosts. Hosts handle their own exit logic.
                  if (!isHost) {
                    navigate('/dashboard');
                  }
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

          {/* Host Approval Notifications */}
          {isHost && pendingApprovals.length > 0 && (
            <div className="absolute top-6 right-6 z-50 flex flex-col gap-3 max-w-sm animate-slide-in-right">
              {pendingApprovals.map(p => (
                <div key={p.userId} className="glass p-4 rounded-xl border-primary-500/30 shadow-2xl flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center font-bold text-primary-400">
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.userName} wants to join</p>
                      <p className="text-xs text-dark-400">Private Meeting</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveEntry(p)} className="flex-1 py-1.5 bg-primary-600 hover:bg-primary-500 rounded-lg text-xs font-semibold transition-colors">
                      Allow
                    </button>
                    <button onClick={() => handleDenyEntry(p)} className="flex-1 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-semibold transition-colors">
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
