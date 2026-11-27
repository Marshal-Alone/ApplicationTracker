const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

let wss;
const userSockets = new Map(); // userId -> Set of WebSocket clients

function registerSocket(userId, ws) {
  if (!userId) return;
  if (ws._userId && ws._userId !== userId) {
    unregisterSocket(ws);
  }
  ws._userId = userId;
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(ws);
}

function unregisterSocket(ws) {
  const userId = ws._userId;
  if (userId && userSockets.has(userId)) {
    userSockets.get(userId).delete(ws);
    if (userSockets.get(userId).size === 0) {
      userSockets.delete(userId);
    }
  }
  ws._userId = null;
}

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Attempt authentication via query param (?token=...)
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.id) {
          registerSocket(decoded.id, ws);
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: decoded.id }));
        }
      }
    } catch {
      // Await explicit AUTH frame or close on unauthenticated use
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(String(message));
        if (data.type === 'AUTH' && data.token) {
          const decoded = jwt.verify(data.token, JWT_SECRET);
          if (decoded && decoded.id) {
            registerSocket(decoded.id, ws);
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: decoded.id }));
          }
        } else if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch {
        // Ignore malformed messages or invalid tokens
      }
    });

    ws.on('close', () => {
      unregisterSocket(ws);
    });
  });

  // Periodic heartbeat to close dead connections cleanly
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        unregisterSocket(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  wss.on('close', () => {
    clearInterval(interval);
  });

  server.on('close', () => {
    clearInterval(interval);
    if (wss) {
      wss.clients.forEach((c) => c.terminate());
      wss.close();
    }
  });

  return wss;
}

function notifyUser(userId, data) {
  if (!userId || !userSockets.has(userId)) return;
  const payload = JSON.stringify(data);
  const clients = userSockets.get(userId);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

module.exports = {
  initWebSocket,
  notifyUser,
};
