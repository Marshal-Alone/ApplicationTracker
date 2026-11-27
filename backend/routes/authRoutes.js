const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const authRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 30 });

router.post('/register', authRateLimiter, AuthController.register);
router.post('/login', authRateLimiter, AuthController.login);
router.get('/me', authMiddleware, AuthController.getMe);
router.put('/profile', authMiddleware, AuthController.updateProfile);
router.put('/password', authMiddleware, AuthController.updatePassword);
router.post('/api-key', authMiddleware, AuthController.regenerateApiKey);
router.delete('/account', authMiddleware, AuthController.deleteAccount);

module.exports = router;
