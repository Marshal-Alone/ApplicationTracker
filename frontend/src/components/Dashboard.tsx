import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatsCards } from './StatsCards';
import { ApplicationChart } from './ApplicationChart';
import { UpcomingInterviews } from './UpcomingInterviews';
import { RecentApplications } from './RecentApplications';
import { useTracker } from '@/context/TrackerContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  analyzeJobForFresher,
  diagnoseFresherFunnel,
  FRESHER_SKILL_PRESETS,
} from '@/lib/fresherTools';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, fresherProfile, saveFresherProfile } = useAuth();
  const {
    applications,
    interviews,
    isLoading,
    guestLocalCount,
    setSearchQuery,
    syncGuestApplicationsToAccount,
  } = useTracker();
  const { toast } = useToast();
  const [isSyncingGuest, setIsSyncingGuest] = useState(false);
  const [quickSkills, setQuickSkills] = useState<string[]>([]);
  const [savingQuickSkills, setSavingQuickSkills] = useState(false);

  const uniqueCompanies = useMemo(
    () => new Set(applications.map((a) => a.company.trim().toLowerCase())).size,
    [applications]
  );

  const fresherActionData = useMemo(() => {
    const analyzed = applications.map((app) => ({
      app,
      analysis: analyzeJobForFresher(
        app,
        fresherProfile.skills,
        fresherProfile.experienceYears
      ),
    }));

    const followUpsDue = analyzed.filter((x) => x.analysis.isFollowUpDue);
    const boardOnly = analyzed.filter(
      (x) =>
        x.analysis.portalKind === 'job_board' &&
        !x.app.referralContact &&
        (x.app.status === 'Applied' || x.app.status === 'Under Review')
    );
    const experiencedWarnings = analyzed.filter(
      (x) =>
        x.analysis.experience.kind === 'experienced_mismatch' &&
        (x.app.status === 'Applied' || x.app.status === 'Under Review')
    );
    const diagnosis = diagnoseFresherFunnel(applications, interviews, fresherProfile.skills);

    return {
      followUpsDue,
      boardOnly,
      experiencedWarnings,
      topMissingSkills: diagnosis.topMissingSkills.slice(0, 4),
      diagnosis,
    };
  }, [applications, interviews, fresherProfile.skills, fresherProfile.experienceYears]);

  const handleToggleQuickSkill = (skill: string) => {
    setQuickSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSaveQuickSkills = async () => {
    if (quickSkills.length === 0) return;
    setSavingQuickSkills(true);
    try {
      const res = await saveFresherProfile({ skills: quickSkills });
      toast({
        title: res.success ? 'Resume skills saved' : 'Could not save skills',
        description: res.success
          ? 'Open any application to check JD keyword gaps and copy tailored referral templates.'
          : res.error,
        variant: res.success ? 'default' : 'destructive',
      });
    } finally {
      setSavingQuickSkills(false);
    }
  };

  const currentPeriod = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const handleSyncGuest = async () => {
    setIsSyncingGuest(true);
    try {
      const count = await syncGuestApplicationsToAccount();
      toast({
        title: count > 0 ? 'Local records synced' : 'Already up to date',
        description:
          count > 0
            ? `Imported ${count} local application${count === 1 ? '' : 's'} into your account`
            : 'No new local entries required import',
      });
    } finally {
      setIsSyncingGuest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-64 bg-[hsl(var(--surface-raised))] rounded-[8px]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-[hsl(var(--surface-raised))] rounded-[12px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-80 bg-[hsl(var(--surface-raised))] rounded-[12px]" />
          <div className="lg:col-span-4 h-80 bg-[hsl(var(--surface-raised))] rounded-[12px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contextual Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[hsl(var(--ink-primary))]">
            Overview <span className="text-[hsl(var(--ink-muted))] font-normal">{currentPeriod}</span>
          </h1>
          <p className="text-[14px] leading-5 text-[hsl(var(--ink-secondary))] mt-1.5">
            {applications.length > 0
              ? `${applications.length} tracked application${
                  applications.length === 1 ? '' : 's'
                } across ${uniqueCompanies} compan${uniqueCompanies === 1 ? 'y' : 'ies'}`
              : 'Track job applications and interviews in one private workspace'}
          </p>
        </div>
      </div>

      {/* Unsynced Guest Data Notice when signed in */}
      {isAuthenticated && guestLocalCount > 0 && (
        <div className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[13px] text-[hsl(var(--ink-secondary))]">
            <span className="font-mono-num font-medium text-[hsl(var(--ink-primary))]">
              {guestLocalCount}
            </span>{' '}
            application{guestLocalCount === 1 ? '' : 's'} stored locally before sign-in can be merged into your account.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSyncGuest}
            disabled={isSyncingGuest}
            className="h-8 px-3 rounded-[8px] border-[var(--hairline-strong)] self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncingGuest ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {isSyncingGuest ? 'Syncing...' : 'Import to account'}
          </Button>
        </div>
      )}

      {/* Extension Quick Install Strip + Fresher Workflow Guide when Empty */}
      {applications.length === 0 && (
        <div className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-9 h-9 rounded-[8px] bg-[var(--accent-tint)] border border-[rgba(27,74,214,0.18)] flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-[hsl(var(--accent-ink))]" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[14px] font-medium text-[hsl(var(--ink-primary))]">
                  Built for targeted fresher applications
                </h2>
                <p className="text-[13px] text-[hsl(var(--ink-muted))]">
                  Spot unrealistic experience traps, match JD keywords to your resume, and generate 10-second referral DMs
                </p>
              </div>
            </div>
            <Link
              to="/extension"
              className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] text-[13px] font-medium transition-ui flex-shrink-0"
            >
              Set up extension
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-3 border-t border-[var(--hairline)] text-[12px]">
            <div className="p-3 rounded-[8px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
              <div className="font-mono-num text-[hsl(var(--accent-ink))] mb-1">01</div>
              <div className="font-medium text-[hsl(var(--ink-primary))]">Set resume baseline</div>
              <p className="text-[hsl(var(--ink-muted))] mt-0.5">
                Pick your core stack below so every saved JD flags missing keywords automatically.
              </p>
            </div>
            <div className="p-3 rounded-[8px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
              <div className="font-mono-num text-[hsl(var(--accent-ink))] mb-1">02</div>
              <div className="font-medium text-[hsl(var(--ink-primary))]">Avoid 3+ yr filter traps</div>
              <p className="text-[hsl(var(--ink-muted))] mt-0.5">
                Check if entry roles actually ask for senior years before spending 45 minutes tailoring.
              </p>
            </div>
            <div className="p-3 rounded-[8px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
              <div className="font-mono-num text-[hsl(var(--accent-ink))] mb-1">03</div>
              <div className="font-medium text-[hsl(var(--ink-primary))]">Send ready referral DMs</div>
              <p className="text-[hsl(var(--ink-muted))] mt-0.5">
                Include the exact role URL and matched skills so alumni can refer you in seconds.
              </p>
            </div>
            <div className="p-3 rounded-[8px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
              <div className="font-mono-num text-[hsl(var(--accent-ink))] mb-1">04</div>
              <div className="font-medium text-[hsl(var(--ink-primary))]">Track portals &amp; nudges</div>
              <p className="text-[hsl(var(--ink-muted))] mt-0.5">
                Record which 1-page PDF version you sent and nudge contacts cleanly after 7 days.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compact Metrics Row */}
      <StatsCards applications={applications} interviews={interviews} />

      {/* Quick Skills Onboarding or Daily Fresher Action Plan */}
      {fresherProfile.skills.length === 0 ? (
        <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-medium text-[hsl(var(--ink-primary))]">
                Activate resume skill matching
              </h2>
              <p className="text-[13px] text-[hsl(var(--ink-muted))]">
                Select skills currently on your 1-page resume to highlight gaps across every saved job description
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                to="/settings"
                className="text-[13px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
              >
                {fresherProfile.resumeContext ? 'Edit AI resume context' : 'Upload resume for AI context'}
              </Link>
              <Button
                type="button"
                size="sm"
                disabled={quickSkills.length === 0 || savingQuickSkills}
                onClick={handleSaveQuickSkills}
                className="h-8 px-3.5 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))]"
              >
                {savingQuickSkills ? 'Saving...' : `Save ${quickSkills.length || ''} skills`}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FRESHER_SKILL_PRESETS.slice(0, 16).map((skill) => {
              const active = quickSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleToggleQuickSkill(skill)}
                  className={`h-7 px-2.5 rounded-[6px] text-[12px] font-medium border transition-ui ${
                    active
                      ? 'bg-[var(--accent-tint)] border-[rgba(27,74,214,0.28)] text-[hsl(var(--accent-ink))]'
                      : 'bg-[hsl(var(--surface-page))] border-[var(--hairline)] text-[hsl(var(--ink-secondary))] hover:bg-[hsl(var(--surface-raised))]'
                  }`}
                >
                  {active ? skill : `+ ${skill}`}
                </button>
              );
            })}
          </div>
        </section>
      ) : applications.length > 0 ? (
        <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--hairline)] pb-3.5">
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-[hsl(var(--accent-ink))]" strokeWidth={1.75} />
              <div>
                <h2 className="text-[15px] font-medium text-[hsl(var(--ink-primary))]">
                  Next actions for your job search
                </h2>
                <p className="text-[12px] text-[hsl(var(--ink-muted))]">
                  {fresherActionData.diagnosis.headline}
                  {fresherProfile.resumeContext
                    ? ` — Resume indexed (${fresherProfile.resumeContext.projects.length} projects)`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {!fresherProfile.resumeContext && (
                <Link
                  to="/settings"
                  className="text-[12px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
                >
                  Upload resume for AI edits
                </Link>
              )}
              <Link
                to="/analytics"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
              >
                Inspect pipeline diagnosis
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
            {/* 1. Follow-ups Due */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[hsl(var(--ink-secondary))]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--ink-primary))]">
                  <Clock className="w-3.5 h-3.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                  Follow-ups due
                </span>
                <span className="font-mono-num text-[12px] text-[hsl(var(--ink-muted))]">
                  {fresherActionData.followUpsDue.length}
                </span>
              </div>
              {fresherActionData.followUpsDue.length === 0 ? (
                <p className="text-[12px] text-[hsl(var(--ink-muted))]">
                  No applications overdue for a 7-day nudge right now.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {fresherActionData.followUpsDue.slice(0, 3).map(({ app, analysis }) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        setSearchQuery(app.company);
                        navigate('/applications');
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-[8px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] transition-ui flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-medium text-[hsl(var(--ink-primary))]">
                        {app.company}
                      </span>
                      <span className="font-mono-num text-[11px] text-[hsl(var(--semantic-warning))] flex-shrink-0">
                        {analysis.daysSinceApplied}d ago
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Portal & Referral Optimization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[hsl(var(--ink-secondary))]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--ink-primary))]">
                  <Building2 className="w-3.5 h-3.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                  Boost referral odds
                </span>
                <span className="font-mono-num text-[12px] text-[hsl(var(--ink-muted))]">
                  {fresherActionData.boardOnly.length}
                </span>
              </div>
              {fresherActionData.boardOnly.length === 0 ? (
                <p className="text-[12px] text-[hsl(var(--ink-muted))]">
                  Active roles have either a direct ATS link or a referral contact attached.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {fresherActionData.boardOnly.slice(0, 3).map(({ app }) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        setSearchQuery(app.company);
                        navigate('/applications');
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-[8px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] hover:border-[var(--hairline-strong)] transition-ui flex items-center justify-between gap-2"
                    >
                      <span className="truncate font-medium text-[hsl(var(--ink-primary))]">
                        {app.company}
                      </span>
                      <span className="text-[11px] text-[hsl(var(--accent-ink))] flex-shrink-0">
                        Copy referral DM
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Recurring Skill Gaps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[hsl(var(--ink-secondary))]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[hsl(var(--ink-primary))]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                  Missing JD keywords
                </span>
                <Link
                  to="/settings"
                  className="text-[11px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
                >
                  Edit skills
                </Link>
              </div>
              {fresherActionData.topMissingSkills.length === 0 ? (
                <p className="text-[12px] text-[hsl(var(--ink-muted))]">
                  Your profile covers all recurring skills parsed from your tracked job descriptions.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {fresherActionData.topMissingSkills.map((item) => (
                    <span
                      key={item.skill}
                      className="px-2 py-1 rounded-[6px] bg-[hsl(var(--semantic-warning-bg))] border border-[rgba(180,83,9,0.2)] text-[hsl(var(--semantic-warning))] text-[11px] font-medium font-mono-num"
                    >
                      {item.skill} ({item.count})
                    </span>
                  ))}
                </div>
              )}
              {fresherActionData.experiencedWarnings.length > 0 && (
                <p className="text-[11px] text-[hsl(var(--ink-muted))] pt-0.5">
                  {fresherActionData.experiencedWarnings.length} active role
                  {fresherActionData.experiencedWarnings.length === 1 ? ' asks' : 's ask'} for 3+ yrs experience.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Asymmetric Data Moment: 2/3 Chart + 1/3 Interviews */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8">
          <ApplicationChart />
        </div>
        <div className="lg:col-span-4">
          <UpcomingInterviews />
        </div>
      </div>

      {/* Recent Ledger */}
      <RecentApplications />
    </div>
  );
};
