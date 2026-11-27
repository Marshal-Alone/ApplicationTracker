const jwt = require('jsonwebtoken');
const { getUsersCollection } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'jobtracker-secret-key-change-in-production-2025';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('[ApplicationTracker] Warning: JWT_SECRET env var not set; using fallback secret.');
}

async function resolveAuthenticatedUser(req) {
  // 1. Check for API key (used by Chrome Extension)
  const apiKeyHeader = req.headers['x-api-key'];
  const apiKey = typeof apiKeyHeader === 'string' ? apiKeyHeader.trim() : '';
  if (apiKey) {
    const usersCollection = getUsersCollection();
    if (!usersCollection) {
      return { status: 503, error: 'Database unavailable' };
    }
    const user = await usersCollection.findOne({ apiKey });
    if (user) {
      const userId = user.id || (user._id ? user._id.toString() : null);
      return {
        userId,
        user: {
          id: userId,
          email: user.email,
          name: user.name,
        },
      };
    }
    return { status: 401, error: 'Invalid or revoked API key' };
  }

  // 2. Check for Bearer token (used by Web Dashboard)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      return { status: 401, error: 'Empty authorization token' };
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded || !decoded.id) {
        return { status: 401, error: 'Invalid authorization payload' };
      }
      return { userId: decoded.id, user: decoded };
    } catch {
      return { status: 401, error: 'Invalid or expired authorization token' };
    }
  }

  // 3. Optional local dev anonymous escape hatch (disabled by default)
  if (process.env.ALLOW_ANONYMOUS === 'true') {
    return {
      userId: 'default-user',
      user: { id: 'default-user', email: 'guest@applicationtracker.local', name: 'Guest User' },
    };
  }

  return null;
}

async function authMiddleware(req, res, next) {
  try {
    const resolved = await resolveAuthenticatedUser(req);
    if (!resolved) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Provide a Bearer token or x-api-key header.',
      });
    }
    if (resolved.error) {
      return res.status(resolved.status || 401).json({ success: false, error: resolved.error });
    }
    req.user = resolved.user;
    req.userId = resolved.userId;
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Internal authentication error' });
  }
}

async function optionalAuthMiddleware(req, res, next) {
  try {
    const resolved = await resolveAuthenticatedUser(req);
    if (resolved && resolved.error) {
      return res.status(resolved.status || 401).json({ success: false, error: resolved.error });
    }
    if (resolved) {
      req.user = resolved.user;
      req.userId = resolved.userId;
    }
    return next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Internal authentication error' });
  }
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  JWT_SECRET,
};
