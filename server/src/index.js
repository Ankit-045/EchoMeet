require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const setupSocketHandlers = require('./socket');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const meetingRoutes = require('./routes/meeting');
const chatRoutes = require('./routes/chat');
const attendanceRoutes = require('./routes/attendance');
const summaryRoutes = require('./routes/summary');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/summary', summaryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/echomeet')
  .then(async () => {
    console.log('✅ MongoDB connected');

    // Drop stale indexes left over from previous schema versions.
    // The old `username_1` unique index blocks registration because the
    // current schema has no `username` field — every doc gets null, and
    // the unique constraint rejects the second insert.
    try {
      await mongoose.connection.collection('users').dropIndex('username_1');
      console.log('🧹 Dropped stale username_1 index');
    } catch (_) {
      // Index already gone — nothing to do
    }

    server.listen(PORT, () => {
      console.log(`🚀 EchoMeet server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
