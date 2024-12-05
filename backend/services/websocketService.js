const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

let wss;
const userSockets = new Map(); // userId -> Set of WebSocket clients

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    // Attempt authentication via query param (?token=...)
    let authenticatedUserId = null;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        authenticatedUserId = decoded.id;
      }
    } catch (e) {
      // Unauthenticated client
    }

    if (authenticatedUserId) {
      if (!userSockets.has(authenticatedUserId)) {
        userSockets.set(authenticatedUserId, new Set());
      }
      userSockets.get(authenticatedUserId).add(ws);
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'AUTH' && data.token) {
          const decoded = jwt.verify(data.token, JWT_SECRET);
          authenticatedUserId = decoded.id;
          if (!userSockets.has(authenticatedUserId)) {
            userSockets.set(authenticatedUserId, new Set());
          }
          userSockets.get(authenticatedUserId).add(ws);
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: authenticatedUserId }));
        }
      } catch (err) {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (authenticatedUserId && userSockets.has(authenticatedUserId)) {
        userSockets.get(authenticatedUserId).delete(ws);
        if (userSockets.get(authenticatedUserId).size === 0) {
          userSockets.delete(authenticatedUserId);
        }
      }
    });
  });

  return wss;
}

function notifyUser(userId, data) {
  // Notify user-specific sockets
  if (userSockets.has(userId)) {
    const clients = userSockets.get(userId);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Also broadcast to unauthenticated/legacy clients during dev
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && !client._hasUser) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

module.exports = {
  initWebSocket,
  notifyUser,
};
