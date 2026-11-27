const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const {
  getUsersCollection,
  getApplicationsCollection,
  getInterviewsCollection,
} = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeStringList(list, maxItems = 40, maxLen = 60) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const clean = String(item || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      out.push(clean);
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

function normalizeExperienceYears(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(30, Math.round(num * 10) / 10);
}

function sanitizeResumeContext(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const cleanText = (val, max = 1000) => String(val || '').replace(/\r\n/g, '\n').trim().slice(0, max);

  const projects = Array.isArray(raw.projects)
    ? raw.projects
        .slice(0, 12)
        .filter((p) => p && typeof p === 'object')
        .map((p) => ({
          name: cleanText(p.name, 140),
          stack: sanitizeStringList(p.stack, 15, 50),
          impactSummary: cleanText(p.impactSummary, 400),
          bullets: sanitizeStringList(p.bullets, 8, 280),
        }))
        .filter((p) => p.name)
    : [];

  const internshipsOrExperience = Array.isArray(raw.internshipsOrExperience)
    ? raw.internshipsOrExperience
        .slice(0, 10)
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
          role: cleanText(item.role, 120),
          organization: cleanText(item.organization, 120),
          duration: cleanText(item.duration, 80),
          highlights: sanitizeStringList(item.highlights, 8, 280),
        }))
        .filter((item) => item.role || item.organization)
    : [];

  return {
    fileName: cleanText(raw.fileName, 180),
    rawText: cleanText(raw.rawText, 30000),
    candidateSummary: cleanText(raw.candidateSummary, 2500),
    fullContextPrompt: cleanText(raw.fullContextPrompt, 12000),
    experienceYears: normalizeExperienceYears(raw.experienceYears),
    education: sanitizeStringList(raw.education, 10, 220),
    technicalSkills: sanitizeStringList(raw.technicalSkills, 60, 60),
    strengths: sanitizeStringList(raw.strengths, 12, 260),
    gapsToWatch: sanitizeStringList(raw.gapsToWatch, 12, 260),
    projects,
    internshipsOrExperience,
    model: cleanText(raw.model, 60),
    updatedAt: cleanText(raw.updatedAt, 60) || new Date().toISOString(),
  };
}

function sanitizeUser(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    email: doc.email,
    apiKey: doc.apiKey,
    skills: sanitizeStringList(doc.skills),
    targetRoles: sanitizeStringList(doc.targetRoles, 15, 80),
    experienceYears: normalizeExperienceYears(doc.experienceYears),
    resumeContext: sanitizeResumeContext(doc.resumeContext),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class UserModel {
  static async createUser({ name, email, password }) {
    const usersCollection = getUsersCollection();
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').toLowerCase().trim();

    if (!cleanName || cleanName.length < 2) {
      const err = new Error('Name must be at least 2 characters long.');
      err.statusCode = 400;
      throw err;
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      const err = new Error('Please enter a valid email address.');
      err.statusCode = 400;
      throw err;
    }

    if (!password || String(password).length < 6) {
      const err = new Error('Password must be at least 6 characters long.');
      err.statusCode = 400;
      throw err;
    }

    const existing = await usersCollection.findOne({ email: cleanEmail });
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(password), salt);
    const apiKey = 'jt_' + crypto.randomBytes(20).toString('hex');
    const now = new Date().toISOString();

    const newUser = {
      id: uuidv4(),
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      apiKey,
      skills: [],
      targetRoles: [],
      experienceYears: 0,
      resumeContext: null,
      createdAt: now,
      updatedAt: now,
    };

    await usersCollection.insertOne(newUser);
    return sanitizeUser(newUser);
  }

  static async findByEmail(email) {
    const usersCollection = getUsersCollection();
    return await usersCollection.findOne({ email: String(email || '').toLowerCase().trim() });
  }

  static async findById(id) {
    const usersCollection = getUsersCollection();
    return await usersCollection.findOne({ id });
  }

  static async findByApiKey(apiKey) {
    const usersCollection = getUsersCollection();
    return await usersCollection.findOne({ apiKey });
  }

  static async verifyPassword(plainPassword, passwordHash) {
    return await bcrypt.compare(String(plainPassword || ''), passwordHash);
  }

  static async updateProfile(userId, { name, skills, targetRoles, experienceYears, resumeContext }) {
    const usersCollection = getUsersCollection();
    const updates = { updatedAt: new Date().toISOString() };

    if (name !== undefined) {
      const cleanName = String(name || '').trim();
      if (!cleanName || cleanName.length < 2) {
        const err = new Error('Name must be at least 2 characters long.');
        err.statusCode = 400;
        throw err;
      }
      updates.name = cleanName;
    }

    if (skills !== undefined) {
      updates.skills = sanitizeStringList(skills);
    }

    if (targetRoles !== undefined) {
      updates.targetRoles = sanitizeStringList(targetRoles, 15, 80);
    }

    if (experienceYears !== undefined) {
      updates.experienceYears = normalizeExperienceYears(experienceYears);
    }

    if (resumeContext !== undefined) {
      updates.resumeContext = resumeContext === null ? null : sanitizeResumeContext(resumeContext);
    }

    await usersCollection.updateOne({ id: userId }, { $set: updates });

    const updated = await usersCollection.findOne({ id: userId });
    return sanitizeUser(updated);
  }

  static async updatePassword(userId, { currentPassword, newPassword }) {
    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ id: userId });
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const isMatch = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      const err = new Error('Current password is incorrect.');
      err.statusCode = 401;
      throw err;
    }

    if (!newPassword || String(newPassword).length < 6) {
      const err = new Error('New password must be at least 6 characters long.');
      err.statusCode = 400;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(String(newPassword), salt);
    await usersCollection.updateOne(
      { id: userId },
      { $set: { passwordHash, updatedAt: new Date().toISOString() } }
    );
    return true;
  }

  static async regenerateApiKey(userId) {
    const usersCollection = getUsersCollection();
    const newApiKey = 'jt_' + crypto.randomBytes(20).toString('hex');
    await usersCollection.updateOne(
      { id: userId },
      { $set: { apiKey: newApiKey, updatedAt: new Date().toISOString() } }
    );
    return newApiKey;
  }

  static async deleteAccount(userId) {
    const usersCollection = getUsersCollection();
    const appsCollection = getApplicationsCollection();
    const interviewsCollection = getInterviewsCollection();

    await appsCollection.deleteMany({ userId });
    await interviewsCollection.deleteMany({ userId });
    const result = await usersCollection.deleteOne({ id: userId });
    return result.deletedCount > 0;
  }
}

UserModel.sanitizeUser = sanitizeUser;
UserModel.sanitizeResumeContext = sanitizeResumeContext;
module.exports = UserModel;
