import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import {
  endRoom as endRoomApi,
  generateSummary,
  startAttendance as startAttendanceApi,
} from "@/services/api";
import { useJoinRoom } from "@features/meeting/hooks/useJoinRoom";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import { useLiveKitRoom } from "@features/meeting/hooks/useLiveKitRoom";
import { useSpeechTranscription } from "@features/meeting/hooks/useSpeechTranscription";
import toast from "react-hot-toast";
import { useRoomSocketPresence } from "@features/meeting/hooks/useRoomSocketPresence";
import { MeetingShareActions } from "@features/meeting/share";
import ChatPanel from "@features/chat/components/ChatPanel";
import HandRaisePanel from "@features/handraise/components/HandRaisePanel";
import SummaryPanel from "@features/summary/components/SummaryPanel";
import AirDrawingOverlay from "@features/drawing/components/AirDrawingOverlay";
import FeedbackModal from "@features/meeting/components/FeedbackModal";
import {
  MessageSquare,
  Hand,
  Users,
  Brain,
  Pencil,
  X,
  LogOut,
  User,
  Clock,
} from "lucide-react";

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
    console.error("LiveKit Error Boundary:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center p-6">
            <X className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Video Error</h3>
            <p className="text-dark-400 text-sm mb-4">
              {this.state.error?.message ||
                "Something went wrong with the video connection."}
            </p>
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

export default function MeetingRoomPage() {
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const {
    livekitToken,
    room,
    isHost,
    participantId,
    participantName,
    loading,
    error,
    isWaiting,
    isDenied,
    isNotStarted,
    scheduledAt,
    setIsWaiting,
    setIsDenied,
  } = useJoinRoom({ roomId, user, authLoading });
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // Panel states
  const [activePanel, setActivePanel] = useState(null);
  const [drawingActive, setDrawingActive] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [attendanceStarted, setAttendanceStarted] = useState(
    Boolean(room?.attendanceStartedAt),
  );
  const [showFeedback, setShowFeedback] = useState(false);

  const { roomInstance } = useLiveKitRoom();

  React.useEffect(() => {
    setAttendanceStarted(Boolean(room?.attendanceStartedAt));
  }, [room?.attendanceStartedAt]);
  const { transcriptRef, isTranscribing, toggleTranscription } =
    useSpeechTranscription({
      roomId,
      participantName,
      socket,
    });

  useRoomSocketPresence({
    socket,
    roomId,
    participantId,
    participantName,
    isHost,
    isWaiting,
    setParticipantCount,
    setPendingApprovals,
    setIsWaiting,
    setIsDenied,
    navigate,
    onMeetingEnd: () => setShowFeedback(true),
  });

  const handleEndMeeting = async () => {
    if (!window.confirm("End meeting for all participants?")) return;
    try {
      await endRoomApi(roomId);
      toast.success("Meeting ended");
      setShowFeedback(true);
    } catch (err) {
      toast.error("Failed to end meeting");
    }
  };

  const handleTakeAttendance = async () => {
    try {
      const res = await startAttendanceApi(roomId);
      setAttendanceStarted(true);
      toast.success(res.data?.message || "Attendance started");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start attendance");
    }
  };

  const handleGenerateSummary = async () => {
    const transcript = transcriptRef.current;
    if (!transcript || transcript.trim().length < 10) {
      return toast.error(
        "Not enough transcript data. Enable transcription first.",
      );
    }
    try {
      await generateSummary({
        roomId,
        roomName: room?.name,
        transcript,
        participantCount,
        duration: room
          ? Math.floor((Date.now() - new Date(room.startedAt)) / 1000)
          : 0,
      });
      toast.success("Summary generated!");
      setActivePanel("summary");
    } catch (err) {
      toast.error("Failed to generate summary");
    }
  };

  const handleApproveEntry = (p) => {
    socket?.emit("room:approve-entry", {
      roomId,
      userId: p.userId,
      socketId: p.socketId,
    });
    setPendingApprovals((prev) => prev.filter((u) => u.userId !== p.userId));
  };

  const handleDenyEntry = (p) => {
    socket?.emit("room:deny-entry", {
      roomId,
      userId: p.userId,
      socketId: p.socketId,
    });
    setPendingApprovals((prev) => prev.filter((u) => u.userId !== p.userId));
  };

  const togglePanel = (panel) =>
    setActivePanel((prev) => (prev === panel ? null : panel));

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
    const timeStr = scheduledAt
      ? scheduledAt.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const dateStr = scheduledAt ? scheduledAt.toLocaleDateString() : "";

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
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 bg-dark-800 hover:bg-dark-700 rounded-xl font-semibold transition-colors"
          >
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
          <p className="text-dark-400 mb-8">
            The host has been notified that you're waiting. Please hang tight!
          </p>
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-dark-500 hover:text-dark-300 transition-colors"
          >
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
          <p className="text-dark-400 mb-6">
            The host did not allow you to join this meeting.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-medium transition-colors"
          >
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
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";

  return (
    <div className="h-screen bg-dark-950 flex flex-col protected-content">
      {/* Top Bar */}
      <div className="glass px-4 py-2 flex items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold gradient-text text-lg">
            {room?.name || "Meeting"}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-dark-800 text-xs font-mono text-dark-400">
            {roomId}
          </span>
          <MeetingShareActions meetingId={roomId} compact />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm text-dark-400 mr-2">
            <Users className="w-4 h-4" /> {participantCount}
          </span>
          <button
            onClick={() => togglePanel("chat")}
            className={`p-2 rounded-lg transition-colors ${activePanel === "chat" ? "bg-primary-500/20 text-primary-400" : "hover:bg-dark-800 text-dark-400"}`}
            title="Chat"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => togglePanel("handraise")}
            className={`p-2 rounded-lg transition-colors ${activePanel === "handraise" ? "bg-accent-500/20 text-accent-400" : "hover:bg-dark-800 text-dark-400"}`}
            title="Hand Raise"
          >
            <Hand className="w-4 h-4" />
          </button>
          <button
            onClick={() => togglePanel("summary")}
            className={`p-2 rounded-lg transition-colors ${activePanel === "summary" ? "bg-green-500/20 text-green-400" : "hover:bg-dark-800 text-dark-400"}`}
            title="Summary"
          >
            <Brain className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDrawingActive(true)}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-dark-400"
            title="Air Drawing"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isHost && pendingApprovals.length > 0 && (
            <button
              onClick={() => togglePanel("waiting")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activePanel === "waiting" ? "bg-primary-500 text-white" : "bg-primary-500/20 text-primary-300"}`}
            >
              {pendingApprovals.length} waiting
            </button>
          )}
          {isHost && (
            <button
              onClick={handleTakeAttendance}
              disabled={attendanceStarted}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {attendanceStarted ? "Attendance Started" : "Take Attendance"}
            </button>
          )}
          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              End Meeting
            </button>
          )}
          <button
            onClick={toggleTranscription}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isTranscribing ? "bg-green-500/20 text-green-400" : "bg-dark-800 text-dark-400 hover:bg-dark-700"}`}
          >
            {isTranscribing ? "Transcribing" : "Transcribe"}
          </button>
          <button
            onClick={handleGenerateSummary}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-500/20 text-accent-400 hover:bg-accent-500/30 transition-colors"
          >
            Generate Summary
          </button>
          <button
            onClick={() => setShowFeedback(true)}
            className="p-2 rounded-lg hover:bg-dark-800 transition-colors text-dark-400"
            title="Leave"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <LiveKitErrorBoundary>
            <LiveKitRoom
              room={roomInstance}
              token={livekitToken}
              serverUrl={LIVEKIT_URL}
              data-lk-theme="default"
              className="w-full h-full"
            >
              <RoomAudioRenderer />
              <VideoConference />
            </LiveKitRoom>
          </LiveKitErrorBoundary>

          {drawingActive && (
            <AirDrawingOverlay
              roomId={roomId}
              socket={socket}
              userId={participantId}
              onClose={() => setDrawingActive(false)}
            />
          )}
        </div>

        {activePanel && (
          <div className="w-80 border-l border-dark-800 bg-dark-900/50">
            {activePanel === "chat" && (
              <ChatPanel
                roomId={roomId}
                userId={participantId}
                userName={participantName}
                socket={socket}
              />
            )}
            {activePanel === "handraise" && (
              <HandRaisePanel
                roomId={roomId}
                userId={participantId}
                userName={participantName}
                socket={socket}
              />
            )}
            {activePanel === "summary" && <SummaryPanel roomId={roomId} />}
            {activePanel === "waiting" && (
              <div className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-dark-300">
                  Waiting List
                </h3>
                {pendingApprovals.length === 0 ? (
                  <p className="text-sm text-dark-500">No one is waiting</p>
                ) : (
                  pendingApprovals.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between p-2 rounded-lg bg-dark-800"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.userName}</p>
                        <p className="text-xs text-dark-500">{p.userId}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveEntry(p)}
                          className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDenyEntry(p)}
                          className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-400"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <FeedbackModal 
        meetingId={roomId}
        isOpen={showFeedback}
        onClose={() => navigate("/dashboard")}
      />
    </div>
  );
}
