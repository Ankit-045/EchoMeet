import React, { useState, useEffect } from "react";
import { Hand, Check, X } from "lucide-react";

export default function HandRaisePanel({
  roomId,
  userId,
  userName,
  isHost,
  socket,
}) {
  const [queue, setQueue] = useState([]);
  const [isRaised, setIsRaised] = useState(false);

  useEffect(() => {
    if (!socket) return;

    socket.on("hand-raise:queue", (q) => {
      setQueue(q);
      setIsRaised(q.some((h) => h.userId === userId));
    });

    socket.on("hand-raise:acknowledged", ({ userId: ackUserId }) => {
      if (ackUserId === userId) {
        setIsRaised(false);
      }
    });

    return () => {
      socket.off("hand-raise:queue");
      socket.off("hand-raise:acknowledged");
    };
  }, [socket, userId]);

  const toggleHand = () => {
    if (isRaised) {
      socket.emit("hand-raise:lower", { roomId, userId });
    } else {
      socket.emit("hand-raise:raise", { roomId, userId, userName });
    }
  };

  const acknowledgeHand = (targetUserId) => {
    socket.emit("hand-raise:acknowledge", { roomId, userId: targetUserId });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Raise/Lower button */}
      <div className="p-4 border-b border-dark-800">
        <button
          onClick={toggleHand}
          className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
            isRaised
              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30"
              : "bg-primary-600 hover:bg-primary-500 text-white"
          }`}
        >
          <Hand className={`w-5 h-5 ${isRaised ? "animate-wave" : ""}`} />
          {isRaised ? "Lower Hand" : "Raise Hand"}
        </button>
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="text-sm font-medium text-dark-400 mb-3">
          Queue ({queue.length})
        </h4>
        {queue.length === 0 ? (
          <div className="text-center text-dark-500 text-sm py-8">
            No hands raised
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((item, index) => (
              <div
                key={item.userId}
                className="flex items-center justify-between p-3 rounded-xl glass-light animate-slide-up"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.userName}</p>
                    <p className="text-xs text-dark-500">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                {isHost && (
                  <button
                    onClick={() => acknowledgeHand(item.userId)}
                    className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors"
                    title="Acknowledge"
                  >
                    <Check className="w-4 h-4 text-green-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
