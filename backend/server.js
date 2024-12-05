const express = require('express');
const cors = require('cors');
const http = require('http');
const { initMongoDB, getDb } = require('./config/db');
const { initWebSocket } = require('./services/websocketService');
const authRoutes = require('./routes/authRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Create HTTP Server & WebSocket Service
const server = http.createServer(app);
initWebSocket(server);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    const db = getDb();
    const appCount = db ? await db.collection('applications').countDocuments() : 0;
    const userCount = db ? await db.collection('users').countDocuments() : 0;
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      applications: appCount,
      users: userCount,
      database: 'MongoDB',
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Start Server
async function startServer() {
  await initMongoDB();
  server.listen(PORT, () => {
    console.log(`[JobTracker] Backend running on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch(console.error);
}

module.exports = { app, server };
