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

      const user = await UserModel.createUser({ name, email, password });
      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        success: true,
        user,
        token,
      });
    } catch (error) {
      const status = error.statusCode || 400;
      if (process.env.NODE_ENV !== 'test' || status >= 500) {
        console.error('Registration error:', error);
      }
      res.status(status).json({ success: false, error: error.message });
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
        user: UserModel.sanitizeUser(user),
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
        user: UserModel.sanitizeUser(user),
      });
    } catch (error) {
      console.error('getMe error:', error);
      res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
    }
  }

  static async updateProfile(req, res) {
    try {
      const { name, skills, targetRoles, experienceYears, resumeContext } = req.body;
      const updatedUser = await UserModel.updateProfile(req.userId, {
        name,
        skills,
        targetRoles,
        experienceYears,
        resumeContext,
      });
      if (!updatedUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('updateProfile error:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, error: error.message || 'Failed to update profile' });
    }
  }

  static async updatePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
      }
      await UserModel.updatePassword(req.userId, { currentPassword, newPassword });
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      console.error('updatePassword error:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, error: error.message || 'Failed to update password' });
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

  static async deleteAccount(req, res) {
    try {
      const deleted = await UserModel.deleteAccount(req.userId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }
      res.json({ success: true, message: 'Account and all associated records deleted.' });
    } catch (error) {
      console.error('deleteAccount error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete account' });
    }
  }
}

module.exports = AuthController;
