import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  MoreHorizontal,
  Building2,
  Calendar,
  ExternalLink,
  MapPin,
  Banknote,
  Eye,
  Edit3,
  Trash2,
  Briefcase,
  LayoutGrid,
  List,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { ApplicationForm } from './ApplicationForm';
import { InterviewFormDialog } from './InterviewFormDialog';
import { StagePips } from './StagePips';
import { useAuth } from '@/context/AuthContext';
import { useTracker } from '@/context/TrackerContext';
import {
  APPLICATION_STATUSES,
  extractDomain,
  extractRequirementsList,
  formatCompensation,
  formatShortDate,
  safeExternalUrl,
} from '@/lib/formatters';
import {
  addDaysIso,
  analyzeJobForFresher,
  generateOutreachTemplates,
} from '@/lib/fresherTools';
import { ApplicationStatus, JobApplication } from '@/types/tracker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type SortOption = 'newest' | 'oldest' | 'company';

const CompanyMark: React.FC<{
  name: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ name, logoUrl, size = 'md' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const safeLogo = safeExternalUrl(logoUrl);

  const sizeClasses =
    size === 'lg'
      ? 'w-11 h-11 rounded-[10px] text-[16px]'
      : size === 'sm'
        ? 'w-8 h-8 rounded-[6px] text-[12px]'
        : 'w-9 h-9 rounded-[8px] text-[13px]';

  return (
    <div
      className={`${sizeClasses} bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center font-medium text-[hsl(var(--ink-primary))] flex-shrink-0 overflow-hidden`}
    >
      {safeLogo && !imgFailed ? (
        <img
          src={safeLogo}
          alt={`${name} logo`}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
};

export const Applications = () => {
  const { fresherProfile } = useAuth();
  const {
    applications,
    isLoading,
    searchQuery,
    setSearchQuery,
    syncMode,
    createApplication,
    updateApplication,
    deleteApplication,
    createInterview,
    runAiJobMatch,
  } = useTracker();

  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [scheduleApp, setScheduleApp] = useState<JobApplication | null>(null);
  const [outreachTab, setOutreachTab] = useState<'referral' | 'followup' | 'thankyou'>('referral');
  const [copiedOutreach, setCopiedOutreach] = useState(false);
  const [runningAiMatch, setRunningAiMatch] = useState(false);
  const [aiMatchError, setAiMatchError] = useState<string | null>(null);
  const [copiedHook, setCopiedHook] = useState(false);

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = applications.filter((app) => {
      const matchesSearch =
        !q ||
        app.company.toLowerCase().includes(q) ||
        app.position.toLowerCase().includes(q) ||
        (app.location && app.location.toLowerCase().includes(q)) ||
        (app.salary && app.salary.toLowerCase().includes(q)) ||
        (app.requirements && app.requirements.some((r) => r.toLowerCase().includes(q))) ||
        (app.notes && app.notes.toLowerCase().includes(q)) ||
        (app.description && app.description.toLowerCase().includes(q));
      const matchesFilter = filterStatus === 'All' || app.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'company') {
        return a.company.localeCompare(b.company);
      }
      const dateA = new Date(a.appliedDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.appliedDate || b.createdAt || 0).getTime();
      return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
    });
  }, [applications, searchQuery, filterStatus, sortBy]);

  const handleFormSubmit = async (data: Partial<JobApplication>) => {
    if (editingApp) {
      await updateApplication(editingApp.id, data);
      setEditingApp(null);
    } else {
      await createApplication(data);
    }
    setShowForm(false);
  };

  const selectedRequirements = useMemo(
    () =>
      selectedApp
        ? extractRequirementsList(selectedApp.description, selectedApp.requirements)
        : [],
    [selectedApp]
  );
  const selectedJobHref = selectedApp ? safeExternalUrl(selectedApp.jobUrl) : null;
  const selectedApplyHref = selectedApp ? safeExternalUrl(selectedApp.applyUrl) : null;
  const selectedCompanyHref = selectedApp ? safeExternalUrl(selectedApp.companyUrl) : null;

  const selectedAnalysis = useMemo(
    () =>
      selectedApp
        ? analyzeJobForFresher(
            selectedApp,
            fresherProfile.skills,
            fresherProfile.experienceYears
          )
        : null,
    [selectedApp, fresherProfile.skills, fresherProfile.experienceYears]
  );

  const selectedOutreach = useMemo(
    () =>
      selectedApp && selectedAnalysis
        ? generateOutreachTemplates({
            company: selectedApp.company,
            position: selectedApp.position,
            jobUrl: selectedApp.jobUrl,
            applyUrl: selectedApp.applyUrl,
            referralContact: selectedApp.referralContact,
            matchedSkills: selectedAnalysis.matchedSkills,
            userSkills: fresherProfile.skills,
          })
        : null,
    [selectedApp, selectedAnalysis, fresherProfile.skills]
  );

  const activeOutreachMessage = selectedOutreach
    ? outreachTab === 'referral'
      ? selectedOutreach.referralDm
      : outreachTab === 'followup'
        ? selectedOutreach.followUpNote
        : selectedOutreach.thankYouNote
    : '';

  const handleCopyOutreach = () => {
    if (!activeOutreachMessage) return;
    navigator.clipboard.writeText(activeOutreachMessage);
    setCopiedOutreach(true);
    setTimeout(() => setCopiedOutreach(false), 1800);
  };

  const handleRunAiMatch = async () => {
    if (!selectedApp || runningAiMatch) return;
    setRunningAiMatch(true);
    setAiMatchError(null);
    try {
      const res = await runAiJobMatch(selectedApp);
      if (res.ok && res.aiMatch) {
        setSelectedApp((prev) => (prev ? { ...prev, aiMatch: res.aiMatch } : null));
      } else {
        setAiMatchError(res.error || 'Could not generate AI match analysis');
      }
    } finally {
      setRunningAiMatch(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-60 bg-[hsl(var(--surface-raised))] rounded-[8px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 bg-[hsl(var(--surface-raised))] rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[hsl(var(--ink-primary))]">
            Applications
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[13px] text-[hsl(var(--ink-secondary))]">
            <span className="font-mono-num">
              {applications.length} total role{applications.length === 1 ? '' : 's'}
            </span>
            <span className="text-[var(--hairline-strong)]">|</span>
            <span className="inline-flex items-center gap-1.5 text-[hsl(var(--ink-muted))]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncMode === 'synced'
                    ? 'bg-[hsl(var(--semantic-positive))]'
                    : 'bg-[hsl(var(--ink-muted))]'
                }`}
              />
              {syncMode === 'synced' ? 'Synced to account' : 'Saved locally in browser'}
            </span>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => {
            setEditingApp(null);
            setShowForm(true);
          }}
          className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] font-medium text-[13px] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
          New application
        </Button>
      </div>

      {/* Filter & View Bar (reuses single Header Search instead of duplicating a second search bar) */}
      <div className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pills */}
          <SelectField
            ariaLabel="Filter by stage"
            value={filterStatus}
            onValueChange={setFilterStatus}
            className="min-w-[156px]"
            options={[
              { value: 'All', label: `All stages (${applications.length})` },
              ...APPLICATION_STATUSES.map((status) => ({
                value: status,
                label: `${status} (${applications.filter((a) => a.status === status).length})`,
              })),
            ]}
          />

          <SelectField
            ariaLabel="Sort applications"
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortOption)}
            className="min-w-[136px] text-[hsl(var(--ink-secondary))] font-normal"
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'company', label: 'Company A–Z' },
            ]}
          />

          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] bg-[var(--accent-tint)] text-[hsl(var(--accent-ink))] text-[12px] font-medium"
            >
              <span>Search: &ldquo;{searchQuery}&rdquo;</span>
              <X className="w-3 h-3" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div
          className="inline-flex items-center bg-[hsl(var(--surface-raised))] p-1 rounded-[8px] border border-[var(--hairline)] self-start md:self-auto"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] text-[12px] font-medium transition-ui ${
              viewMode === 'grid'
                ? 'bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                : 'text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] text-[12px] font-medium transition-ui ${
              viewMode === 'list'
                ? 'bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                : 'text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))]'
            }`}
          >
            <List className="w-3.5 h-3.5" strokeWidth={1.5} />
            List
          </button>
        </div>
      </div>

      {/* Results Display */}
      {filteredApplications.length === 0 ? (
        <div className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-12 text-center">
          <div className="w-11 h-11 rounded-[10px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
          </div>
          <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))] mb-1">
            {applications.length === 0 ? 'No applications tracked' : 'No matching applications'}
          </h2>
          <p className="text-[13px] text-[hsl(var(--ink-muted))] mb-5 max-w-sm mx-auto">
            {applications.length === 0
              ? 'Add your first role manually or capture job pages using the Chrome extension'
              : 'Adjust the stage filter or clear the search query to see all entries'}
          </p>
          {applications.length === 0 && (
            <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] font-medium text-[13px]"
            >
              <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
              Add first application
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredApplications.map((app) => {
            const href = safeExternalUrl(app.jobUrl);
            const applyHref = safeExternalUrl(app.applyUrl);
            const domain = extractDomain(app.jobUrl || app.applyUrl);
            const compensation = formatCompensation(app.salary);

            return (
              <article
                key={app.id}
                className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 flex flex-col justify-between gap-4 hover:border-[var(--hairline-strong)] transition-ui"
              >
                <div className="space-y-3.5">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <CompanyMark name={app.company} logoUrl={app.companyLogo} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] leading-5 font-medium text-[hsl(var(--ink-primary))] truncate">
                          {app.company}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setSelectedApp(app)}
                          className="text-left text-[13px] leading-5 text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--accent-ink))] line-clamp-2 mt-0.5 transition-ui"
                        >
                          {app.position}
                        </button>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))] flex-shrink-0"
                          aria-label={`More actions for ${app.company}`}
                        >
                          <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44 bg-[hsl(var(--surface-card))] border border-[var(--hairline-strong)] rounded-[10px] shadow-[var(--shadow-float)] p-1"
                      >
                        <DropdownMenuItem
                          onClick={() => setSelectedApp(app)}
                          className="cursor-pointer rounded-[6px] text-[13px]"
                        >
                          <Eye className="w-4 h-4 mr-2 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                          View details
                        </DropdownMenuItem>
                        {href && (
                          <DropdownMenuItem asChild className="cursor-pointer rounded-[6px] text-[13px]">
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                              Open posting
                            </a>
                          </DropdownMenuItem>
                        )}
                        {applyHref && applyHref !== href && (
                          <DropdownMenuItem asChild className="cursor-pointer rounded-[6px] text-[13px]">
                            <a href={applyHref} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                              Apply link
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingApp(app);
                            setShowForm(true);
                          }}
                          className="cursor-pointer rounded-[6px] text-[13px]"
                        >
                          <Edit3 className="w-4 h-4 mr-2 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setScheduleApp(app)}
                          className="cursor-pointer rounded-[6px] text-[13px]"
                        >
                          <Calendar className="w-4 h-4 mr-2 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                          Schedule interview
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteApplication(app.id)}
                          className="cursor-pointer rounded-[6px] text-[13px] text-[hsl(var(--semantic-danger))]"
                        >
                          <Trash2 className="w-4 h-4 mr-2" strokeWidth={1.5} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Metadata rows */}
                  <div className="space-y-1.5 text-[13px] text-[hsl(var(--ink-secondary))]">
                    {app.location && (
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-[hsl(var(--ink-muted))] flex-shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{app.location}</span>
                      </div>
                    )}
                    {compensation && (
                      <div className="flex items-center gap-2 min-w-0">
                        <Banknote className="w-4 h-4 text-[hsl(var(--ink-muted))] flex-shrink-0" strokeWidth={1.5} />
                        <span className="font-mono-num truncate">{compensation}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-[12px] font-mono-num text-[hsl(var(--ink-muted))] pt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {formatShortDate(app.appliedDate)}
                      </span>
                      <span className="truncate">{domain}</span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Pinned Controls */}
                <div className="pt-3 border-t border-[var(--hairline)] space-y-2.5">
                  <StagePips status={app.status} />

                  <SelectField
                    ariaLabel={`Change stage for ${app.company}`}
                    value={app.status}
                    onValueChange={(next) =>
                      updateApplication(app.id, { status: next as ApplicationStatus })
                    }
                    className="w-full bg-[hsl(var(--surface-page))] hover:bg-[hsl(var(--surface-raised))]"
                    options={APPLICATION_STATUSES.map((st) => ({ value: st, label: st }))}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--hairline)] text-[12px] font-medium text-[hsl(var(--ink-muted))]">
                <th className="py-3 px-5 font-medium">Role &amp; company</th>
                <th className="py-3 px-4 font-medium hidden md:table-cell">Compensation / location</th>
                <th className="py-3 px-4 font-medium">Stage</th>
                <th className="py-3 px-4 font-medium hidden sm:table-cell">Applied</th>
                <th className="py-3 px-5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {filteredApplications.map((app) => {
                const href = safeExternalUrl(app.jobUrl);
                const compensation = formatCompensation(app.salary);

                return (
                  <tr
                    key={app.id}
                    className="hover:bg-[hsl(var(--surface-page))] transition-ui"
                  >
                    <td className="py-3.5 px-5 max-w-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <CompanyMark name={app.company} logoUrl={app.companyLogo} size="sm" />
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-[hsl(var(--ink-primary))] truncate">
                            {app.company}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedApp(app)}
                            className="text-[13px] text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--accent-ink))] truncate block max-w-full text-left"
                          >
                            {app.position}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <div className="text-[13px] text-[hsl(var(--ink-secondary))] font-mono-num">
                        {compensation || '—'}
                      </div>
                      <div className="text-[12px] text-[hsl(var(--ink-muted))]">
                        {app.location || extractDomain(app.jobUrl)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <SelectField
                        ariaLabel={`Change stage for ${app.company}`}
                        value={app.status}
                        onValueChange={(next) =>
                          updateApplication(app.id, { status: next as ApplicationStatus })
                        }
                        className="h-8 text-[12px] min-w-[152px]"
                        options={APPLICATION_STATUSES.map((st) => ({ value: st, label: st }))}
                      />
                    </td>
                    <td className="py-3.5 px-4 hidden sm:table-cell font-mono-num text-[12px] text-[hsl(var(--ink-muted))] whitespace-nowrap">
                      {formatShortDate(app.appliedDate)}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-[6px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))] hover:bg-[hsl(var(--surface-raised))]"
                            title="Open posting"
                            aria-label="Open posting"
                          >
                            <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingApp(app);
                            setShowForm(true);
                          }}
                          className="p-1.5 rounded-[6px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))] hover:bg-[hsl(var(--surface-raised))]"
                          title="Edit"
                          aria-label="Edit"
                        >
                          <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteApplication(app.id)}
                          className="p-1.5 rounded-[6px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-danger))] hover:bg-[hsl(var(--surface-raised))]"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Application Form Modal */}
      {showForm && (
        <ApplicationForm
          application={editingApp}
          onClose={() => {
            setShowForm(false);
            setEditingApp(null);
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      {/* Application Details Dialog */}
      <Dialog
        open={!!selectedApp}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedApp(null);
            setAiMatchError(null);
            setCopiedHook(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl p-0 sm:p-0 overflow-hidden gap-0 bg-[hsl(var(--surface-card))] border-[var(--hairline-strong)] rounded-[14px]">
          {selectedApp && (
            <>
              <DialogHeader className="px-5 sm:px-6 pt-5 pb-4 pr-12 border-b border-[var(--hairline)] flex-shrink-0">
                <div className="flex items-start gap-3.5">
                  <CompanyMark name={selectedApp.company} logoUrl={selectedApp.companyLogo} size="lg" />
                  <div className="min-w-0 flex-1">
                    {selectedCompanyHref ? (
                      <a
                        href={selectedCompanyHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[18px] font-medium text-[hsl(var(--ink-primary))] hover:text-[hsl(var(--accent-ink))] hover:underline inline-flex items-center gap-1"
                      >
                        <DialogTitle className="text-[18px] font-medium text-inherit">
                          {selectedApp.company}
                        </DialogTitle>
                      </a>
                    ) : (
                      <DialogTitle className="text-[18px] font-medium text-[hsl(var(--ink-primary))]">
                        {selectedApp.company}
                      </DialogTitle>
                    )}
                    <DialogDescription className="text-[14px] text-[hsl(var(--ink-secondary))] mt-0.5">
                      {selectedApp.position}
                    </DialogDescription>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <StagePips status={selectedApp.status} />
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                    <div className="text-[12px] text-[hsl(var(--ink-muted))] mb-1">Applied date</div>
                    <div className="text-[14px] font-mono-num text-[hsl(var(--ink-primary))]">
                      {formatShortDate(selectedApp.appliedDate)}
                    </div>
                  </div>

                  {selectedApp.location && (
                    <div className="p-3.5 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                      <div className="text-[12px] text-[hsl(var(--ink-muted))] mb-1">Location</div>
                      <div className="text-[14px] text-[hsl(var(--ink-primary))]">
                        {selectedApp.location}
                      </div>
                    </div>
                  )}

                  {selectedApp.salary && (
                    <div className="p-3.5 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                      <div className="text-[12px] text-[hsl(var(--ink-muted))] mb-1">Compensation</div>
                      <div className="text-[14px] font-mono-num text-[hsl(var(--ink-primary))]">
                        {formatCompensation(selectedApp.salary)}
                      </div>
                    </div>
                  )}

                  {selectedJobHref && (
                    <div className="p-3.5 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                      <div className="text-[12px] text-[hsl(var(--ink-muted))] mb-1">Source link</div>
                      <a
                        href={selectedJobHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
                      >
                        <Briefcase className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {extractDomain(selectedApp.jobUrl)}
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </a>
                    </div>
                  )}

                  {selectedApplyHref && selectedApplyHref !== selectedJobHref && (
                    <div className="p-3.5 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                      <div className="text-[12px] text-[hsl(var(--ink-muted))] mb-1">Apply URL</div>
                      <a
                        href={selectedApplyHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                        {extractDomain(selectedApp.applyUrl)}
                      </a>
                    </div>
                  )}

                  {selectedApp.resumeVersion && (
                    <div className="p-3.5 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                      <div className="text-[12px] text-[hsl(var(--ink-muted))] mb-1">Resume version</div>
                      <div className="text-[13px] font-mono-num text-[hsl(var(--ink-primary))]">
                        {selectedApp.resumeVersion}
                      </div>
                    </div>
                  )}

                  {(selectedApp.referralContact || selectedApp.followUpDate) && (
                    <div className="p-3.5 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                      <div className="text-[12px] text-[hsl(var(--ink-muted))] mb-1">
                        {selectedApp.referralContact ? 'Referral / contact' : 'Follow-up date'}
                      </div>
                      <div className="text-[13px] text-[hsl(var(--ink-primary))]">
                        {selectedApp.referralContact || formatShortDate(selectedApp.followUpDate || '')}
                      </div>
                    </div>
                  )}
                </div>

                {selectedAnalysis && (
                  <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {selectedAnalysis.experience.kind === 'experienced_mismatch' ||
                        selectedAnalysis.experience.kind === 'stretch' ? (
                          <AlertTriangle
                            className="w-4 h-4 text-[hsl(var(--semantic-warning))] mt-0.5 flex-shrink-0"
                            strokeWidth={1.75}
                          />
                        ) : (
                          <CheckCircle2
                            className="w-4 h-4 text-[hsl(var(--accent-ink))] mt-0.5 flex-shrink-0"
                            strokeWidth={1.75}
                          />
                        )}
                        <div>
                          <div className="text-[13px] font-medium text-[hsl(var(--ink-primary))]">
                            {selectedAnalysis.experience.label}
                          </div>
                          <p className="text-[12px] text-[hsl(var(--ink-muted))] mt-0.5">
                            {selectedAnalysis.experience.guidance}
                          </p>
                        </div>
                      </div>
                      {selectedAnalysis.isFollowUpDue && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const nextDate = addDaysIso(new Date().toISOString().split('T')[0], 7);
                            await updateApplication(selectedApp.id, { followUpDate: nextDate });
                            setSelectedApp((prev) =>
                              prev ? { ...prev, followUpDate: nextDate } : null
                            );
                          }}
                          className="h-7 px-2.5 text-[11px] rounded-[6px] border-[var(--hairline-strong)]"
                        >
                          Snooze follow-up +7d
                        </Button>
                      )}
                    </div>

                    {selectedAnalysis.jobSkills.length > 0 && (
                      <div className="pt-2.5 border-t border-[var(--hairline)] space-y-2">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-medium text-[hsl(var(--ink-secondary))]">
                            Resume keyword match
                          </span>
                          {fresherProfile.skills.length === 0 && (
                            <Link
                              to="/settings"
                              onClick={() => setSelectedApp(null)}
                              className="text-[11px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
                            >
                              Add your resume skills
                            </Link>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedAnalysis.matchedSkills.map((sk) => (
                            <span
                              key={`m-${sk}`}
                              className="px-2 py-0.5 rounded-[6px] bg-[hsl(var(--semantic-positive-bg))] border border-[rgba(21,128,61,0.2)] text-[hsl(var(--semantic-positive))] text-[11px] font-medium"
                            >
                              {sk}
                            </span>
                          ))}
                          {selectedAnalysis.missingSkills.map((sk) => (
                            <span
                              key={`g-${sk}`}
                              className="px-2 py-0.5 rounded-[6px] bg-[hsl(var(--semantic-warning-bg))] border border-[rgba(180,83,9,0.2)] text-[hsl(var(--semantic-warning))] text-[11px] font-medium"
                            >
                              Missing: {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedAnalysis.portalKind === 'job_board' && (
                      <p className="text-[11px] text-[hsl(var(--ink-muted))] pt-1">
                        {selectedAnalysis.portalGuidance}
                      </p>
                    )}
                  </div>
                )}

                {/* Full-Context AI Job Match & Resume Edit Suggestions */}
                <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-medium text-[hsl(var(--ink-primary))]">
                        AI full-context resume match
                      </div>
                      <p className="text-[12px] text-[hsl(var(--ink-muted))]">
                        Compares this entire JD against your parsed resume projects and skills
                      </p>
                    </div>

                    {fresherProfile.resumeContext ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={runningAiMatch}
                        onClick={handleRunAiMatch}
                        className="h-8 px-3 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] text-[12px]"
                      >
                        {runningAiMatch
                          ? 'Analyzing...'
                          : selectedApp.aiMatch
                            ? 'Re-analyze fit & edits'
                            : 'Analyze fit & resume edits'}
                      </Button>
                    ) : (
                      <Link
                        to="/settings"
                        onClick={() => setSelectedApp(null)}
                        className="inline-flex items-center h-8 px-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[hsl(var(--surface-card))] hover:bg-[hsl(var(--surface-raised))] text-[12px] font-medium text-[hsl(var(--accent-ink))]"
                      >
                        Upload resume in Settings
                      </Link>
                    )}
                  </div>

                  {aiMatchError && (
                    <div className="text-[12px] text-[hsl(var(--semantic-danger))] bg-[hsl(var(--semantic-danger-bg))] border border-[rgba(185,28,28,0.2)] rounded-[8px] px-3 py-2">
                      {aiMatchError}{' '}
                      <Link
                        to="/settings"
                        onClick={() => setSelectedApp(null)}
                        className="underline font-medium"
                      >
                        Configure in Settings
                      </Link>
                    </div>
                  )}

                  {selectedApp.aiMatch && (
                    <div className="space-y-3 pt-2 border-t border-[var(--hairline)]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium border ${
                            selectedApp.aiMatch.overallVerdict.includes('Strong')
                              ? 'bg-[hsl(var(--semantic-positive-bg))] border-[rgba(21,128,61,0.22)] text-[hsl(var(--semantic-positive))]'
                              : selectedApp.aiMatch.overallVerdict.includes('Good')
                                ? 'bg-[var(--accent-tint)] border-[rgba(27,74,214,0.22)] text-[hsl(var(--accent-ink))]'
                                : 'bg-[hsl(var(--semantic-warning-bg))] border-[rgba(180,83,9,0.22)] text-[hsl(var(--semantic-warning))]'
                          }`}
                        >
                          {selectedApp.aiMatch.overallVerdict}
                        </span>
                        {selectedApp.aiMatch.model && (
                          <span className="text-[11px] font-mono-num text-[hsl(var(--ink-muted))]">
                            {selectedApp.aiMatch.model}
                          </span>
                        )}
                      </div>

                      {selectedApp.aiMatch.fitSummary && (
                        <p className="text-[13px] leading-relaxed text-[hsl(var(--ink-primary))]">
                          {selectedApp.aiMatch.fitSummary}
                        </p>
                      )}

                      {selectedApp.aiMatch.experienceCheck && (
                        <p className="text-[12px] text-[hsl(var(--ink-secondary))]">
                          <span className="font-medium text-[hsl(var(--ink-primary))]">Experience check:</span>{' '}
                          {selectedApp.aiMatch.experienceCheck}
                        </p>
                      )}

                      {selectedApp.aiMatch.matchedHighlights.length > 0 && (
                        <div>
                          <div className="text-[12px] font-medium text-[hsl(var(--ink-primary))] mb-1">
                            Matched from your resume
                          </div>
                          <ul className="space-y-1 text-[12px] text-[hsl(var(--ink-secondary))]">
                            {selectedApp.aiMatch.matchedHighlights.map((item, idx) => (
                              <li key={`${idx}-${item.slice(0, 16)}`}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedApp.aiMatch.missingKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedApp.aiMatch.missingKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 rounded-[6px] bg-[hsl(var(--semantic-warning-bg))] border border-[rgba(180,83,9,0.2)] text-[hsl(var(--semantic-warning))] text-[11px] font-medium"
                            >
                              Missing: {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      {selectedApp.aiMatch.resumeEdits.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[12px] font-medium text-[hsl(var(--ink-primary))]">
                            Suggested resume edits for this role
                          </div>
                          <div className="space-y-2">
                            {selectedApp.aiMatch.resumeEdits.map((edit, idx) => (
                              <div
                                key={`${idx}-${edit.section}`}
                                className="border-l-2 border-[hsl(var(--accent-ink))] pl-3 py-1 space-y-1 text-[12px]"
                              >
                                <div className="font-medium text-[hsl(var(--ink-primary))]">
                                  {edit.section}
                                </div>
                                {edit.currentFocus && (
                                  <div className="text-[hsl(var(--ink-muted))]">
                                    Current: {edit.currentFocus}
                                  </div>
                                )}
                                <div className="text-[hsl(var(--ink-primary))]">
                                  Suggested: {edit.suggestedChange}
                                </div>
                                {edit.reason && (
                                  <div className="text-[11px] text-[hsl(var(--ink-muted))]">
                                    Why: {edit.reason}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedApp.aiMatch.prepFocusTopics.length > 0 && (
                        <div>
                          <div className="text-[12px] font-medium text-[hsl(var(--ink-primary))] mb-1">
                            Interview prep focus
                          </div>
                          <ul className="space-y-0.5 text-[12px] text-[hsl(var(--ink-secondary))]">
                            {selectedApp.aiMatch.prepFocusTopics.map((topic, idx) => (
                              <li key={`${idx}-${topic.slice(0, 16)}`}>- {topic}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedApp.aiMatch.tailoredOutreachHook && (
                        <div className="pt-2 border-t border-[var(--hairline)] space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] font-medium text-[hsl(var(--ink-primary))]">
                              AI referral pitch hook
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  selectedApp.aiMatch?.tailoredOutreachHook || ''
                                );
                                setCopiedHook(true);
                                setTimeout(() => setCopiedHook(false), 1800);
                              }}
                              className="text-[11px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
                            >
                              {copiedHook ? 'Copied hook' : 'Copy hook'}
                            </button>
                          </div>
                          <p className="text-[12px] text-[hsl(var(--ink-secondary))]">
                            {selectedApp.aiMatch.tailoredOutreachHook}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedOutreach && (
                  <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-[hsl(var(--ink-primary))] inline-flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[hsl(var(--accent-ink))]" strokeWidth={1.75} />
                        Outreach &amp; follow-up templates
                      </span>
                      <div className="inline-flex items-center gap-1 bg-[hsl(var(--surface-raised))] p-0.5 rounded-[7px] border border-[var(--hairline)]">
                        {(
                          [
                            ['referral', 'Referral DM'],
                            ['followup', '7-day follow-up'],
                            ['thankyou', 'Thank you'],
                          ] as const
                        ).map(([tabKey, tabLabel]) => (
                          <button
                            key={tabKey}
                            type="button"
                            onClick={() => {
                              setOutreachTab(tabKey);
                              setCopiedOutreach(false);
                            }}
                            className={`px-2.5 py-1 rounded-[5px] text-[11px] font-medium transition-ui ${
                              outreachTab === tabKey
                                ? 'bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                                : 'text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))]'
                            }`}
                          >
                            {tabLabel}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-[12px] leading-relaxed text-[hsl(var(--ink-primary))] border-l-2 border-[hsl(var(--accent-ink))] pl-3 py-0.5 whitespace-pre-line">
                      {activeOutreachMessage}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyOutreach}
                        className="h-8 px-3 rounded-[8px] border-[var(--hairline-strong)] text-[12px]"
                      >
                        {copiedOutreach ? (
                          <Check className="w-3.5 h-3.5 mr-1.5 text-[hsl(var(--semantic-positive))]" strokeWidth={1.75} />
                        ) : (
                          <Copy className="w-3.5 h-3.5 mr-1.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                        )}
                        {copiedOutreach ? 'Copied message' : 'Copy message'}
                      </Button>
                    </div>
                  </div>
                )}

                {selectedRequirements.length > 0 && (
                  <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[12px] font-medium text-[hsl(var(--ink-primary))] inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--accent-ink))]" strokeWidth={1.75} />
                        Requirements &amp; qualifications
                      </span>
                      <span className="text-[11px] font-mono-num text-[hsl(var(--ink-muted))]">
                        {selectedRequirements.length}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {selectedRequirements.map((req, idx) => (
                        <li
                          key={`${idx}-${req.slice(0, 24)}`}
                          className="flex items-start gap-2 text-[13px] leading-snug text-[hsl(var(--ink-secondary))]"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent-ink))] mt-[7px] flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedApp.description && (
                  <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                    <div className="text-[12px] font-medium text-[hsl(var(--ink-muted))] mb-2">
                      Job description
                    </div>
                    <div className="text-[13px] leading-relaxed text-[hsl(var(--ink-secondary))] whitespace-pre-line">
                      {selectedApp.description}
                    </div>
                  </div>
                )}

                {selectedApp.notes && (
                  <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)]">
                    <div className="text-[12px] font-medium text-[hsl(var(--ink-muted))] mb-1.5">
                      Notes
                    </div>
                    <p className="text-[13px] leading-relaxed text-[hsl(var(--ink-secondary))] whitespace-pre-line">
                      {selectedApp.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--hairline)] bg-[hsl(var(--surface-page))] flex flex-wrap justify-end gap-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const target = selectedApp;
                    setSelectedApp(null);
                    setScheduleApp(target);
                  }}
                  className="h-9 px-4 rounded-[8px]"
                >
                  Schedule interview
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const target = selectedApp;
                    setSelectedApp(null);
                    setEditingApp(target);
                    setShowForm(true);
                  }}
                  className="h-9 px-4 rounded-[8px]"
                >
                  Edit application
                </Button>
                {selectedJobHref && (
                  <a
                    href={selectedJobHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-[13px] font-medium transition-ui ${
                      selectedApplyHref && selectedApplyHref !== selectedJobHref
                        ? 'border border-[var(--hairline-strong)] bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] hover:bg-[hsl(var(--surface-raised))]'
                        : 'bg-[hsl(var(--ink-primary))] text-[hsl(var(--surface-card))] hover:bg-[hsl(0_0%_18%)]'
                    }`}
                  >
                    Open posting
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </a>
                )}
                {selectedApplyHref && selectedApplyHref !== selectedJobHref && (
                  <a
                    href={selectedApplyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] text-[hsl(var(--surface-card))] text-[13px] font-medium hover:bg-[hsl(0_0%_18%)] transition-ui"
                  >
                    Apply directly
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <InterviewFormDialog
        open={!!scheduleApp}
        onOpenChange={(open) => !open && setScheduleApp(null)}
        prefillApplication={scheduleApp}
        applications={applications}
        onSave={async (data) => createInterview(data)}
      />
    </div>
  );
};
