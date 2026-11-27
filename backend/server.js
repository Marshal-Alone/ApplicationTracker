const express = require('express');
const cors = require('cors');
const http = require('http');
const { initMongoDB, getDb, client } = require('./config/db');
const { initWebSocket } = require('./services/websocketService');
const authRoutes = require('./routes/authRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers & core middleware
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(cors());
app.use(express.json({ limit: '8mb' }));

// Create HTTP Server & WebSocket Service
const server = http.createServer(app);
initWebSocket(server);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/ai', aiRoutes);

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ status: 'DEGRADED', database: 'Disconnected' });
    }
    await db.command({ ping: 1 });
    res.json({
      status: 'OK',
      service: 'ApplicationTracker API',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: 'MongoDB',
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// JSON 404 fallback for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global malformed-JSON & unhandled error guard
app.use((err, req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON request body' });
  }
  console.error('Unhandled API error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Graceful Shutdown
async function shutdown(signal) {
  console.log(`[ApplicationTracker] Received ${signal}, shutting down...`);
  await new Promise((resolve) => server.close(resolve));
  await client.close().catch(() => undefined);
  process.exit(0);
}

// Start Server
async function startServer() {
  await initMongoDB();
  server.listen(PORT, () => {
    console.log(`[ApplicationTracker] Backend running on port ${PORT}`);
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch(console.error);
}

module.exports = { app, server };
