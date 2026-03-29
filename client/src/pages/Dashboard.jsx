import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRoom, getMyMeetings, scheduleMeeting, deleteMeeting } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Video, LogOut, Clock, Users, Copy, ExternalLink, Calendar, Trash2, X } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scheduledMeetings, setScheduledMeetings] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  
  // Form states
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState('60');
  const [joinCode, setJoinCode] = useState('');

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await getMyMeetings();
      setScheduledMeetings(res.data.scheduled || []);
      setHistory(res.data.history || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await createRoom({ 
        name: roomName || undefined,
        settings: { isPrivate }
      });
      toast.success('Meeting created!');
      navigate(`/meeting/${res.data.room.roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleTitle || !scheduleDate || !scheduleTime) {
      return toast.error('Please fill in all fields');
    }
    
    setLoading(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
      await scheduleMeeting({
        title: scheduleTitle,
        scheduledAt,
        duration: parseInt(scheduleDuration),
        isPrivate
      });
      toast.success('Meeting scheduled!');
      setShowSchedule(false);
      setScheduleTitle('');
      fetchMeetings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to schedule meeting');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      await deleteMeeting(id);
      toast.success('Meeting cancelled');
      fetchMeetings();
    } catch (err) {
      toast.error('Failed to cancel meeting');
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

  const isJoinable = (scheduledAt) => {
    const now = new Date();
    const start = new Date(scheduledAt);
    return now >= new Date(start.getTime() - 5 * 60000); // 5 mins before
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
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {/* New Meeting */}
          <div className="glass rounded-2xl p-6 animate-fade-in">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-400" /> New Meeting
            </h2>
            {showCreate ? (
              <div className="space-y-3">
                <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Meeting name (optional)"
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors" />
                
                <div className="flex items-center gap-3 px-4 py-3 bg-dark-800/50 rounded-xl border border-dark-700/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Private</p>
                  </div>
                  <button onClick={() => setIsPrivate(!isPrivate)} className={`w-10 h-5 rounded-full relative transition-colors ${isPrivate ? 'bg-primary-500' : 'bg-dark-600'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isPrivate ? 'right-0.5' : 'left-0.5'}`}></div>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={loading} className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 rounded-xl font-semibold transition-all disabled:opacity-50">
                    {loading ? '...' : 'Start'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 glass-light rounded-xl font-medium">X</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCreate(true)}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                <Video className="w-5 h-5" /> Start Instant
              </button>
            )}
          </div>

          {/* Schedule Meeting */}
          <div className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '50ms' }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-400" /> Schedule
            </h2>
            <button onClick={() => setShowSchedule(true)}
              className="w-full py-4 glass hover:bg-dark-800 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border border-dark-700">
              <Calendar className="w-5 h-5 text-accent-400" /> Schedule for later
            </button>
          </div>

          {/* Join Meeting */}
          <div className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-400" /> Join
            </h2>
            <div className="flex gap-2">
              <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Code"
                className="flex-1 px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 uppercase font-mono text-center" maxLength={8} />
              <button onClick={handleJoin} className="px-5 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-xl transition-all">
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled Meetings Section */}
        {scheduledMeetings.length > 0 && (
          <div className="mb-10 animate-slide-up">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-accent-400" /> Upcoming Meetings
            </h2>
            <div className="grid gap-4">
              {scheduledMeetings.map(m => (
                <div key={m._id} className="glass rounded-xl p-5 hover:border-accent-500/30 transition-all group border-l-4 border-l-accent-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex flex-col items-center justify-center text-accent-400">
                        <span className="text-xs font-bold uppercase">{new Date(m.scheduledAt).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-lg font-black leading-none">{new Date(m.scheduledAt).getDate()}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{m.title}</h3>
                        <p className="text-sm text-dark-400">
                          {new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {m.duration} mins
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-dark-500 bg-dark-800 px-2 py-1 rounded">{m.meetingId}</span>
                      <button onClick={() => copyLink(m.meetingId)} className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-dark-400" title="Copy Link">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteMeeting(m._id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-400" title="Cancel Meeting">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => navigate(`/meeting/${m.meetingId}`)}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${isJoinable(m.scheduledAt) ? 'bg-accent-600 hover:bg-accent-500' : 'bg-dark-800 text-dark-500 cursor-not-allowed'}`}
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Section */}
        <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary-400" /> Meeting History
          </h2>
          {history.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Video className="w-12 h-12 text-dark-600 mx-auto mb-4" />
              <p className="text-dark-400">No past meetings found.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {history.map(m => (
                <div key={m._id} className="glass rounded-xl px-5 py-4 hover:bg-white/5 transition-all flex items-center justify-between group border border-dark-800/50">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${m.isActive ? 'bg-green-400 animate-pulse' : 'bg-dark-700'}`}></div>
                    <div>
                      <h3 className="font-medium text-dark-100">{m.name}</h3>
                      <p className="text-xs text-dark-500 mt-0.5">
                        {new Date(m.startedAt).toLocaleDateString()} • {new Date(m.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => copyLink(m.roomId)} className="p-2 rounded-lg hover:bg-dark-700 transition-colors text-dark-400"><Copy className="w-4 h-4" /></button>
                    {m.isActive && (
                      <button onClick={() => navigate(`/meeting/${m.roomId}`)} className="px-4 py-1.5 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 rounded-lg text-xs font-bold border border-primary-600/50">Rejoin</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={() => setShowSchedule(false)}></div>
          <div className="glass rounded-2xl w-full max-w-md p-8 relative animate-scale-in">
            <button onClick={() => setShowSchedule(false)} className="absolute top-6 right-6 text-dark-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Calendar className="w-6 h-6 text-accent-400" /> Schedule Meeting
            </h2>

            <form onSubmit={handleSchedule} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Meeting Title</label>
                <input required value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)} placeholder="Marketing Sync"
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Date</label>
                  <input required type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Time</label>
                  <input required type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Duration (minutes)</label>
                <select value={scheduleDuration} onChange={e => setScheduleDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl border border-dark-700">
                <div className="text-sm font-medium">Require approval to join</div>
                <button type="button" onClick={() => setIsPrivate(!isPrivate)} className={`w-10 h-5 rounded-full relative transition-colors ${isPrivate ? 'bg-primary-500' : 'bg-dark-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isPrivate ? 'right-0.5' : 'left-0.5'}`}></div>
                </button>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                {loading ? 'Scheduling...' : 'Schedule Meeting'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
