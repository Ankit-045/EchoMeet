import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { joinRoom, guestLogin } from '../services/api';
import toast from 'react-hot-toast';
import { Video, User, ArrowRight, Users } from 'lucide-react';

export default function JoinMeeting() {
  const { roomId } = useParams();
  const { user, loginUser } = useAuth();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (asGuest = false) => {
    setLoading(true);
    try {
      // If no user and joining as guest, create guest session first
      if (!user && asGuest) {
        const guestRes = await guestLogin({ name: guestName || undefined });
        loginUser(guestRes.data.user, guestRes.data.token);
      }

      navigate(`/meeting/${roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">EchoMeet</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Join Meeting</h1>
          <div className="flex items-center justify-center gap-2 text-dark-400 mt-2">
            <Users className="w-4 h-4" />
            <span className="font-mono text-lg tracking-widest">{roomId}</span>
          </div>
        </div>

        <div className="glass rounded-2xl p-8 space-y-6">
          {user ? (
            <>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-dark-800/50">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-lg font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-dark-400">{user.email}</p>
                </div>
              </div>
              <button onClick={() => handleJoin(false)} disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span>Join Now</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Your Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                  <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 transition-colors" placeholder="Enter your name" />
                </div>
              </div>
              <button onClick={() => handleJoin(true)} disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span>Join as Guest</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="text-center text-sm text-dark-500">
                or <button onClick={() => navigate('/login')} className="text-primary-400 hover:text-primary-300 font-medium">sign in</button> for full access
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
