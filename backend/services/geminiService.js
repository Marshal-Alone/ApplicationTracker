const { GoogleGenAI } = require('@google/genai');

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
const GEMINI_API_VERSION = 'v1beta';
const GEMINI_FALLBACK_MODELS = [
  'gemini-4-hydrogen',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-4-argon',
];

function isTransientCapacityError(error) {
  const status = Number(error?.statusCode || error?.status);
  const msg = String(error?.message || '').toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    status === 502 ||
    msg.includes('high demand') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('capacity') ||
    msg.includes('try again later') ||
    msg.includes('rate limit') ||
    msg.includes('quota')
  );
}

const EXTENSION_MIME_MAP = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};

const SUPPORTED_BINARY_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

function resolveResumeMimeType(fileName, mimeType) {
  const cleanMime = String(mimeType || '').toLowerCase().trim();
  if (cleanMime && cleanMime !== 'application/octet-stream') {
    return cleanMime;
  }
  const lowerName = String(fileName || '').toLowerCase().trim();
  const matchedExt = Object.keys(EXTENSION_MIME_MAP).find((ext) => lowerName.endsWith(ext));
  return matchedExt ? EXTENSION_MIME_MAP[matchedExt] : cleanMime;
}

function extractReadableGeminiMessage(error) {
  const candidates = [error?.error, error?.body, error?.data$, error?.message];
  for (const candidate of candidates) {
    if (!candidate) continue;
    let obj = candidate;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      const braceIdx = trimmed.indexOf('{');
      const bracketIdx = trimmed.indexOf('[');
      const firstJson = Math.min(
        braceIdx >= 0 ? braceIdx : Infinity,
        bracketIdx >= 0 ? bracketIdx : Infinity
      );
      if (Number.isFinite(firstJson)) {
        try {
          obj = JSON.parse(trimmed.slice(firstJson));
        } catch {
          obj = null;
        }
      } else {
        obj = null;
      }
      if (!obj) {
        if (!trimmed.includes('httpMeta')) return trimmed;
        continue;
      }
    }
    const items = Array.isArray(obj) ? obj : [obj];
    for (const item of items) {
      if (item?.error?.message) return String(item.error.message).trim();
      if (typeof item?.message === 'string' && item.message.trim()) return item.message.trim();
    }
  }
  return 'Gemini API request failed.';
}

function normalizeGeminiApiError(error) {
  const rawStatus = Number(error?.statusCode || error?.status);
  const statusCode = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 502;
  let message = extractReadableGeminiMessage(error);

  const lower = message.toLowerCase();
  if (statusCode === 401 || lower.includes('api key not valid') || lower.includes('api_key_invalid')) {
    message = 'Invalid Gemini API key. Check your key in Google AI Studio and save it again.';
  } else if (statusCode === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    message = 'Gemini API quota or rate limit reached. Wait a moment and retry.';
  } else if (message.length > 260) {
    message = `${message.slice(0, 257).trim()}...`;
  }

  const normalized = new Error(message);
  normalized.statusCode = statusCode;
  normalized.code = error?.code || 'GEMINI_API_ERROR';
  return normalized;
}

let testInteractionsOverride = null;

function setTestInteractionsOverride(handler) {
  if (process.env.NODE_ENV === 'test') {
    testInteractionsOverride = typeof handler === 'function' ? handler : null;
  }
}

const RESUME_CONTEXT_SCHEMA = {
  type: 'object',
  properties: {
    rawText: {
      type: 'string',
      description: 'Clean full plain-text extraction preserving all sections and bullets from the resume.',
    },
    candidateSummary: {
      type: 'string',
      description: 'Concise 2-4 sentence synthesis of candidate background, target stack, and fresher readiness.',
    },
    experienceYears: {
      type: 'number',
      description: 'Estimated full-time equivalent years of professional work experience (use 0 for freshers or 0.5 for internships).',
    },
    education: {
      type: 'array',
      items: { type: 'string' },
      description: 'Degree, institution, graduation year, and key academic highlights.',
    },
    technicalSkills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Verified programming languages, frameworks, databases, tools, and cloud skills present in the resume.',
    },
    projects: {
      type: 'array',
      description: 'Key engineering or academic projects extracted from the resume.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          stack: { type: 'array', items: { type: 'string' } },
          impactSummary: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'stack', 'impactSummary', 'bullets'],
      },
    },
    internshipsOrExperience: {
      type: 'array',
      description: 'Internships, work experience, or teaching assistant roles.',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          organization: { type: 'string' },
          duration: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
        },
        required: ['role', 'organization', 'highlights'],
      },
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete strengths evident from real projects, metrics, or coursework.',
    },
    gapsToWatch: {
      type: 'array',
      items: { type: 'string' },
      description: 'Honest gaps for entry-level SWE applications (e.g. missing metrics on bullets, no testing mentioned).',
    },
    fullContextPrompt: {
      type: 'string',
      description: 'Dense comprehensive candidate digest preserving project facts, metrics, stack depth, internships, and constraints for future job matching.',
    },
  },
  required: [
    'rawText',
    'candidateSummary',
    'experienceYears',
    'education',
    'technicalSkills',
    'projects',
    'strengths',
    'gapsToWatch',
    'fullContextPrompt',
  ],
};

const JOB_MATCH_SCHEMA = {
  type: 'object',
  properties: {
    overallVerdict: {
      type: 'string',
      enum: [
        'Strong fresher fit',
        'Good fit with tailoring',
        'Stretch role (referral advised)',
        'High experience gap',
      ],
    },
    fitSummary: {
      type: 'string',
      description: 'Direct 2-3 sentence summary explaining how well the candidate matches this exact JD using real projects/skills from their resume context.',
    },
    experienceCheck: {
      type: 'string',
      description: 'Honest YOE check comparing the job requirements against the candidate experience and internships.',
    },
    matchedHighlights: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific matched skills, internships, or named projects from the candidate context that satisfy JD requirements.',
    },
    missingKeywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Important JD technical skills or qualifications missing or under-emphasized in the resume.',
    },
    resumeEdits: {
      type: 'array',
      description: 'Honest, actionable changes to tailor the resume for this role without inventing fake experience.',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string', description: 'e.g., Skills, Project: <name>, Summary, Experience' },
          currentFocus: { type: 'string', description: 'What is currently weak, buried, or missing.' },
          suggestedChange: { type: 'string', description: 'Concrete rewrite or adjustment grounded strictly in candidate reality.' },
          reason: { type: 'string', description: 'Why this improves ATS match or recruiter scan for this JD.' },
        },
        required: ['section', 'currentFocus', 'suggestedChange', 'reason'],
      },
    },
    prepFocusTopics: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 targeted technical topics or project deep-dive questions likely asked in interviews for this role.',
    },
    tailoredOutreachHook: {
      type: 'string',
      description: 'Concise 2-sentence referral or recruiter outreach hook citing the candidate actual best matching project and this exact job.',
    },
  },
  required: [
    'overallVerdict',
    'fitSummary',
    'experienceCheck',
    'matchedHighlights',
    'missingKeywords',
    'resumeEdits',
    'prepFocusTopics',
    'tailoredOutreachHook',
  ],
};

const DISCOVER_SELECTORS_SCHEMA = {
  type: 'object',
  properties: {
    selectors: {
      type: 'object',
      description:
        'Valid standard CSS selectors for document.querySelector on this page and sibling postings on the same domain. Use empty string when no stable unique CSS selector exists (never invent random CSS-module hashes if unstable).',
      properties: {
        positionSelector: { type: 'string' },
        companySelector: { type: 'string' },
        locationSelector: { type: 'string' },
        salarySelector: { type: 'string' },
        descriptionSelector: { type: 'string' },
        applyUrlSelector: { type: 'string' },
        requirementsSelector: { type: 'string' },
      },
      required: [
        'positionSelector',
        'companySelector',
        'locationSelector',
        'salarySelector',
        'descriptionSelector',
        'applyUrlSelector',
      ],
    },
    fallbackData: {
      type: 'object',
      description: 'Direct extracted job values from the provided DOM skeleton / visible text as an immediate fallback.',
      properties: {
        company: { type: 'string' },
        position: { type: 'string' },
        location: { type: 'string' },
        salary: { type: 'string' },
        applyUrl: { type: 'string' },
        description: { type: 'string' },
        requirements: { type: 'array', items: { type: 'string' } },
      },
      required: ['company', 'position', 'description'],
    },
    notes: {
      type: 'string',
      description: 'Brief note about layout type or caveat (e.g. generic multi-role board, iframe embed, Tailwind classes).',
    },
  },
  required: ['selectors', 'fallbackData'],
};

function extractJsonPayload(rawOutput) {
  const txt = String(rawOutput || '').trim();
  if (!txt) {
    throw new Error('Empty response returned by Gemini API.');
  }
  try {
    return JSON.parse(txt);
  } catch {
    const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const firstBrace = txt.indexOf('{');
    const lastBrace = txt.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(txt.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Gemini returned malformed JSON.');
  }
}

async function invokeSingleModel({ apiKey, input, schema, model, ai }) {
  if (process.env.NODE_ENV === 'test' && testInteractionsOverride) {
    return await testInteractionsOverride({
      apiKey,
      apiVersion: GEMINI_API_VERSION,
      model,
      input,
      schema,
    });
  }

  let interaction;
  try {
    interaction = await ai.interactions.create({
      api_version: GEMINI_API_VERSION,
      model,
      input,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema,
      },
    });
  } catch (err) {
    throw normalizeGeminiApiError(err);
  }

  if (interaction?.status && interaction.status === 'failed') {
    throw normalizeGeminiApiError({
      statusCode: 502,
      message: interaction.error?.message || 'Gemini interaction failed.',
    });
  }

  let rawText = interaction?.output_text;
  if (!rawText && Array.isArray(interaction?.steps)) {
    rawText = interaction.steps
      .filter((s) => s?.type === 'model_output' && Array.isArray(s.content))
      .flatMap((s) => s.content)
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
  }

  return extractJsonPayload(rawText);
}

async function runStructuredInteraction({ apiKey, input, schema, model = DEFAULT_GEMINI_MODEL }) {
  const isMockedTest = process.env.NODE_ENV === 'test' && Boolean(testInteractionsOverride);
  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey && !isMockedTest) {
    const err = new Error(
      'Gemini API key missing. Add GEMINI_API_KEY in backend/.env or configure your personal key in Settings.'
    );
    err.statusCode = 400;
    err.code = 'GEMINI_KEY_MISSING';
    throw err;
  }

  // Content arrays ({ type: 'document' | 'text' }) on Interactions API require v1beta
  const ai = isMockedTest
    ? null
    : new GoogleGenAI({ apiKey: trimmedKey, apiVersion: GEMINI_API_VERSION });

  const candidateModels = Array.from(new Set([model, ...GEMINI_FALLBACK_MODELS].filter(Boolean)));
  let lastError = null;

  for (let i = 0; i < candidateModels.length; i += 1) {
    const candidateModel = candidateModels[i];
    try {
      const parsed = await invokeSingleModel({
        apiKey: trimmedKey,
        input,
        schema,
        model: candidateModel,
        ai,
      });
      if (parsed && typeof parsed === 'object') {
        Object.defineProperty(parsed, '_modelUsed', {
          value: candidateModel,
          enumerable: false,
          configurable: true,
        });
      }
      return parsed;
    } catch (err) {
      const normalized = err?.code && err?.statusCode ? err : normalizeGeminiApiError(err);
      lastError = normalized;
      const hasMoreModels = i < candidateModels.length - 1;
      if (hasMoreModels && isTransientCapacityError(normalized)) {
        continue;
      }
      throw normalized;
    }
  }

  throw lastError || new Error('Gemini API request failed.');
}

async function parseAndSynthesizeResume({
  apiKey,
  fileName = 'Resume',
  mimeType = '',
  fileDataBase64 = '',
  resumeText = '',
  targetRolesHint = '',
}) {
  const inputParts = [];
  let decodedPlainText = String(resumeText || '').trim();

  const cleanMime = resolveResumeMimeType(fileName, mimeType);
  const cleanBase64 = String(fileDataBase64 || '')
    .replace(/^data:[^;]+;base64,/, '')
    .replace(/\s+/g, '')
    .trim();

  if (cleanBase64 && SUPPORTED_BINARY_MIME_TYPES.has(cleanMime)) {
    inputParts.push({
      type: 'document',
      data: cleanBase64,
      mime_type: cleanMime,
    });
  } else if (cleanBase64 && (!cleanMime || cleanMime.startsWith('text/') || cleanMime === 'application/octet-stream')) {
    try {
      const textFromBase64 = Buffer.from(cleanBase64, 'base64').toString('utf8').trim();
      if (textFromBase64 && !decodedPlainText) {
        decodedPlainText = textFromBase64;
      }
    } catch {
      // Ignore invalid base64 fallback
    }
  }

  if (!decodedPlainText && inputParts.length === 0) {
    const err = new Error('Upload a PDF/DOCX/TXT resume or paste your resume text.');
    err.statusCode = 400;
    throw err;
  }

  const instructions = [
    'You are an experienced engineering hiring manager and career coach helping a fresher / entry-level developer.',
    'Parse the candidate resume completely and synthesize a persistent full-context representation ("Master Resume Context").',
    'Rules:',
    '1. Extract ONLY skills, projects, metrics, education, and internships genuinely present in the resume.',
    '2. Keep project bullets concrete and preserve metrics if present.',
    '3. In fullContextPrompt, write a detailed structured digest containing all technical skills, projects + tech stacks, measurable impacts, degree/grad year, and experience level so every future job application can be compared accurately against this complete resume.',
    targetRolesHint ? `4. Candidate target roles hint: ${targetRolesHint}` : '',
    decodedPlainText ? `\n--- RESUME TEXT ---\n${decodedPlainText.slice(0, 28000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const interactionInput =
    inputParts.length > 0 ? [...inputParts, { type: 'text', text: instructions }] : instructions;

  const parsed = await runStructuredInteraction({
    apiKey,
    input: interactionInput,
    schema: RESUME_CONTEXT_SCHEMA,
  });

  return {
    fileName: String(fileName || 'Resume').trim(),
    rawText: parsed.rawText || decodedPlainText,
    candidateSummary: parsed.candidateSummary || '',
    experienceYears: Number.isFinite(Number(parsed.experienceYears)) ? Number(parsed.experienceYears) : 0,
    education: Array.isArray(parsed.education) ? parsed.education : [],
    technicalSkills: Array.isArray(parsed.technicalSkills) ? parsed.technicalSkills : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    internshipsOrExperience: Array.isArray(parsed.internshipsOrExperience)
      ? parsed.internshipsOrExperience
      : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    gapsToWatch: Array.isArray(parsed.gapsToWatch) ? parsed.gapsToWatch : [],
    fullContextPrompt: parsed.fullContextPrompt || parsed.candidateSummary || decodedPlainText,
    model: parsed._modelUsed || DEFAULT_GEMINI_MODEL,
    updatedAt: new Date().toISOString(),
  };
}

async function analyzeJobWithResumeContext({ apiKey, resumeContext, job }) {
  if (!resumeContext || typeof resumeContext !== 'object') {
    const err = new Error('Build your Master Resume Context first in Settings before running AI job matching.');
    err.statusCode = 400;
    err.code = 'RESUME_CONTEXT_MISSING';
    throw err;
  }

  const jobCompany = String(job?.company || '').trim();
  const jobPosition = String(job?.position || '').trim();
  if (!jobCompany || !jobPosition) {
    const err = new Error('Job company and position are required for AI matching.');
    err.statusCode = 400;
    throw err;
  }

  const reqLines = Array.isArray(job?.requirements) ? job.requirements : [];

  const prompt = [
    'You are advising a fresher / new-grad software candidate evaluating a specific job opening using their FULL Master Resume Context.',
    'Strict truthfulness rule: NEVER fabricate technologies, projects, metrics, or work history not present in the Master Resume Context. When suggesting resume edits, only tell the candidate how to reword, highlight, reorder, or truthfully clarify their real experience, OR explicitly note genuine missing skills they should check/learn.',
    '',
    '=== CANDIDATE FULL MASTER RESUME CONTEXT ===',
    `Summary: ${resumeContext.candidateSummary || ''}`,
    `Experience years: ${resumeContext.experienceYears ?? 0}`,
    `Education: ${(resumeContext.education || []).join(' | ')}`,
    `Verified Skills: ${(resumeContext.technicalSkills || []).join(', ')}`,
    `Strengths: ${(resumeContext.strengths || []).join(' | ')}`,
    `Known Resume Gaps: ${(resumeContext.gapsToWatch || []).join(' | ')}`,
    `Projects:\n${(resumeContext.projects || [])
      .map(
        (p) =>
          `- ${p.name} [${(p.stack || []).join(', ')}]: ${p.impactSummary || ''} ${(p.bullets || []).join('; ')}`
      )
      .join('\n')}`,
    resumeContext.internshipsOrExperience?.length
      ? `Internships / Experience:\n${resumeContext.internshipsOrExperience
          .map((e) => `- ${e.role} @ ${e.organization} (${e.duration || ''}): ${(e.highlights || []).join('; ')}`)
          .join('\n')}`
      : '',
    resumeContext.fullContextPrompt ? `Full Digest:\n${resumeContext.fullContextPrompt}` : '',
    '',
    '=== TARGET JOB POSTING ===',
    `Company: ${jobCompany}`,
    `Role: ${jobPosition}`,
    job.location ? `Location: ${job.location}` : '',
    job.salary ? `Compensation: ${job.salary}` : '',
    job.jobUrl ? `Posting URL: ${job.jobUrl}` : '',
    job.applyUrl ? `Apply URL: ${job.applyUrl}` : '',
    reqLines.length > 0 ? `Extracted Requirements:\n- ${reqLines.join('\n- ')}` : '',
    job.description ? `Full Job Description:\n${String(job.description).slice(0, 12000)}` : '',
    '',
    'Analyze fit honestly for a fresher, give 2-5 ultra-concrete resume edits referencing specific sections/projects from the resume above, and generate a crisp 2-sentence referral hook.',
  ]
    .filter(Boolean)
    .join('\n');

  const analysis = await runStructuredInteraction({
    apiKey,
    input: prompt,
    schema: JOB_MATCH_SCHEMA,
  });

  return {
    overallVerdict: analysis.overallVerdict || 'Good fit with tailoring',
    fitSummary: analysis.fitSummary || '',
    experienceCheck: analysis.experienceCheck || '',
    matchedHighlights: Array.isArray(analysis.matchedHighlights) ? analysis.matchedHighlights : [],
    missingKeywords: Array.isArray(analysis.missingKeywords) ? analysis.missingKeywords : [],
    resumeEdits: Array.isArray(analysis.resumeEdits) ? analysis.resumeEdits : [],
    prepFocusTopics: Array.isArray(analysis.prepFocusTopics) ? analysis.prepFocusTopics : [],
    tailoredOutreachHook: analysis.tailoredOutreachHook || '',
    model: analysis._modelUsed || DEFAULT_GEMINI_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

function sanitizeSelectorValue(sel) {
  const clean = String(sel || '')
    .replace(/^`+|`+$/g, '')
    .trim();
  if (!clean || clean.length > 220) return '';
  return clean;
}

async function discoverJobSelectors({
  apiKey,
  url = '',
  hostname = '',
  title = '',
  domSkeleton = '',
  visibleTextExcerpt = '',
}) {
  const cleanSkeleton = String(domSkeleton || '').trim().slice(0, 24000);
  const cleanExcerpt = String(visibleTextExcerpt || '').trim().slice(0, 10000);
  if (!cleanSkeleton && !cleanExcerpt) {
    const err = new Error('Page DOM skeleton or visible text excerpt is required.');
    err.statusCode = 400;
    throw err;
  }

  const prompt = [
    'You are analyzing a live job posting HTML DOM skeleton so a browser extension can reliably extract job fields and cache reusable CSS selectors per domain.',
    'Rules:',
    '1. Return standard CSS selectors compatible with document.querySelector(...) for positionSelector, companySelector, locationSelector, salarySelector, descriptionSelector, applyUrlSelector, and optional requirementsSelector.',
    '2. Prefer semantic hooks ([data-testid=...], [data-qa=...], [itemprop=...], #id, main h1, specific landmark/class combinations). Avoid fragile pseudo-selectors (:contains, :has-text) and avoid long generated utility chains.',
    '3. If a field has no reliable unique selector (or classes look hashed/random or the value only appears in text/title), set that selector to "" and still populate fallbackData accurately from the observed skeleton/text.',
    '4. NEVER fabricate job details not present in the DOM skeleton or visible excerpt.',
    '',
    url ? `URL: ${url}` : '',
    hostname ? `Hostname: ${hostname}` : '',
    title ? `Document Title: ${title}` : '',
    cleanSkeleton ? `\n=== STRIPPED DOM SKELETON ===\n${cleanSkeleton}` : '',
    cleanExcerpt ? `\n=== VISIBLE TEXT EXCERPT ===\n${cleanExcerpt}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const discovered = await runStructuredInteraction({
    apiKey,
    input: prompt,
    schema: DISCOVER_SELECTORS_SCHEMA,
  });

  const rawSelectors = discovered?.selectors || {};
  const rawFallback = discovered?.fallbackData || {};

  return {
    selectors: {
      positionSelector: sanitizeSelectorValue(rawSelectors.positionSelector),
      companySelector: sanitizeSelectorValue(rawSelectors.companySelector),
      locationSelector: sanitizeSelectorValue(rawSelectors.locationSelector),
      salarySelector: sanitizeSelectorValue(rawSelectors.salarySelector),
      descriptionSelector: sanitizeSelectorValue(rawSelectors.descriptionSelector),
      applyUrlSelector: sanitizeSelectorValue(rawSelectors.applyUrlSelector),
      requirementsSelector: sanitizeSelectorValue(rawSelectors.requirementsSelector),
    },
    fallbackData: {
      company: String(rawFallback.company || '').trim().slice(0, 120),
      position: String(rawFallback.position || '').trim().slice(0, 160),
      location: String(rawFallback.location || '').trim().slice(0, 140),
      salary: String(rawFallback.salary || '').trim().slice(0, 140),
      applyUrl: String(rawFallback.applyUrl || '').trim().slice(0, 500),
      description: String(rawFallback.description || '').trim().slice(0, 16000),
      requirements: Array.isArray(rawFallback.requirements)
        ? rawFallback.requirements.map((r) => String(r || '').trim()).filter(Boolean).slice(0, 25)
        : [],
    },
    notes: String(discovered?.notes || '').trim().slice(0, 280),
    model: discovered._modelUsed || DEFAULT_GEMINI_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  GEMINI_API_VERSION,
  parseAndSynthesizeResume,
  analyzeJobWithResumeContext,
  discoverJobSelectors,
  setTestInteractionsOverride,
  normalizeGeminiApiError,
};
