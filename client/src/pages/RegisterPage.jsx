import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as registerApi } from '../services/api';
import toast from 'react-hot-toast';
import { Video, Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setLoading(true);
    try {
      const res = await registerApi({ name: form.name, email: form.email, password: form.password });
      loginUser(res.data.user, res.data.token);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">EchoMeet</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Create account</h1>
          <p className="text-dark-400">Start your first meeting in minutes</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors" placeholder="Your name" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors" placeholder="your@email.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
              <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors" placeholder="Min 6 characters" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
              <input type="password" required value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-center mt-6 text-dark-400">
          Already have an account? <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
