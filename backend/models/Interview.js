const { v4: uuidv4 } = require('uuid');
const { getInterviewsCollection } = require('../config/db');
const { sanitizeHttpUrl } = require('./Application');

const VALID_TYPES = ['Video Call', 'On-site', 'Phone Call'];
const VALID_INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'Cancelled'];

const ALLOWED_FIELDS = [
  'applicationId',
  'company',
  'position',
  'date',
  'time',
  'type',
  'location',
  'meetingLink',
  'notes',
  'interviewer',
  'status',
];

function validateInterviewData(data) {
  const company = String(data.company || '').trim();
  const position = String(data.position || '').trim();
  const date = String(data.date || '').trim();
  const time = String(data.time || '').trim();

  if (!company || !position || !date || !time) {
    const err = new Error('Company, position, date, and time are required.');
    err.statusCode = 400;
    throw err;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const err = new Error('Date must use YYYY-MM-DD format.');
    err.statusCode = 400;
    throw err;
  }

  const type = VALID_TYPES.includes(data.type) ? data.type : 'Video Call';
  const status = VALID_INTERVIEW_STATUSES.includes(data.status) ? data.status : 'Scheduled';

  return {
    applicationId: String(data.applicationId || '').trim(),
    company,
    position,
    date,
    time,
    type,
    location: String(data.location || '').trim(),
    meetingLink: sanitizeHttpUrl(data.meetingLink || ''),
    notes: String(data.notes || '').trim(),
    interviewer: String(data.interviewer || '').trim(),
    status,
  };
}

class InterviewModel {
  static async getByUserId(userId) {
    const col = getInterviewsCollection();
    return await col
      .find({ userId })
      .project({ _id: 0 })
      .sort({ date: 1, time: 1 })
      .toArray();
  }

  static async create(userId, data) {
    const col = getInterviewsCollection();
    const sanitized = validateInterviewData(data);
    const now = new Date().toISOString();

    const doc = {
      id: uuidv4(),
      userId,
      ...sanitized,
      createdAt: now,
      updatedAt: now,
    };

    await col.insertOne(doc);
    const { _id, ...clean } = doc;
    return clean;
  }

  static async update(userId, id, rawUpdates) {
    const col = getInterviewsCollection();
    const cleanUpdates = {};

    for (const key of ALLOWED_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(rawUpdates, key)) continue;

      if (key === 'type') {
        if (!VALID_TYPES.includes(rawUpdates.type)) {
          const err = new Error(`Invalid interview type. Must be one of: ${VALID_TYPES.join(', ')}`);
          err.statusCode = 400;
          throw err;
        }
        cleanUpdates.type = rawUpdates.type;
      } else if (key === 'status') {
        if (!VALID_INTERVIEW_STATUSES.includes(rawUpdates.status)) {
          const err = new Error(`Invalid interview status. Must be one of: ${VALID_INTERVIEW_STATUSES.join(', ')}`);
          err.statusCode = 400;
          throw err;
        }
        cleanUpdates.status = rawUpdates.status;
      } else if (key === 'meetingLink') {
        cleanUpdates.meetingLink = sanitizeHttpUrl(rawUpdates.meetingLink);
      } else if (key === 'company' || key === 'position' || key === 'date' || key === 'time') {
        const val = String(rawUpdates[key] || '').trim();
        if (!val) {
          const err = new Error(`${key} cannot be empty.`);
          err.statusCode = 400;
          throw err;
        }
        if (key === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          const err = new Error('Date must use YYYY-MM-DD format.');
          err.statusCode = 400;
          throw err;
        }
        cleanUpdates[key] = val;
      } else {
        cleanUpdates[key] = String(rawUpdates[key] || '').trim();
      }
    }

    if (Object.keys(cleanUpdates).length === 0) {
      return await col.findOne({ id, userId }, { projection: { _id: 0 } });
    }

    const result = await col.updateOne(
      { id, userId },
      { $set: { ...cleanUpdates, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return null;
    }

    return await col.findOne({ id, userId }, { projection: { _id: 0 } });
  }

  static async delete(userId, id) {
    const col = getInterviewsCollection();
    const result = await col.deleteOne({ id, userId });
    return result.deletedCount > 0;
  }

  static async sync(userId, frontendInterviews = []) {
    const col = getInterviewsCollection();
    if (!Array.isArray(frontendInterviews)) {
      const err = new Error('frontendInterviews must be an array');
      err.statusCode = 400;
      throw err;
    }

    const existing = await col
      .find({ userId })
      .project({ _id: 0 })
      .sort({ date: 1, time: 1 })
      .toArray();
    const existingIds = new Set(existing.map((i) => i.id));
    const existingFingerprints = new Set(
      existing.map(
        (i) => `${i.company.toLowerCase()}|${i.position.toLowerCase()}|${i.date}|${i.time}`
      )
    );

    let syncedCount = 0;
    for (const candidate of frontendInterviews) {
      if (!candidate || typeof candidate !== 'object') continue;
      try {
        const sanitized = validateInterviewData(candidate);
        const fingerprint = `${sanitized.company.toLowerCase()}|${sanitized.position.toLowerCase()}|${sanitized.date}|${sanitized.time}`;
        if ((candidate.id && existingIds.has(candidate.id)) || existingFingerprints.has(fingerprint)) {
          continue;
        }
        const now = new Date().toISOString();
        const doc = {
          id: candidate.id && !String(candidate.id).startsWith('iv_') ? String(candidate.id) : uuidv4(),
          userId,
          ...sanitized,
          createdAt: candidate.createdAt || now,
          updatedAt: now,
        };
        await col.insertOne(doc);
        existingIds.add(doc.id);
        existingFingerprints.add(fingerprint);
        syncedCount += 1;
      } catch {
        // Skip invalid individual records
      }
    }

    const allAfter = await col
      .find({ userId })
      .project({ _id: 0 })
      .sort({ date: 1, time: 1 })
      .toArray();
    return {
      interviews: allAfter,
      syncedCount,
    };
  }
}

module.exports = {
  InterviewModel,
  VALID_TYPES,
  VALID_INTERVIEW_STATUSES,
  validateInterviewData,
};
