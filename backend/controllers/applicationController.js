const ApplicationModel = require('../models/Application');
const { notifyUser } = require('../services/websocketService');

class ApplicationController {
  static async getAll(req, res) {
    try {
      const applications = await ApplicationModel.getByUserId(req.userId);
      res.json({ success: true, applications });
    } catch (error) {
      console.error('Error fetching applications:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch applications' });
    }
  }

  static async create(req, res) {
    try {
      const newApp = await ApplicationModel.create(req.userId, req.body);

      // Real-time notification to user's connected dashboard tabs
      notifyUser(req.userId, {
        type: 'NEW_APPLICATION',
        application: newApp,
      });

      res.status(201).json({
        success: true,
        data: newApp,
        message: 'Application saved successfully',
      });
    } catch (error) {
      console.error('Error creating application:', error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to save application',
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await ApplicationModel.update(req.userId, id, req.body);

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      notifyUser(req.userId, {
        type: 'APPLICATION_UPDATED',
        application: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating application:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await ApplicationModel.delete(req.userId, id);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Application not found' });
      }

      notifyUser(req.userId, {
        type: 'APPLICATION_DELETED',
        applicationId: id,
      });

      res.json({ success: true, message: 'Application deleted successfully' });
    } catch (error) {
      console.error('Error deleting application:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  static async sync(req, res) {
    try {
      const { frontendApplications = [] } = req.body;
      const result = await ApplicationModel.sync(req.userId, frontendApplications);
      res.json({
        success: true,
        newApplications: result.newApplications,
        syncedCount: result.syncedCount,
      });
    } catch (error) {
      console.error('Error syncing applications:', error);
      res.status(500).json({ success: false, error: 'Failed to sync applications' });
    }
  }
}

module.exports = ApplicationController;
