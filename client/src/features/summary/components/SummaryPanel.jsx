import React, { useState, useEffect } from "react";
import { getSummaries } from "@/services/api";
import { Brain, FileText, ListChecks, Target, RefreshCw } from "lucide-react";

export default function SummaryPanel({ roomId, onGenerate, transcript }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const res = await getSummaries(roomId);
      setSummaries(res.data.summaries || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSummaries();
  }, [roomId]);

  const handleGenerate = async () => {
    setGenerating(true);
    await onGenerate();
    await fetchSummaries();
    setGenerating(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Generate button */}
      <div className="p-4 border-b border-dark-800 space-y-2">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {generating ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <Brain className="w-5 h-5" /> Generate AI Summary
            </>
          )}
        </button>
        {transcript && (
          <p className="text-xs text-dark-500 text-center">
            Transcript: {transcript.length} chars captured
          </p>
        )}
      </div>

      {/* Summaries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 text-dark-500 animate-spin mx-auto" />
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center text-dark-500 text-sm py-8">
            <Brain className="w-12 h-12 mx-auto mb-3 text-dark-600" />
            <p>No summaries yet</p>
            <p className="text-xs mt-1">
              Start recording, then generate a summary
            </p>
          </div>
        ) : (
          summaries.map((s, i) => (
            <div
              key={s._id || i}
              className="glass-light rounded-xl p-4 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-dark-500">
                  {new Date(s.generatedAt).toLocaleString()}
                </span>
                {s.participantCount && (
                  <span className="text-xs text-dark-500">
                    {s.participantCount} participants
                  </span>
                )}
              </div>

              {/* Summary */}
              {s.summary && (
                <div>
                  <h4 className="text-xs font-medium text-dark-400 flex items-center gap-1 mb-1">
                    <FileText className="w-3 h-3" /> Summary
                  </h4>
                  <p className="text-sm text-dark-200 leading-relaxed">
                    {s.summary}
                  </p>
                </div>
              )}

              {/* Key Points */}
              {s.keyPoints?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-dark-400 flex items-center gap-1 mb-1">
                    <Target className="w-3 h-3" /> Key Points
                  </h4>
                  <ul className="space-y-1">
                    {s.keyPoints.map((kp, j) => (
                      <li
                        key={j}
                        className="text-sm text-dark-300 flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400 mt-1.5 shrink-0"></span>
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {s.actionItems?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-dark-400 flex items-center gap-1 mb-1">
                    <ListChecks className="w-3 h-3" /> Action Items
                  </h4>
                  <ul className="space-y-1">
                    {s.actionItems.map((ai, j) => (
                      <li
                        key={j}
                        className="text-sm text-dark-300 p-2 rounded-lg bg-dark-800/50"
                      >
                        <p>{ai.item}</p>
                        <div className="flex gap-3 mt-1 text-xs text-dark-500">
                          {ai.assignee && <span>👤 {ai.assignee}</span>}
                          {ai.deadline && <span>📅 {ai.deadline}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
