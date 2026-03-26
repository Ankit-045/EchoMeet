import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRoom, getMyMeetings } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Video, LogOut, Clock, Users, Copy, ExternalLink } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await getMyMeetings();
      setMeetings(res.data.meetings || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await createRoom({ name: roomName || undefined });
      toast.success('Meeting created!');
      navigate(`/meeting/${res.data.room.roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return toast.error('Enter a meeting code');
    navigate(`/join/${joinCode.trim().toUpperCase()}`);
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const copyLink = (roomId) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}`);
    toast.success('Link copied!');
  };

  return (
    <div className="min-h-screen bg-dark-950 protected-content">
      {/* Top Bar */}
      <nav className="glass px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">EchoMeet</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass-light">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
          </div>
          <button onClick={handleLogout} className="p-2.5 rounded-xl hover:bg-dark-800 transition-colors" title="Logout">
            <LogOut className="w-5 h-5 text-dark-400" />
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Create Meeting */}
          <div className="glass rounded-2xl p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-400" /> New Meeting
            </h2>
            {showCreate ? (
              <div className="space-y-3">
                <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Meeting name (optional)"
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors" />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-semibold transition-all disabled:opacity-50">
                    {loading ? 'Creating...' : 'Start Meeting'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-3 glass-light rounded-xl hover:bg-dark-700 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCreate(true)}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-semibold text-lg transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25 flex items-center justify-center gap-2">
                <Video className="w-5 h-5" /> Start Instant Meeting
              </button>
            )}
          </div>

          {/* Join Meeting */}
          <div className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-accent-400" /> Join Meeting
            </h2>
            <div className="space-y-3">
              <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter meeting code"
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors uppercase tracking-widest text-center text-lg font-mono" maxLength={8} />
              <button onClick={handleJoin}
                className="w-full py-3 glass-light hover:bg-dark-700 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                Join <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Meeting History */}
        <div className="animate-slide-up">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary-400" /> Your Meetings
          </h2>
          {meetings.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Video className="w-16 h-16 text-dark-600 mx-auto mb-4" />
              <p className="text-dark-400 text-lg">No meetings yet. Create your first one!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {meetings.map(m => (
                <div key={m._id} className="glass rounded-xl p-5 hover:border-primary-500/30 transition-all duration-200 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${m.isActive ? 'bg-green-400 animate-pulse' : 'bg-dark-600'}`}></div>
                    <div>
                      <h3 className="font-semibold text-lg">{m.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-dark-400 mt-1">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {m.participants?.length || 0}</span>
                        <span>{new Date(m.startedAt).toLocaleDateString()} {new Date(m.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-mono text-xs text-dark-500">{m.roomId}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => copyLink(m.roomId)} className="p-2 rounded-lg hover:bg-dark-700 transition-colors" title="Copy link">
                      <Copy className="w-4 h-4 text-dark-400" />
                    </button>
                    {m.isActive && (
                      <button onClick={() => navigate(`/meeting/${m.roomId}`)} className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm font-medium transition-colors">
                        Rejoin
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
