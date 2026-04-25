import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Video,
  MessageSquare,
  Users,
  Brain,
  Hand,
  Shield,
  Pencil,
  UserCheck,
} from "lucide-react";

const features = [
  {
    icon: Video,
    title: "HD Video & Audio",
    desc: "Ultra-low latency calls supporting up to 25 participants with adaptive quality.",
  },
  {
    icon: MessageSquare,
    title: "Live Chat",
    desc: "Real-time group and private messaging with persistent history.",
  },
  {
    icon: Hand,
    title: "Hand Raise",
    desc: "Organized queue system so every voice gets heard.",
  },
  {
    icon: Brain,
    title: "AI Summaries",
    desc: "Automatic meeting transcription with key points and action items.",
  },
  {
    icon: Pencil,
    title: "Air Drawing",
    desc: "Draw in the air using hand gestures — no plugins required.",
  },
  {
    icon: UserCheck,
    title: "Auto Attendance",
    desc: "Automatic join/leave tracking with duration-based marking.",
  },
  {
    icon: Shield,
    title: "Secure Rooms",
    desc: "Token-based authentication with host-controlled permissions.",
  },
  {
    icon: Users,
    title: "Guest Access",
    desc: "Join meetings with a link — no account required.",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-950 protected-content">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">EchoMeet</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/25"
              >
                Dashboard
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-5 py-2.5 text-dark-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/25"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-light mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-sm text-dark-300">
              AI-Powered Meeting Platform
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 animate-fade-in leading-tight">
            Meetings that
            <br />
            <span className="gradient-text">think with you</span>
          </h1>
          <p className="text-lg md:text-xl text-dark-400 max-w-2xl mx-auto mb-10 animate-fade-in">
            Video calls, live chat, AI summaries, air drawing, and automatic
            attendance — all in one seamless, intelligent platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link
              to="/register"
              className="px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-2xl font-semibold text-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5"
            >
              Start Free Meeting
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 glass hover:bg-dark-800 rounded-2xl font-semibold text-lg transition-all duration-200"
            >
              Sign In
            </Link>
          </div>

          {/* Decorative gradient orbs */}
          <div className="relative mt-20 mx-auto max-w-4xl">
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -top-10 -right-20 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl"></div>
            <div className="glass rounded-3xl p-8 relative">
              <div className="grid grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video bg-dark-800 rounded-xl flex items-center justify-center border border-dark-700"
                  >
                    <Users className="w-8 h-8 text-dark-600" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-3">
                {[
                  "bg-red-500",
                  "bg-dark-600",
                  "bg-dark-600",
                  "bg-primary-500",
                  "bg-dark-600",
                ].map((c, i) => (
                  <div
                    key={i}
                    className={`w-12 h-12 ${c} rounded-full flex items-center justify-center transition-transform hover:scale-110`}
                  >
                    <div className="w-5 h-5 bg-white/20 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Every feature you need
            </h2>
            <p className="text-dark-400 text-lg">
              Built for teams that value productivity and collaboration
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="glass rounded-2xl p-6 hover:border-primary-500/40 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-4 group-hover:from-primary-500/30 group-hover:to-accent-500/30 transition-colors">
                  <f.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-dark-400 text-sm leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-dark-500 text-sm">
          <span className="gradient-text font-semibold">EchoMeet</span>
          <span>© 2026 EchoMeet. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
