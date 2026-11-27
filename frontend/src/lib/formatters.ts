import { ApplicationStatus, Interview, JobApplication } from '@/types/tracker';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Applied',
  'Under Review',
  'Interview Scheduled',
  'Offer',
  'Rejected',
];

export const STAGE_STEP_INDEX: Record<ApplicationStatus, number> = {
  Applied: 1,
  'Under Review': 2,
  'Interview Scheduled': 3,
  Offer: 4,
  Rejected: 0,
};

export const STATUS_STYLE: Record<
  ApplicationStatus,
  {
    label: string;
    dotClass: string;
    badgeClass: string;
  }
> = {
  Applied: {
    label: 'Applied',
    dotClass: 'bg-[hsl(var(--accent-ink))]',
    badgeClass: 'bg-[var(--accent-tint)] text-[hsl(var(--accent-ink))] border-[rgba(27,74,214,0.18)]',
  },
  'Under Review': {
    label: 'Under Review',
    dotClass: 'bg-[hsl(var(--semantic-warning))]',
    badgeClass: 'bg-[hsl(var(--semantic-warning-bg))] text-[hsl(var(--semantic-warning))] border-[rgba(180,83,9,0.2)]',
  },
  'Interview Scheduled': {
    label: 'Interview Scheduled',
    dotClass: 'bg-[hsl(var(--semantic-positive))]',
    badgeClass: 'bg-[hsl(var(--semantic-positive-bg))] text-[hsl(var(--semantic-positive))] border-[rgba(21,128,61,0.2)]',
  },
  Offer: {
    label: 'Offer',
    dotClass: 'bg-[hsl(var(--semantic-positive))]',
    badgeClass: 'bg-[hsl(var(--semantic-positive-bg))] text-[hsl(var(--semantic-positive))] border-[rgba(21,128,61,0.28)]',
  },
  Rejected: {
    label: 'Rejected',
    dotClass: 'bg-[hsl(var(--semantic-danger))]',
    badgeClass: 'bg-[hsl(var(--semantic-danger-bg))] text-[hsl(var(--semantic-danger))] border-[rgba(185,28,28,0.2)]',
  },
};

export function safeExternalUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractDomain(rawUrl?: string): string {
  const valid = safeExternalUrl(rawUrl);
  if (!valid) return 'Manual entry';
  try {
    return new URL(valid).hostname.replace(/^www\./, '');
  } catch {
    return 'Web link';
  }
}

export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return 'No date';
  const parsed = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCompensation(rawSalary?: string): string {
  if (!rawSalary) return '';
  return rawSalary.replace(/^Stipend:\s*/i, '').trim();
}

const REQUIREMENT_HEADING_RE =
  /^(who you are|requirements|required skills|qualifications|minimum qualifications|preferred qualifications|what you['’]?ll bring|what we['’]?re looking for|your background|must haves?|technical skills|skills)\s*:?$/i;

const SECTION_STOP_HEADING_RE =
  /^(responsibilities|what you['’]?ll do|about us|about the team|about the role|benefits|perks|compensation|salary|equal opportunity|our mission|why join)\s*:?$/i;

export function extractRequirementsList(
  description?: string,
  explicitRequirements?: string[]
): string[] {
  if (Array.isArray(explicitRequirements) && explicitRequirements.length > 0) {
    return explicitRequirements.filter((item) => typeof item === 'string' && item.trim().length > 0);
  }
  if (!description) return [];

  const lines = description
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  let capturing = false;

  for (const rawLine of lines) {
    const cleanHeading = rawLine.replace(/^[•·▪▫◦‣⁃\-*]\s*/, '').trim();
    if (REQUIREMENT_HEADING_RE.test(cleanHeading)) {
      capturing = true;
      continue;
    }
    if (capturing && SECTION_STOP_HEADING_RE.test(cleanHeading)) {
      capturing = false;
      continue;
    }
    if (capturing) {
      const stripped = rawLine.replace(/^(?:[•·▪▫◦‣⁃*]+\s*|-\s+|\d{1,2}[.)]\s+)/, '').trim();
      if (stripped.length >= 8 && stripped.length <= 360 && !seen.has(stripped.toLowerCase())) {
        seen.add(stripped.toLowerCase());
        out.push(stripped);
        if (out.length >= 25) break;
      }
    }
  }

  return out;
}

export function formatInterviewDateTime(date: string, time: string): {
  dateLabel: string;
  timeLabel: string;
  timestamp: number;
} {
  const parsed = new Date(`${date}T${time || '09:00'}`);
  if (Number.isNaN(parsed.getTime())) {
    return { dateLabel: date, timeLabel: time, timestamp: 0 };
  }
  return {
    dateLabel: parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    timeLabel: parsed.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    timestamp: parsed.getTime(),
  };
}

export function exportApplicationsToCsv(applications: JobApplication[]) {
  const headers = [
    'Company',
    'Position',
    'Status',
    'Applied Date',
    'Location',
    'Compensation',
    'Job URL',
    'Notes',
  ];

  const escapeCell = (val?: string) => {
    const text = String(val || '').replace(/"/g, '""');
    return `"${text}"`;
  };

  const rows = applications.map((app) =>
    [
      app.company,
      app.position,
      app.status,
      app.appliedDate,
      app.location,
      app.salary,
      app.jobUrl,
      app.notes,
    ]
      .map(escapeCell)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `applications-${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportWorkspaceJson(applications: JobApplication[], interviews: Interview[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    applications,
    interviews,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerBlobDownload(blob, `applicationtracker-backup-${new Date().toISOString().split('T')[0]}.json`);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
