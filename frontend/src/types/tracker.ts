export type ApplicationStatus =
  | 'Applied'
  | 'Under Review'
  | 'Interview Scheduled'
  | 'Offer'
  | 'Rejected';

export type InterviewType = 'Video Call' | 'On-site' | 'Phone Call';
export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface ResumeProject {
  name: string;
  stack: string[];
  impactSummary: string;
  bullets: string[];
}

export interface ResumeInternship {
  role: string;
  organization: string;
  duration?: string;
  highlights: string[];
}

export interface ResumeContext {
  fileName: string;
  rawText: string;
  candidateSummary: string;
  fullContextPrompt: string;
  experienceYears: number;
  education: string[];
  technicalSkills: string[];
  strengths: string[];
  gapsToWatch: string[];
  projects: ResumeProject[];
  internshipsOrExperience: ResumeInternship[];
  model?: string;
  updatedAt: string;
}

export interface AiResumeEdit {
  section: string;
  currentFocus: string;
  suggestedChange: string;
  reason: string;
}

export interface AiJobMatch {
  overallVerdict: string;
  fitSummary: string;
  experienceCheck: string;
  matchedHighlights: string[];
  missingKeywords: string[];
  resumeEdits: AiResumeEdit[];
  prepFocusTopics: string[];
  tailoredOutreachHook: string;
  model?: string;
  generatedAt: string;
}

export interface AiServiceStatus {
  serverConfigured: boolean;
  model: string;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  location?: string;
  salary?: string;
  jobUrl?: string;
  applyUrl?: string;
  companyUrl?: string;
  companyLogo?: string;
  verifiedJob?: boolean;
  tags?: string[];
  postedTime?: string;
  applicants?: string;
  responseNote?: string;
  benefits?: string;
  employeeGrowth?: string;
  requirements?: string[];
  description?: string;
  status: ApplicationStatus;
  appliedDate: string;
  notes?: string;
  resumeVersion?: string;
  referralContact?: string;
  followUpDate?: string;
  aiMatch?: AiJobMatch | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FresherProfile {
  skills: string[];
  targetRoles: string[];
  experienceYears: number;
  resumeContext?: ResumeContext | null;
}

export interface Interview {
  id: string;
  applicationId?: string;
  company: string;
  position: string;
  date: string;
  time: string;
  type: InterviewType;
  location?: string;
  meetingLink?: string;
  notes?: string;
  interviewer?: string;
  status: InterviewStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendHealth {
  ok: boolean;
  latencyMs?: number;
  database?: string;
  checkedAt?: string;
}
