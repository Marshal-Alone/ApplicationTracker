import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ExternalLink, MapPin, Banknote, ArrowRight } from 'lucide-react';
import { useTracker } from '@/context/TrackerContext';
import { StagePips } from './StagePips';
import {
  formatCompensation,
  formatShortDate,
  safeExternalUrl,
  STAGE_STEP_INDEX,
} from '@/lib/formatters';
import { ApplicationStatus, JobApplication } from '@/types/tracker';

interface CompanyGroup {
  name: string;
  applications: JobApplication[];
  highestStatus: ApplicationStatus;
  interviewCount: number;
  locations: string[];
  latestDate: string;
}

export const Companies = () => {
  const navigate = useNavigate();
  const { applications, interviews, searchQuery, setSearchQuery } = useTracker();

  const companies = useMemo(() => {
    const groups = new Map<string, CompanyGroup>();

    for (const app of applications) {
      const key = app.company.trim().toLowerCase();
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          name: app.company.trim(),
          applications: [app],
          highestStatus: app.status,
          interviewCount: 0,
          locations: app.location ? [app.location.trim()] : [],
          latestDate: app.appliedDate || '',
        });
      } else {
        existing.applications.push(app);
        if (STAGE_STEP_INDEX[app.status] > STAGE_STEP_INDEX[existing.highestStatus]) {
          existing.highestStatus = app.status;
        }
        if (app.location && !existing.locations.includes(app.location.trim())) {
          existing.locations.push(app.location.trim());
        }
        if ((app.appliedDate || '') > existing.latestDate) {
          existing.latestDate = app.appliedDate || '';
        }
      }
    }

    for (const iv of interviews) {
      if (iv.status === 'Cancelled') continue;
      const key = iv.company.trim().toLowerCase();
      const group = groups.get(key);
      if (group) {
        group.interviewCount += 1;
      }
    }

    const q = searchQuery.trim().toLowerCase();
    return Array.from(groups.values())
      .filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.applications.some((a) => a.position.toLowerCase().includes(q))
      )
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [applications, interviews, searchQuery]);

  const activeLoops = companies.filter((c) => c.highestStatus !== 'Rejected').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[hsl(var(--ink-primary))]">
          Companies
        </h1>
        <p className="text-[14px] text-[hsl(var(--ink-secondary))] mt-1.5 font-mono-num">
          {companies.length} organization{companies.length === 1 ? '' : 's'} tracked ({activeLoops} active)
        </p>
      </div>

      {companies.length === 0 ? (
        <div className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-12 text-center">
          <div className="w-11 h-11 rounded-[10px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
          </div>
          <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))] mb-1">
            {applications.length === 0 ? 'No companies yet' : 'No matching organizations'}
          </h2>
          <p className="text-[13px] text-[hsl(var(--ink-muted))] max-w-sm mx-auto">
            {applications.length === 0
              ? 'Companies automatically appear here as soon as you track roles with them.'
              : 'Try adjusting your search query in the top bar.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {companies.map((group) => (
            <section
              key={group.name}
              className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                {/* Company Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center text-[14px] font-medium text-[hsl(var(--ink-primary))] flex-shrink-0">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))] truncate">
                        {group.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-mono-num text-[hsl(var(--ink-muted))] mt-0.5">
                        <span>
                          {group.applications.length} role{group.applications.length === 1 ? '' : 's'}
                        </span>
                        {group.interviewCount > 0 && (
                          <span>
                            {group.interviewCount} interview{group.interviewCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <StagePips status={group.highestStatus} compact />
                </div>

                {group.locations.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--ink-muted))]">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{group.locations.join(', ')}</span>
                  </div>
                )}

                {/* Roles inside company */}
                <div className="divide-y divide-[var(--hairline)] border border-[var(--hairline)] rounded-[8px] bg-[hsl(var(--surface-page))]">
                  {group.applications.map((app) => {
                    const href = safeExternalUrl(app.jobUrl);
                    const compensation = formatCompensation(app.salary);

                    return (
                      <div
                        key={app.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-[hsl(var(--ink-primary))] truncate">
                            {app.position}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[12px] font-mono-num text-[hsl(var(--ink-muted))]">
                            <span>{formatShortDate(app.appliedDate)}</span>
                            {compensation && (
                              <span className="inline-flex items-center gap-1">
                                <Banknote className="w-3 h-3" strokeWidth={1.5} />
                                {compensation}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[12px] text-[hsl(var(--ink-secondary))]">
                            {app.status}
                          </span>
                          {href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--accent-ink))]"
                              title="Open posting"
                            >
                              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--hairline)] flex items-center justify-between text-[12px]">
                <span className="font-mono-num text-[hsl(var(--ink-muted))]">
                  Latest activity {formatShortDate(group.latestDate)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(group.name);
                    navigate('/applications');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-[hsl(var(--accent-ink))] hover:underline"
                >
                  Inspect roles
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
