const jwt = require('jsonwebtoken');
const { getUsersCollection } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'jobtracker-secret-key-change-in-production-2025';

async function authMiddleware(req, res, next) {
  try {
    // 1. Check for API key (used by Chrome Extension)
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const usersCollection = getUsersCollection();
      const user = await usersCollection.findOne({ apiKey: apiKey.trim() });
      if (user) {
        req.user = {
          id: user.id || user._id.toString(),
          email: user.email,
          name: user.name,
        };
        req.userId = req.user.id;
        return next();
      }
      return res.status(401).json({ success: false, error: 'Invalid or revoked API key' });
    }

    // 2. Check for Bearer token (used by Web Dashboard)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.userId = decoded.id;
        return next();
      } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired authorization token' });
      }
    }

    // 3. Fallback for unauthenticated legacy extension requests in local dev
    // If ALLOW_ANONYMOUS is explicitly enabled or during migration
    if (process.env.ALLOW_ANONYMOUS === 'true') {
      req.userId = 'default-user';
      req.user = { id: 'default-user', email: 'guest@jobtracker.local', name: 'Guest User' };
      return next();
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a Bearer token or x-api-key header.',
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Internal authentication error' });
  }
}

module.exports = {
  authMiddleware,
  JWT_SECRET,
};
