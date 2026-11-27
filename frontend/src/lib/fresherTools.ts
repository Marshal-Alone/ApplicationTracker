import { Interview, JobApplication } from '@/types/tracker';

export const FRESHER_SKILL_PRESETS: string[] = [
  'Java',
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Node.js',
  'Spring Boot',
  'SQL',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Git',
  'Docker',
  'AWS',
  'REST APIs',
  'GraphQL',
  'C++',
  'Kafka',
  'Redis',
  'Linux',
  'Tailwind CSS',
  'Unit Testing',
];

interface SkillMatcher {
  label: string;
  pattern: RegExp;
}

const KNOWN_SKILLS: SkillMatcher[] = [
  { label: 'JavaScript', pattern: /\bjavascript\b|\bes6\+?\b/i },
  { label: 'TypeScript', pattern: /\btypescript\b|\bts\b/i },
  { label: 'Java', pattern: /\bjava(?:\s*(?:8|11|17|21))?\b/i },
  { label: 'Python', pattern: /\bpython\b/i },
  { label: 'C++', pattern: /(?:^|[\s(/,])c\+\+(?:$|[\s),./])/i },
  { label: 'C#', pattern: /(?:^|[\s(/,])c#(?:$|[\s),./])/i },
  { label: 'Go', pattern: /\bgolang\b|(?:^|[\s(/,])Go(?:$|[\s),./])/ },
  { label: 'Rust', pattern: /\brust\b/i },
  { label: 'React', pattern: /\breact(?:\.?js)?\b/i },
  { label: 'Next.js', pattern: /\bnext\.?js\b/i },
  { label: 'Angular', pattern: /\bangular\b/i },
  { label: 'Vue', pattern: /\bvue(?:\.?js)?\b/i },
  { label: 'Tailwind CSS', pattern: /\btailwind(?:\s*css)?\b/i },
  { label: 'HTML/CSS', pattern: /\bhtml5?\b|\bcss3?\b/i },
  { label: 'Node.js', pattern: /\bnode\.?js\b/i },
  { label: 'Express', pattern: /\bexpress(?:\.?js)?\b/i },
  { label: 'Spring Boot', pattern: /\bspring\s*boot\b|\bspring\b/i },
  { label: 'Django', pattern: /\bdjango\b/i },
  { label: 'Flask', pattern: /\bflask\b/i },
  { label: 'FastAPI', pattern: /\bfastapi\b/i },
  { label: '.NET', pattern: /(?:^|[\s(/,])\.net(?:\s*core)?(?:$|[\s),./])/i },
  { label: 'SQL', pattern: /\bsql\b|\btsql\b|\bpl\/?sql\b/i },
  { label: 'PostgreSQL', pattern: /\bpostgres(?:ql)?\b/i },
  { label: 'MySQL', pattern: /\bmysql\b/i },
  { label: 'Oracle', pattern: /\boracle(?:\s*db)?\b/i },
  { label: 'MongoDB', pattern: /\bmongo(?:db)?\b/i },
  { label: 'Redis', pattern: /\bredis\b/i },
  { label: 'Kafka', pattern: /\bkafka\b/i },
  { label: 'RabbitMQ', pattern: /\brabbitmq\b/i },
  { label: 'Docker', pattern: /\bdocker\b/i },
  { label: 'Kubernetes', pattern: /\bkubernetes\b|\bk8s\b/i },
  { label: 'AWS', pattern: /\baws\b|\bamazon web services\b/i },
  { label: 'GCP', pattern: /\bgcp\b|\bgoogle cloud\b/i },
  { label: 'Azure', pattern: /\bazure\b/i },
  { label: 'CI/CD', pattern: /\bci\/cd\b|\bgithub actions\b|\bjenkins\b/i },
  { label: 'Git', pattern: /\bgit\b|\bgithub\b|\bgitlab\b/i },
  { label: 'REST APIs', pattern: /\brest(?:ful)?\s*apis?\b|\brest api\b/i },
  { label: 'GraphQL', pattern: /\bgraphql\b/i },
  { label: 'Microservices', pattern: /\bmicroservices?\b/i },
  { label: 'System Design', pattern: /\bsystem design\b|\bdistributed systems?\b/i },
  { label: 'Data Structures & Algorithms', pattern: /\bdata structures?\b|\balgorithms?\b|\bdsa\b/i },
  { label: 'Unit Testing', pattern: /\bunit testing\b|\bjunit\b|\bjest\b|\bvitest\b|\bpytest\b/i },
  { label: 'Linux', pattern: /\blinux\b|\bunix\b/i },
  { label: 'Agile', pattern: /\bagile\b|\bscrum\b/i },
  { label: 'Zustand/Redux', pattern: /\bzustand\b|\bredux\b/i },
  { label: 'NoSQL', pattern: /\bnosql\b/i },
];

export type ExperienceSignalKind =
  | 'fresher_friendly'
  | 'stretch'
  | 'experienced_mismatch'
  | 'unspecified';

export interface ExperienceSignal {
  kind: ExperienceSignalKind;
  minYears: number | null;
  maxYears: number | null;
  label: string;
  guidance: string;
}

export interface FresherJobAnalysis {
  experience: ExperienceSignal;
  jobSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  portalKind: 'direct_ats' | 'job_board' | 'unknown';
  portalGuidance: string;
  daysSinceApplied: number;
  recommendedFollowUpDate: string;
  isFollowUpDue: boolean;
}

function normalizeSkillKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+.#]/g, '');
}

export function extractJobSkills(textParts: Array<string | undefined>): string[] {
  const combined = textParts.filter(Boolean).join('\n');
  if (!combined.trim()) return [];
  const matched: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    if (skill.pattern.test(combined)) {
      matched.push(skill.label);
    }
  }
  return matched;
}

export function parseExperienceSignal(
  textParts: Array<string | undefined>,
  userExperienceYears = 0
): ExperienceSignal {
  const combined = textParts.filter(Boolean).join('\n');
  const titleText = textParts[0] || '';

  const entryTitle = /\b(fresher|entry[- ]?level|new grad|graduate|trainee|intern(?:ship)?|apprentice|junior|jr\.?)\b/i.test(
    combined
  );
  const seniorTitle = /\b(senior|sr\.?|staff|principal|lead|architect|manager|director)\b/i.test(
    titleText
  );

  // Match phrases like "5-6 years", "1.5+ years", "0-2 yrs", "minimum 3 years"
  const rangeMatches: Array<{ min: number; max: number }> = [];
  const expRegex =
    /(?:(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)|(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)|(?:minimum|at least)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?))/gi;

  let m: RegExpExecArray | null;
  while ((m = expRegex.exec(combined)) !== null) {
    if (m[1] && m[2]) {
      const min = parseFloat(m[1]);
      const max = parseFloat(m[2]);
      if (Number.isFinite(min) && Number.isFinite(max) && max <= 20) {
        rangeMatches.push({ min, max });
      }
    } else if (m[3]) {
      const min = parseFloat(m[3]);
      if (Number.isFinite(min) && min <= 20) {
        rangeMatches.push({ min, max: min });
      }
    } else if (m[4]) {
      const min = parseFloat(m[4]);
      if (Number.isFinite(min) && min <= 20) {
        rangeMatches.push({ min, max: min });
      }
    }
  }

  // Filter out huge company-history phrasing ("20+ years in business") only if lower dev YOE found, or keep reasonable <= 12
  const credible = rangeMatches.filter((r) => r.min <= 12);
  let minYears: number | null = null;
  let maxYears: number | null = null;

  if (credible.length > 0) {
    credible.sort((a, b) => a.min - b.min);
    minYears = credible[0].min;
    maxYears = credible[0].max;
  }

  if (minYears !== null) {
    const labelRange =
      maxYears && maxYears > minYears ? `${minYears}-${maxYears} yrs` : `${minYears}+ yrs`;

    if (minYears <= userExperienceYears + 0.5) {
      return {
        kind: 'fresher_friendly',
        minYears,
        maxYears,
        label: `Requires ${labelRange} — fresher compatible`,
        guidance: 'Experience threshold fits your background. Tailor top skills and apply.',
      };
    }

    if (minYears <= userExperienceYears + 2) {
      return {
        kind: 'stretch',
        minYears,
        maxYears,
        label: `Asks for ${labelRange} — stretch role`,
        guidance:
          'Reddit consensus for 1-2 yr listings: apply with strong project metrics or get an employee referral.',
      };
    }

    return {
      kind: 'experienced_mismatch',
      minYears,
      maxYears,
      label: `Asks for ${labelRange} — experienced role`,
      guidance:
        'Unlikely to clear automated filters on cold board applications. Only invest time if you have a referral.',
    };
  }

  if (entryTitle && !seniorTitle) {
    return {
      kind: 'fresher_friendly',
      minYears: 0,
      maxYears: 1,
      label: 'Entry-level / fresher signal detected',
      guidance: 'Listing signals graduate, intern, or junior hiring.',
    };
  }

  if (seniorTitle) {
    return {
      kind: 'experienced_mismatch',
      minYears: 3,
      maxYears: null,
      label: 'Senior role title detected',
      guidance: 'Title indicates senior expectations unless role team explicitly hires junior.',
    };
  }

  return {
    kind: 'unspecified',
    minYears: null,
    maxYears: null,
    label: 'Years of experience not specified',
    guidance: 'Match core requirements on your 1-page resume or apply via company portal.',
  };
}

export function detectPortalKind(
  jobUrl?: string,
  applyUrl?: string
): { portalKind: 'direct_ats' | 'job_board' | 'unknown'; portalGuidance: string } {
  const combined = `${applyUrl || ''} ${jobUrl || ''}`.toLowerCase();
  if (!combined.trim()) {
    return {
      portalKind: 'unknown',
      portalGuidance: 'Save direct company careers URL when possible so listings never go stale.',
    };
  }

  const boardRegex = /\b(linkedin\.com|naukri\.com|indeed\.com|internshala\.com|glassdoor\.|unstop\.com)\b/;
  const atsRegex =
    /\b(greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|smartrecruiters\.com|icims\.com|taleo\.net|jobs\.|careers\.)\b/;

  if (applyUrl && !boardRegex.test(applyUrl.toLowerCase())) {
    return {
      portalKind: 'direct_ats',
      portalGuidance: 'Direct company or ATS portal captured.',
    };
  }

  if (atsRegex.test(combined) && !boardRegex.test(applyUrl?.toLowerCase() || jobUrl?.toLowerCase() || '')) {
    return {
      portalKind: 'direct_ats',
      portalGuidance: 'Direct company or ATS portal captured.',
    };
  }

  if (boardRegex.test(combined)) {
    return {
      portalKind: 'job_board',
      portalGuidance:
        'Job board listing only. Check the company careers page directly or attach an alumni referral before waiting on Easy Apply.',
    };
  }

  return {
    portalKind: 'direct_ats',
    portalGuidance: 'Direct external application link.',
  };
}

export function addDaysIso(isoDate: string, days: number): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback.toISOString().split('T')[0];
  }
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().split('T')[0];
}

export function computeDaysBetween(fromIso: string, toDate = new Date()): number {
  const from = new Date(`${fromIso}T00:00:00`);
  if (Number.isNaN(from.getTime())) return 0;
  const end = new Date(toDate.toISOString().split('T')[0] + 'T00:00:00');
  return Math.max(0, Math.round((end.getTime() - from.getTime()) / 86400000));
}

export function analyzeJobForFresher(
  app: Pick<
    JobApplication,
    'position' | 'description' | 'requirements' | 'jobUrl' | 'applyUrl' | 'appliedDate' | 'followUpDate' | 'status'
  >,
  userSkills: string[] = [],
  userExperienceYears = 0
): FresherJobAnalysis {
  const reqText = Array.isArray(app.requirements) ? app.requirements.join('\n') : '';
  const jobSkills = extractJobSkills([reqText, app.description]);

  const userSet = new Set(userSkills.map(normalizeSkillKey).filter(Boolean));
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const sk of jobSkills) {
    if (userSet.has(normalizeSkillKey(sk))) {
      matchedSkills.push(sk);
    } else {
      missingSkills.push(sk);
    }
  }

  const experience = parseExperienceSignal(
    [app.position, reqText, app.description],
    userExperienceYears
  );

  const { portalKind, portalGuidance } = detectPortalKind(app.jobUrl, app.applyUrl);
  const daysSinceApplied = computeDaysBetween(app.appliedDate);
  const recommendedFollowUpDate = app.followUpDate || addDaysIso(app.appliedDate, 7);
  const todayIso = new Date().toISOString().split('T')[0];

  const activeWaitingStage = app.status === 'Applied' || app.status === 'Under Review';
  const isFollowUpDue =
    activeWaitingStage &&
    (app.followUpDate ? app.followUpDate <= todayIso : daysSinceApplied >= 7);

  return {
    experience,
    jobSkills,
    matchedSkills,
    missingSkills,
    portalKind,
    portalGuidance,
    daysSinceApplied,
    recommendedFollowUpDate,
    isFollowUpDue,
  };
}

export interface OutreachTemplates {
  referralDm: string;
  followUpNote: string;
  thankYouNote: string;
}

export function generateOutreachTemplates(params: {
  company: string;
  position: string;
  jobUrl?: string;
  applyUrl?: string;
  referralContact?: string;
  matchedSkills: string[];
  userSkills: string[];
}): OutreachTemplates {
  const link = params.applyUrl || params.jobUrl || '[Paste Job Link / ID]';
  const contact = params.referralContact?.trim() || '[Name]';
  const topSkills = (params.matchedSkills.length > 0 ? params.matchedSkills : params.userSkills).slice(
    0,
    3
  );
  const skillsPhrase =
    topSkills.length > 0 ? topSkills.join(', ') : 'the core stack listed';

  const referralDm = `Hi ${contact}, hope your week is going well. I saw the ${params.position} opening at ${params.company} (${link}) and wanted to reach out directly. I have hands-on project experience with ${skillsPhrase}, and my resume is ready as a 1-page PDF. If it looks like a reasonable fit, I would be grateful for a referral.`;

  const followUpNote = `Subject: Following up — ${params.position} application at ${params.company}\n\nHi ${contact},\n\nI applied for the ${params.position} role at ${params.company} (${link}) and wanted to check if there are any updates on the shortlist timeline. With my experience building projects in ${skillsPhrase}, I am very keen to contribute to the team.\n\nThank you for your time.`;

  const thankYouNote = `Subject: Thank you — ${params.position} interview at ${params.company}\n\nHi ${contact},\n\nThank you for taking the time to speak with me about the ${params.position} role at ${params.company}. Learning more about the team's engineering priorities reinforced my enthusiasm for bringing my background in ${skillsPhrase} to the role.\n\nLooking forward to next steps.`;

  return { referralDm, followUpNote, thankYouNote };
}

export interface SkillGapDemand {
  skill: string;
  count: number;
  companies: string[];
  hasSkill: boolean;
}

export interface FunnelDiagnosis {
  headline: string;
  detail: string;
  focusArea: 'setup' | 'targeting' | 'interviews' | 'steady';
  topMissingSkills: SkillGapDemand[];
  allSkillDemand: SkillGapDemand[];
}

export function diagnoseFresherFunnel(
  applications: JobApplication[],
  interviews: Interview[],
  userSkills: string[] = []
): FunnelDiagnosis {
  const userSet = new Set(userSkills.map(normalizeSkillKey).filter(Boolean));
  const skillMap = new Map<string, { count: number; companies: Set<string> }>();

  for (const app of applications) {
    const reqText = Array.isArray(app.requirements) ? app.requirements.join('\n') : '';
    const detected = extractJobSkills([reqText, app.description]);
    for (const sk of detected) {
      const entry = skillMap.get(sk) || { count: 0, companies: new Set<string>() };
      entry.count += 1;
      if (app.company) entry.companies.add(app.company);
      skillMap.set(sk, entry);
    }
  }

  const allSkillDemand: SkillGapDemand[] = Array.from(skillMap.entries())
    .map(([skill, data]) => ({
      skill,
      count: data.count,
      companies: Array.from(data.companies),
      hasSkill: userSet.has(normalizeSkillKey(skill)),
    }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));

  const topMissingSkills = allSkillDemand.filter((item) => !item.hasSkill).slice(0, 6);

  const total = applications.length;
  const responded = applications.filter((a) => a.status !== 'Applied').length;
  const interviewsReached = Math.max(
    applications.filter((a) => a.status === 'Interview Scheduled' || a.status === 'Offer').length,
    interviews.length
  );
  const offers = applications.filter((a) => a.status === 'Offer').length;

  if (total === 0) {
    return {
      headline: 'Start tracking targeted fresher applications',
      detail:
        'Add your core skills first, then capture 10-15 roles directly from company career pages or alumni referrals rather than mass Easy Apply.',
      focusArea: 'setup',
      topMissingSkills,
      allSkillDemand,
    };
  }

  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  if (total >= 5 && responseRate < 15) {
    return {
      headline: 'Low shortlist rate — tighten resume targeting & referrals',
      detail: `Only ${responseRate}% of your applications moved past Applied. Trim your resume to one page, quantify project outcomes, add missing JD keywords below, and attach alumni referrals for your next batch.`,
      focusArea: 'targeting',
      topMissingSkills,
      allSkillDemand,
    };
  }

  if (interviewsReached >= 2 && offers === 0) {
    return {
      headline: 'Getting shortlists — focus on interview conversion',
      detail:
        'Your resume passes initial screening. Review preparation notes after each round and drill the top skills required across your active interview descriptions.',
      focusArea: 'interviews',
      topMissingSkills,
      allSkillDemand,
    };
  }

  if (offers > 0) {
    return {
      headline: 'Healthy pipeline conversion',
      detail:
        'Your targeted applications are converting to offers. Keep tracking follow-up dates and interview notes for remaining active loops.',
      focusArea: 'steady',
      topMissingSkills,
      allSkillDemand,
    };
  }

  return {
    headline: 'Build sample size across targeted portals & referrals',
    detail:
      'Early pipeline active. Pair each saved JD with its direct company portal URL, log your tailored resume filename, and follow up on roles older than 7 days.',
    focusArea: 'steady',
    topMissingSkills,
    allSkillDemand,
  };
}
