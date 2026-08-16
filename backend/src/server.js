const crypto = require('crypto');
if (!globalThis.crypto) globalThis.crypto = crypto;

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const config = require('./config/config');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const setupSocket = require('./socket');

// Import routes
const authRoutes = require('./routes/authRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const aiRoutes = require('./routes/aiRoutes');
const standupRoutes = require('./routes/standupRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const messageRoutes = require('./routes/directMessageRoutes');

// Initialize Express
const app = express();
const server = http.createServer(app);

// CORS configuration (supports Vercel, localhost, and custom domains)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow all origins or specific domains
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Initialize Socket.IO with flexible CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e8, // 100MB for recording uploads
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/storage', express.static(path.join(__dirname, '../storage')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/standups', standupRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/messages', messageRoutes);

// Import keep-alive service
const startKeepAlive = require('./utils/keepAlive');
const { execSync } = require('child_process');

// Root, Health, & Keep-Alive Ping endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Meeting AI Backend API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ping', (req, res) => {
  res.json({
    status: 'alive',
    message: 'Pong! Server is active',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/disk-status', (req, res) => {
  try {
    const diskInfo = execSync('df -h').toString();
    res.json({
      status: 'ok',
      diskOutput: diskInfo.split('\n'),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use(errorHandler);

// Setup Socket.IO
setupSocket(io);

// Start server on 0.0.0.0 for Render / cloud deployment
const port = Number(config.port) || 5000;
server.listen(port, '0.0.0.0', async () => {
  console.log(`\n🚀 Meeting AI Server running on port ${port} (bound to 0.0.0.0)`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🎨 Client URL: ${config.clientUrl}`);

  // Connect to MongoDB
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB initial connection error:', err.message);
  }

  // Start self-ping keep-alive service
  startKeepAlive();
});
