const express = require('express');
const router = express.Router();
const AiController = require('../controllers/aiController');
const { optionalAuthMiddleware } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const aiRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20 });

router.get('/status', AiController.getStatus);
router.post('/resume-context', aiRateLimiter, optionalAuthMiddleware, AiController.buildResumeContext);
router.post('/match-job', aiRateLimiter, optionalAuthMiddleware, AiController.matchJob);
router.post('/discover-selectors', aiRateLimiter, optionalAuthMiddleware, AiController.discoverSelectors);

module.exports = router;
