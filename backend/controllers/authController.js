const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');
const { JWT_SECRET } = require('../middleware/auth');

class AuthController {
  static async register(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Name, email, and password are required',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long',
        });
      }

      const user = await UserModel.createUser({ name, email, password });
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          apiKey: user.apiKey,
        },
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
        });
      }

      const isMatch = await UserModel.verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          apiKey: user.apiKey,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, error: 'Internal login error' });
    }
  }

  static async getMe(req, res) {
    try {
      const user = await UserModel.findById(req.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          apiKey: user.apiKey,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error('getMe error:', error);
      res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
    }
  }

  static async regenerateApiKey(req, res) {
    try {
      const newApiKey = await UserModel.regenerateApiKey(req.userId);
      res.json({
        success: true,
        apiKey: newApiKey,
        message: 'API Key regenerated successfully. Update this key in your Chrome Extension.',
      });
    } catch (error) {
      console.error('regenerateApiKey error:', error);
      res.status(500).json({ success: false, error: 'Failed to regenerate API key' });
    }
  }
}

module.exports = AuthController;
