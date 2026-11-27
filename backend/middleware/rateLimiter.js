/**
 * Sliding-window in-memory rate limiter for Express routes.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 30 } = {}) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const fresh = timestamps.filter((ts) => now - ts < windowMs);
      if (fresh.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, fresh);
      }
    }
  }, Math.min(windowMs, 60 * 1000));

  if (typeof cleanup.unref === 'function') {
    cleanup.unref();
  }

  return function rateLimitMiddleware(req, res, next) {
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-ratelimit'] !== 'true') {
      return next();
    }

    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const existing = hits.get(key) || [];
    const recent = existing.filter((ts) => now - ts < windowMs);

    if (recent.length >= maxRequests) {
      const oldest = recent[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again shortly.',
      });
    }

    recent.push(now);
    hits.set(key, recent);
    return next();
  };
}

module.exports = { createRateLimiter };
