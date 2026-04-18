require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const setupSocketHandlers = require('./socket');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const meetingRoutes = require('./routes/meeting');
const chatRoutes = require('./routes/chat');
const attendanceRoutes = require('./routes/attendance');
const summaryRoutes = require('./routes/summary');
const { authLimiter, apiLimiter, summaryLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const path = require('path');

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['polling', 'websocket'],
  maxHttpBufferSize: 1e6 // 1MB
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow LiveKit WebRTC connections
  crossOriginEmbedderPolicy: false, // Allow MediaPipe CDN
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Allow Google popup postMessage flow
}));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Optional request latency logging (set LOG_LATENCY=1 to enable)
app.use((req, res, next) => {
  if (!process.env.LOG_LATENCY) return next();
  if (!req.originalUrl.startsWith('/api')) return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const thresholdMs = Number(process.env.LOG_LATENCY_THRESHOLD_MS || 0);
    if (durationMs >= thresholdMs) {
      console.log(`⏱️  ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs.toFixed(1)}ms`);
    }
  });
  next();
});

// Make io available to routes
app.set('io', io);

// Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms', apiLimiter, roomRoutes);
app.use('/api/meetings', apiLimiter, meetingRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);
app.use('/api/attendance', apiLimiter, attendanceRoutes);
app.use('/api/summary', summaryLimiter, summaryRoutes);

// Health check

// 1. Existing Health check (Keep this!)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Add this Production Environment Block
// This securely serves the compiled Vite frontend 
if (process.env.NODE_ENV === 'production') {
  // CommonJS uses __dirname. Since index.js is in src/, we go up twice to reach the client/dist folder
  const clientBuildPath = path.join(__dirname, '../../client/dist');

  // Serve the static files
  app.use(express.static(clientBuildPath));

  // Catch-all route to hand over frontend routing back to React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Setup Socket.io handlers
setupSocketHandlers(io);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/echomeet', {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
})
  .then(async () => {
    console.log('✅ MongoDB connected');

    // Drop stale indexes from previous schema versions
    try {
      await mongoose.connection.collection('users').dropIndex('username_1');
      console.log('🧹 Dropped stale username_1 index');
    } catch (_) {
      // Index already gone
    }

    // Create TTL index for guest users — auto-delete after 24 hours
    try {
      await mongoose.connection.collection('users').createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 86400, partialFilterExpression: { isGuest: true } }
      );
      console.log('🧹 Guest user TTL index ensured');
    } catch (_) {
      // Index already exists or partial filter not supported
    }

    server.listen(PORT, () => {
      console.log(`🚀 EchoMeet server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
