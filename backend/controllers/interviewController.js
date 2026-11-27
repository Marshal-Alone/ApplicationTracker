const { InterviewModel } = require('../models/Interview');
const { notifyUser } = require('../services/websocketService');

class InterviewController {
  static async getAll(req, res) {
    try {
      const interviews = await InterviewModel.getByUserId(req.userId);
      res.json({ success: true, interviews });
    } catch (error) {
      console.error('Error fetching interviews:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch interviews' });
    }
  }

  static async create(req, res) {
    try {
      const created = await InterviewModel.create(req.userId, req.body);

      notifyUser(req.userId, {
        type: 'NEW_INTERVIEW',
        interview: created,
      });

      res.status(201).json({
        success: true,
        data: created,
        message: 'Interview scheduled successfully',
      });
    } catch (error) {
      console.error('Error creating interview:', error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to schedule interview',
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const updated = await InterviewModel.update(req.userId, id, req.body);

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Interview not found' });
      }

      notifyUser(req.userId, {
        type: 'INTERVIEW_UPDATED',
        interview: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating interview:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, error: error.message || 'Failed to update interview' });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await InterviewModel.delete(req.userId, id);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Interview not found' });
      }

      notifyUser(req.userId, {
        type: 'INTERVIEW_DELETED',
        interviewId: id,
      });

      res.json({ success: true, message: 'Interview removed successfully' });
    } catch (error) {
      console.error('Error deleting interview:', error);
      res.status(500).json({ success: false, error: 'Failed to delete interview' });
    }
  }

  static async sync(req, res) {
    try {
      const { frontendInterviews = [] } = req.body;
      const result = await InterviewModel.sync(req.userId, frontendInterviews);
      if (result.syncedCount > 0) {
        notifyUser(req.userId, {
          type: 'INTERVIEWS_SYNCED',
          interviews: result.interviews,
        });
      }
      res.json({
        success: true,
        interviews: result.interviews,
        syncedCount: result.syncedCount,
      });
    } catch (error) {
      const status = error.statusCode || 500;
      if (process.env.NODE_ENV !== 'test' || status >= 500) {
        console.error('Error syncing interviews:', error);
      }
      res.status(status).json({ success: false, error: error.message || 'Failed to sync interviews' });
    }
  }
}

module.exports = InterviewController;
