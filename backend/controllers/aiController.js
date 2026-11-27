const UserModel = require('../models/User');
const { ApplicationModel } = require('../models/Application');
const { getApplicationsCollection } = require('../config/db');
const {
  DEFAULT_GEMINI_MODEL,
  parseAndSynthesizeResume,
  analyzeJobWithResumeContext,
  discoverJobSelectors,
} = require('../services/geminiService');

function resolveEffectiveGeminiKey(req) {
  const headerKey =
    typeof req.headers['x-gemini-api-key'] === 'string' ? req.headers['x-gemini-api-key'].trim() : '';

  if (headerKey) {
    return { apiKey: headerKey, source: 'user' };
  }

  // Only authenticated users may invoke server-funded GEMINI_API_KEY
  if (req.userId && process.env.GEMINI_API_KEY) {
    return { apiKey: process.env.GEMINI_API_KEY.trim(), source: 'server' };
  }

  return { apiKey: '', source: 'none' };
}

class AiController {
  static async getStatus(req, res) {
    res.json({
      success: true,
      serverConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
      model: DEFAULT_GEMINI_MODEL,
    });
  }

  static async buildResumeContext(req, res) {
    try {
      const { apiKey } = resolveEffectiveGeminiKey(req);
      if (!apiKey) {
        const message = !req.userId
          ? 'Provide your personal Gemini API key in Settings -> AI Resume Copilot (or sign in).'
          : 'Add your Gemini API key in Settings -> AI Resume Copilot or set GEMINI_API_KEY on the backend.';
        return res.status(400).json({
          success: false,
          code: 'GEMINI_KEY_MISSING',
          error: message,
        });
      }

      const { fileName, mimeType, fileDataBase64, resumeText, targetRolesHint } = req.body || {};

      const rawContext = await parseAndSynthesizeResume({
        apiKey,
        fileName,
        mimeType,
        fileDataBase64,
        resumeText,
        targetRolesHint,
      });

      const cleanContext = UserModel.sanitizeResumeContext(rawContext);

      if (req.userId) {
        const existingUser = await UserModel.findById(req.userId);
        const existingSkills = Array.isArray(existingUser?.skills) ? existingUser.skills : [];
        const mergedSkills = Array.from(
          new Set([...cleanContext.technicalSkills, ...existingSkills])
        );
        const parsedRoles = targetRolesHint
          ? String(targetRolesHint)
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean)
          : existingUser?.targetRoles;

        const updatedUser = await UserModel.updateProfile(req.userId, {
          resumeContext: cleanContext,
          skills: mergedSkills,
          experienceYears: cleanContext.experienceYears,
          ...(parsedRoles ? { targetRoles: parsedRoles } : {}),
        });

        return res.json({
          success: true,
          resumeContext: updatedUser.resumeContext,
          user: updatedUser,
        });
      }

      res.json({
        success: true,
        resumeContext: cleanContext,
      });
    } catch (error) {
      const status = error.statusCode || error.status || 500;
      if (process.env.NODE_ENV !== 'test' || status >= 500) {
        console.error('buildResumeContext error:', error);
      }
      res.status(status).json({
        success: false,
        code: error.code || 'AI_RESUME_ERROR',
        error: error.message || 'Failed to analyze resume with Gemini AI.',
      });
    }
  }

  static async matchJob(req, res) {
    try {
      const { apiKey } = resolveEffectiveGeminiKey(req);
      if (!apiKey) {
        const message = !req.userId
          ? 'Provide your personal Gemini API key in Settings -> AI Resume Copilot (or sign in).'
          : 'Add your Gemini API key in Settings -> AI Resume Copilot or set GEMINI_API_KEY on the backend.';
        return res.status(400).json({
          success: false,
          code: 'GEMINI_KEY_MISSING',
          error: message,
        });
      }

      const {
        applicationId,
        company,
        position,
        location,
        salary,
        jobUrl,
        applyUrl,
        requirements,
        description,
        resumeContext: bodyContext,
      } = req.body || {};

      let activeContext = bodyContext ? UserModel.sanitizeResumeContext(bodyContext) : null;
      let existingApp = null;

      if (req.userId) {
        const user = await UserModel.findById(req.userId);
        if (!activeContext && user?.resumeContext) {
          activeContext = UserModel.sanitizeResumeContext(user.resumeContext);
        }
        if (applicationId) {
          const appsCol = getApplicationsCollection();
          existingApp = await appsCol.findOne(
            { id: String(applicationId), userId: req.userId },
            { projection: { _id: 0 } }
          );
          if (!existingApp) {
            return res.status(404).json({ success: false, error: 'Application not found.' });
          }
        }
      }

      const targetJob = existingApp
        ? {
            company: company || existingApp.company,
            position: position || existingApp.position,
            location: location ?? existingApp.location,
            salary: salary ?? existingApp.salary,
            jobUrl: jobUrl ?? existingApp.jobUrl,
            applyUrl: applyUrl ?? existingApp.applyUrl,
            requirements: Array.isArray(requirements) && requirements.length > 0 ? requirements : existingApp.requirements,
            description: description ?? existingApp.description,
          }
        : {
            company,
            position,
            location,
            salary,
            jobUrl,
            applyUrl,
            requirements,
            description,
          };

      const aiMatch = await analyzeJobWithResumeContext({
        apiKey,
        resumeContext: activeContext,
        job: targetJob,
      });

      if (req.userId && existingApp) {
        const updatedApp = await ApplicationModel.update(req.userId, existingApp.id, { aiMatch });
        return res.json({
          success: true,
          aiMatch: updatedApp.aiMatch,
          application: updatedApp,
        });
      }

      res.json({
        success: true,
        aiMatch,
      });
    } catch (error) {
      const status = error.statusCode || error.status || 500;
      if (process.env.NODE_ENV !== 'test' || status >= 500) {
        console.error('matchJob error:', error);
      }
      res.status(status).json({
        success: false,
        code: error.code || 'AI_MATCH_ERROR',
        error: error.message || 'Failed to match job with Gemini AI.',
      });
    }
  }

  static async discoverSelectors(req, res) {
    try {
      const { apiKey } = resolveEffectiveGeminiKey(req);
      if (!apiKey) {
        const message = !req.userId
          ? 'Provide your personal Gemini API key in Settings -> AI Resume Copilot (or Extension settings).'
          : 'Add your Gemini API key in Settings -> AI Resume Copilot or set GEMINI_API_KEY on the backend.';
        return res.status(400).json({
          success: false,
          code: 'GEMINI_KEY_MISSING',
          error: message,
        });
      }

      const { url, hostname, title, domSkeleton, visibleTextExcerpt } = req.body || {};

      const result = await discoverJobSelectors({
        apiKey,
        url,
        hostname,
        title,
        domSkeleton,
        visibleTextExcerpt,
      });

      res.json({
        success: true,
        hostname: String(hostname || '').toLowerCase().trim(),
        ...result,
      });
    } catch (error) {
      const status = error.statusCode || error.status || 500;
      if (process.env.NODE_ENV !== 'test' || status >= 500) {
        console.error('discoverSelectors error:', error);
      }
      res.status(status).json({
        success: false,
        code: error.code || 'AI_SELECTOR_DISCOVERY_ERROR',
        error: error.message || 'Failed to analyze page DOM with Gemini AI.',
      });
    }
  }
}

module.exports = AiController;
