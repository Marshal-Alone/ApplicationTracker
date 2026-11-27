const { v4: uuidv4 } = require('uuid');
const { getApplicationsCollection, getInterviewsCollection } = require('../config/db');

const VALID_STATUSES = [
  'Applied',
  'Under Review',
  'Interview Scheduled',
  'Offer',
  'Rejected',
];

const ALLOWED_UPDATE_FIELDS = [
  'company',
  'position',
  'location',
  'salary',
  'jobUrl',
  'applyUrl',
  'companyUrl',
  'companyLogo',
  'verifiedJob',
  'tags',
  'postedTime',
  'applicants',
  'responseNote',
  'benefits',
  'employeeGrowth',
  'requirements',
  'description',
  'appliedDate',
  'status',
  'notes',
  'resumeVersion',
  'referralContact',
  'followUpDate',
  'aiMatch',
];

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeHttpUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // Reject non-http(s) URLs cleanly
  }
  return '';
}

function sanitizeStringArray(arr, maxItems = 25, maxLen = 400) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const clean = String(item || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      out.push(clean);
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

const REQUIREMENT_HEADING_RE =
  /^(who you are|requirements|required skills|qualifications|minimum qualifications|preferred qualifications|what you['’]?ll bring|what we['’]?re looking for|your background|must haves?|technical skills|skills)\s*:?$/i;

const SECTION_STOP_HEADING_RE =
  /^(responsibilities|what you['’]?ll do|about us|about the team|about the role|benefits|perks|compensation|salary|equal opportunity|our mission|why join)\s*:?$/i;

function extractRequirementsFromDescription(description) {
  if (!description) return [];
  const lines = String(description)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const collected = [];
  let inRequirementsSection = false;

  for (const rawLine of lines) {
    const cleanHeading = rawLine.replace(/^[•·▪▫◦‣⁃\-*]\s*/, '').trim();

    if (REQUIREMENT_HEADING_RE.test(cleanHeading)) {
      inRequirementsSection = true;
      continue;
    }
    if (inRequirementsSection && SECTION_STOP_HEADING_RE.test(cleanHeading)) {
      inRequirementsSection = false;
      continue;
    }

    if (inRequirementsSection) {
      const stripped = rawLine.replace(/^(?:[•·▪▫◦‣⁃*]+\s*|-\s+|\d{1,2}[.)]\s+)/, '').trim();
      if (stripped.length >= 8 && stripped.length <= 360) {
        collected.push(stripped);
      }
    }
  }

  return sanitizeStringArray(collected, 25, 360);
}

function formatJobDescription(description) {
  if (!description) return '';
  return String(description)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeStatus(status) {
  if (VALID_STATUSES.includes(status)) return status;
  return 'Applied';
}

function sanitizeAiMatch(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cleanText = (v, max = 600) => String(v || '').trim().slice(0, max);

  const resumeEdits = Array.isArray(raw.resumeEdits)
    ? raw.resumeEdits
        .slice(0, 10)
        .filter((e) => e && typeof e === 'object')
        .map((e) => ({
          section: cleanText(e.section, 80),
          currentFocus: cleanText(e.currentFocus, 300),
          suggestedChange: cleanText(e.suggestedChange, 600),
          reason: cleanText(e.reason, 400),
        }))
        .filter((e) => e.suggestedChange)
    : [];

  return {
    overallVerdict: cleanText(raw.overallVerdict, 80),
    fitSummary: cleanText(raw.fitSummary, 1600),
    experienceCheck: cleanText(raw.experienceCheck, 600),
    matchedHighlights: sanitizeStringArray(raw.matchedHighlights, 12, 300),
    missingKeywords: sanitizeStringArray(raw.missingKeywords, 20, 60),
    resumeEdits,
    prepFocusTopics: sanitizeStringArray(raw.prepFocusTopics, 10, 220),
    tailoredOutreachHook: cleanText(raw.tailoredOutreachHook, 900),
    model: cleanText(raw.model, 60),
    generatedAt: cleanText(raw.generatedAt, 60) || new Date().toISOString(),
  };
}

function validateJobData(jobData) {
  const formattedDesc = formatJobDescription(jobData.description || '');
  const explicitRequirements = sanitizeStringArray(jobData.requirements, 25, 360);
  const requirements =
    explicitRequirements.length > 0
      ? explicitRequirements
      : extractRequirementsFromDescription(formattedDesc);

  const sanitized = {
    company: String(jobData.company || '').trim(),
    position: String(jobData.position || '').trim(),
    location: String(jobData.location || '').trim(),
    salary: String(jobData.salary || '').trim(),
    jobUrl: sanitizeHttpUrl(jobData.jobUrl || ''),
    applyUrl: sanitizeHttpUrl(jobData.applyUrl || ''),
    companyUrl: sanitizeHttpUrl(jobData.companyUrl || ''),
    companyLogo: sanitizeHttpUrl(jobData.companyLogo || ''),
    verifiedJob: Boolean(jobData.verifiedJob),
    tags: sanitizeStringArray(jobData.tags, 10, 60),
    postedTime: String(jobData.postedTime || '').trim(),
    applicants: String(jobData.applicants || '').trim(),
    responseNote: String(jobData.responseNote || '').trim(),
    benefits: String(jobData.benefits || '').trim(),
    employeeGrowth: String(jobData.employeeGrowth || '').trim(),
    requirements,
    description: formattedDesc,
    appliedDate:
      typeof jobData.appliedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(jobData.appliedDate.trim())
        ? jobData.appliedDate.trim()
        : new Date().toISOString().split('T')[0],
    status: normalizeStatus(jobData.status),
    notes: String(jobData.notes || '').trim(),
    resumeVersion: String(jobData.resumeVersion || '').trim().slice(0, 120),
    referralContact: String(jobData.referralContact || '').trim().slice(0, 140),
    followUpDate:
      typeof jobData.followUpDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(jobData.followUpDate.trim())
        ? jobData.followUpDate.trim()
        : '',
    aiMatch: sanitizeAiMatch(jobData.aiMatch),
  };

  if (!sanitized.company || !sanitized.position) {
    const err = new Error('Company and position are required.');
    err.statusCode = 400;
    throw err;
  }

  return sanitized;
}

class ApplicationModel {
  static async getByUserId(userId) {
    const col = getApplicationsCollection();
    return await col
      .find({ userId })
      .project({ _id: 0 })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async findDuplicate(userId, { company, position, jobUrl }) {
    const col = getApplicationsCollection();
    const companyRegex = new RegExp(`^${escapeRegex(company)}$`, 'i');
    const positionRegex = new RegExp(`^${escapeRegex(position)}$`, 'i');

    const urlCondition = jobUrl
      ? { jobUrl }
      : { $or: [{ jobUrl: { $exists: false } }, { jobUrl: '' }, { jobUrl: null }] };

    return await col.findOne({
      userId,
      company: { $regex: companyRegex },
      position: { $regex: positionRegex },
      ...urlCondition,
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

    const now = new Date().toISOString();
    const newApp = {
      id: uuidv4(),
      userId,
      ...sanitized,
      createdAt: now,
      updatedAt: now,
    };

    await col.insertOne(newApp);
    const { _id, ...cleanApp } = newApp;
    return cleanApp;
  }

  static async update(userId, id, rawUpdates) {
    const col = getApplicationsCollection();
    const cleanUpdates = {};

    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(rawUpdates, key)) {
        if (key === 'status') {
          if (!VALID_STATUSES.includes(rawUpdates.status)) {
            const err = new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
            err.statusCode = 400;
            throw err;
          }
          cleanUpdates.status = rawUpdates.status;
        } else if (key === 'jobUrl' || key === 'applyUrl' || key === 'companyUrl' || key === 'companyLogo') {
          cleanUpdates[key] = sanitizeHttpUrl(rawUpdates[key]);
        } else if (key === 'verifiedJob') {
          cleanUpdates.verifiedJob = Boolean(rawUpdates.verifiedJob);
        } else if (key === 'tags') {
          cleanUpdates.tags = sanitizeStringArray(rawUpdates.tags, 10, 60);
        } else if (key === 'requirements') {
          cleanUpdates.requirements = sanitizeStringArray(rawUpdates.requirements, 25, 360);
        } else if (key === 'description') {
          cleanUpdates.description = formatJobDescription(rawUpdates.description);
        } else if (key === 'company' || key === 'position') {
          const val = String(rawUpdates[key] || '').trim();
          if (!val) {
            const err = new Error(`${key} cannot be empty.`);
            err.statusCode = 400;
            throw err;
          }
          cleanUpdates[key] = val;
        } else if (key === 'appliedDate') {
          const val = String(rawUpdates.appliedDate || '').trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            cleanUpdates.appliedDate = val;
          }
        } else if (key === 'followUpDate') {
          const val = String(rawUpdates.followUpDate || '').trim();
          if (val === '' || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
            cleanUpdates.followUpDate = val;
          }
        } else if (key === 'resumeVersion') {
          cleanUpdates.resumeVersion = String(rawUpdates.resumeVersion || '').trim().slice(0, 120);
        } else if (key === 'referralContact') {
          cleanUpdates.referralContact = String(rawUpdates.referralContact || '').trim().slice(0, 140);
        } else if (key === 'aiMatch') {
          cleanUpdates.aiMatch = rawUpdates.aiMatch === null ? null : sanitizeAiMatch(rawUpdates.aiMatch);
        } else {
          cleanUpdates[key] = String(rawUpdates[key] || '').trim();
        }
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
    const col = getApplicationsCollection();
    const result = await col.deleteOne({ id, userId });
    if (result.deletedCount > 0) {
      const ivCol = getInterviewsCollection();
      if (ivCol) {
        await ivCol.updateMany(
          { userId, applicationId: id },
          { $set: { applicationId: '', updatedAt: new Date().toISOString() } }
        );
      }
      return true;
    }
    return false;
  }

  static async sync(userId, frontendApplications = []) {
    const col = getApplicationsCollection();
    if (!Array.isArray(frontendApplications)) {
      const err = new Error('frontendApplications must be an array');
      err.statusCode = 400;
      throw err;
    }

    const existing = await col.find({ userId }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray();
    const existingIds = new Set(existing.map((a) => a.id));

    let syncedCount = 0;
    const inserted = [];

    for (const candidate of frontendApplications) {
      if (!candidate || typeof candidate !== 'object') continue;
      try {
        const sanitized = validateJobData(candidate);
        if (candidate.id && existingIds.has(candidate.id)) continue;

        const duplicate = await this.findDuplicate(userId, sanitized);
        if (duplicate) continue;

        const now = new Date().toISOString();
        const doc = {
          id: candidate.id && !String(candidate.id).startsWith('local_') ? String(candidate.id) : uuidv4(),
          userId,
          ...sanitized,
          createdAt: candidate.createdAt || now,
          updatedAt: now,
        };
        await col.insertOne(doc);
        const { _id, ...cleanDoc } = doc;
        inserted.push(cleanDoc);
        existingIds.add(doc.id);
        syncedCount += 1;
      } catch {
        // Skip invalid individual records during batch sync
      }
    }

    const allAfter = await col.find({ userId }).project({ _id: 0 }).sort({ createdAt: -1 }).toArray();
    return {
      applications: allAfter,
      newApplications: existing,
      inserted,
      syncedCount,
    };
  }
}

module.exports = {
  ApplicationModel,
  VALID_STATUSES,
  escapeRegex,
  sanitizeHttpUrl,
  extractRequirementsFromDescription,
  validateJobData,
};
