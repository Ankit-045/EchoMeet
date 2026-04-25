import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { PWAProvider, usePWA } from "@/context/PWAContext";
import { LandingPage } from "@features/landing";
import { LoginPage, RegisterPage } from "@features/auth";
import { DashboardPage } from "@features/dashboard";
import { MeetingRoomPage, JoinMeetingPage } from "@features/meeting";
import { Video } from "lucide-react";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  return user ? children : <Navigate to="/login" />;
}

function PWAInstallTrigger() {
  const { isInstallable, installPWA } = usePWA();

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-slide-up">
      <button
        onClick={installPWA}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-full font-bold shadow-2xl hover:scale-105 transition-transform hover:shadow-primary-500/30"
      >
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Video size={18} />
        </div>
        Install App
      </button>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1e293b",
                color: "#f1f5f9",
                border: "1px solid rgba(99,102,241,0.2)",
              },
              success: {
                iconTheme: { primary: "#6366f1", secondary: "#f1f5f9" },
              },
              error: {
                iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" },
              },
            }}
          />
          <PWAProvider>
            <PWAInstallTrigger />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/meeting/:roomId" element={<MeetingRoomPage />} />
              <Route path="/join" element={<JoinMeetingPage />} />
              <Route path="/join/:meetingId" element={<JoinMeetingPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </PWAProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
