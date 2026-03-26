import React, { useState, useEffect } from 'react';
import { getAttendance } from '../services/api';
import { Clock, UserCheck, UserX, AlertCircle, RefreshCw } from 'lucide-react';

export default function AttendancePanel({ roomId }) {
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await getAttendance(roomId);
      setAttendance(res.data.attendance || []);
      setStats(res.data.stats || null);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchAttendance(); }, [roomId]);

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'present': return <UserCheck className="w-4 h-4 text-green-400" />;
      case 'partial': return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'absent': return <UserX className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-dark-400" />;
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'present': return 'text-green-400 bg-green-500/10';
      case 'partial': return 'text-yellow-400 bg-yellow-500/10';
      case 'absent': return 'text-red-400 bg-red-500/10';
      default: return 'text-dark-400 bg-dark-800';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      {stats && (
        <div className="p-4 border-b border-dark-800">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-green-500/10">
              <p className="text-lg font-bold text-green-400">{stats.present}</p>
              <p className="text-[10px] text-dark-400">Present</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-yellow-500/10">
              <p className="text-lg font-bold text-yellow-400">{stats.partial}</p>
              <p className="text-[10px] text-dark-400">Partial</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-500/10">
              <p className="text-lg font-bold text-red-400">{stats.absent}</p>
              <p className="text-[10px] text-dark-400">Absent</p>
            </div>
          </div>
          {stats.averageDuration > 0 && (
            <p className="text-xs text-dark-500 mt-2 text-center">
              Avg duration: {formatDuration(stats.averageDuration)}
            </p>
          )}
        </div>
      )}

      {/* Refresh */}
      <div className="px-4 pt-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-dark-400">Participants ({attendance.length})</h4>
        <button onClick={fetchAttendance} className="p-1.5 rounded-lg hover:bg-dark-700 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 text-dark-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {attendance.length === 0 ? (
          <div className="text-center text-dark-500 text-sm py-8">No attendance data yet</div>
        ) : (
          attendance.map((a, i) => (
            <div key={a._id || i} className="flex items-center justify-between p-3 rounded-xl glass-light">
              <div className="flex items-center gap-3">
                {statusIcon(a.status)}
                <div>
                  <p className="text-sm font-medium">{a.userName}{a.isGuest ? ' (Guest)' : ''}</p>
                  <p className="text-xs text-dark-500">
                    Joined {new Date(a.joinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {a.leaveTime && ` — Left ${new Date(a.leaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColor(a.status)}`}>
                  {a.status}
                </span>
                <p className="text-xs text-dark-500 mt-0.5">{formatDuration(a.duration)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
