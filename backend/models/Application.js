const { v4: uuidv4 } = require('uuid');
const { getApplicationsCollection } = require('../config/db');

function formatJobDescription(description) {
  if (!description) return '';
  return description
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(responsibilities|requirements|qualifications|skills|benefits|about)/gi, '\n\n$1')
    .replace(/[•·▪▫◦‣⁃]/g, '•')
    .replace(/[-*]\s/g, '• ')
    .replace(/•/g, '\n• ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\n\n(responsibilities|requirements|qualifications|skills|benefits|about)/gi, 
             (match, word) => `\n\n${word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()}`)
    .trim();
}

function validateJobData(jobData) {
  const sanitized = {
    company: (jobData.company || '').trim(),
    position: (jobData.position || '').trim(),
    location: (jobData.location || '').trim(),
    salary: (jobData.salary || '').trim(),
    jobUrl: (jobData.jobUrl || '').trim(),
    description: formatJobDescription(jobData.description || ''),
    appliedDate: jobData.appliedDate || new Date().toISOString().split('T')[0],
    status: jobData.status || 'Applied',
    notes: (jobData.notes || '').trim()
  };

  if (!sanitized.company && !sanitized.position) {
    throw new Error('Missing required fields: company or position');
  }

  return sanitized;
}

class ApplicationModel {
  static async getByUserId(userId) {
    const col = getApplicationsCollection();
    return await col
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async findDuplicate(userId, { company, position, jobUrl }) {
    const col = getApplicationsCollection();
    return await col.findOne({
      userId,
      $and: [
        { company: { $regex: new RegExp(`^${company}$`, 'i') } },
        { position: { $regex: new RegExp(`^${position}$`, 'i') } },
        {
          $or: [
            { jobUrl: jobUrl },
            { $and: [{ jobUrl: { $exists: false } }, { jobUrl: '' }] }
          ]
        }
      ]
    });
  }

  static async create(userId, jobData) {
    const col = getApplicationsCollection();
    const sanitized = validateJobData(jobData);

    const duplicate = await this.findDuplicate(userId, sanitized);
    if (duplicate) {
      const error = new Error('This application already exists in your tracker.');
      error.statusCode = 409;
      throw error;
    }

    const newApp = {
      id: uuidv4(),
      userId,
      ...sanitized,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await col.insertOne(newApp);
    return newApp;
  }

  static async update(userId, id, updates) {
    const col = getApplicationsCollection();
    delete updates._id;
    delete updates.id;
    delete updates.userId;

    const result = await col.updateOne(
      { id, userId },
      { $set: { ...updates, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return null;
    }

    return await col.findOne({ id, userId });
  }

  static async delete(userId, id) {
    const col = getApplicationsCollection();
    const result = await col.deleteOne({ id, userId });
    return result.deletedCount > 0;
  }

  static async sync(userId, frontendApplications = []) {
    const col = getApplicationsCollection();
    const all = await col.find({ userId }).sort({ createdAt: -1 }).toArray();
    const frontendIds = new Set(frontendApplications.map(a => a.id));
    const newFromDb = all.filter(a => !frontendIds.has(a.id));

    const dbIds = new Set(all.map(a => a.id));
    const toInsert = frontendApplications.filter(a => !dbIds.has(a.id));

    if (toInsert.length > 0) {
      await col.insertMany(toInsert.map(a => ({
        ...a,
        userId,
        createdAt: a.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })));
    }

    return {
      newApplications: newFromDb,
      syncedCount: toInsert.length
    };
  }
}

module.exports = ApplicationModel;
