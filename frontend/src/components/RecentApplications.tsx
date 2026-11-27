import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Edit3, Trash2, ExternalLink, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTracker } from '@/context/TrackerContext';
import { ApplicationForm } from './ApplicationForm';
import { StagePips } from './StagePips';
import { extractDomain, formatShortDate, safeExternalUrl } from '@/lib/formatters';
import { JobApplication } from '@/types/tracker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const RecentApplications = () => {
  const { applications, isLoading, updateApplication, deleteApplication } = useTracker();
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);

  const recentApps = applications.slice(0, 5);

  if (isLoading) {
    return (
      <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6">
        <div className="h-5 w-40 bg-[hsl(var(--surface-raised))] rounded mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 bg-[hsl(var(--surface-raised))] rounded-[8px]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--hairline)] flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[16px] leading-6 font-medium text-[hsl(var(--ink-primary))]">
            Recent applications
          </h2>
          <p className="text-[13px] leading-5 text-[hsl(var(--ink-muted))]">
            Latest entries in your hiring ledger
          </p>
        </div>

        <Link
          to="/applications"
          className="inline-flex items-center h-8 px-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[hsl(var(--surface-card))] hover:bg-[hsl(var(--surface-raised))] text-[13px] font-medium text-[hsl(var(--ink-primary))] transition-ui"
        >
          View all
        </Link>
      </div>

      {recentApps.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <div className="w-10 h-10 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center mx-auto mb-3">
            <Briefcase className="w-4 h-4 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
          </div>
          <p className="text-[14px] font-medium text-[hsl(var(--ink-primary))] mb-1">
            No applications logged yet
          </p>
          <p className="text-[13px] text-[hsl(var(--ink-muted))]">
            Use the Add application button above or capture jobs from Chrome
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--hairline)]">
          {recentApps.map((app) => {
            const href = safeExternalUrl(app.jobUrl);
            const domain = extractDomain(app.jobUrl);

            return (
              <div
                key={app.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[hsl(var(--surface-page))] transition-ui"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center text-[13px] font-medium text-[hsl(var(--ink-primary))] flex-shrink-0">
                    {app.company.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[14px] font-medium text-[hsl(var(--ink-primary))] truncate">
                        {app.company}
                      </span>
                      <span className="text-[12px] font-mono-num text-[hsl(var(--ink-muted))] hidden md:inline">
                        {domain}
                      </span>
                    </div>
                    <p className="text-[13px] text-[hsl(var(--ink-secondary))] truncate">
                      {app.position}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0">
                  <StagePips status={app.status} compact />

                  <span className="font-mono-num text-[12px] text-[hsl(var(--ink-muted))] w-24 text-right hidden sm:inline-block">
                    {formatShortDate(app.appliedDate)}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))]"
                        aria-label={`Actions for ${app.company}`}
                      >
                        <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-44 bg-[hsl(var(--surface-card))] border border-[var(--hairline-strong)] rounded-[10px] shadow-[var(--shadow-float)] p-1"
                    >
                      {href && (
                        <DropdownMenuItem asChild className="cursor-pointer rounded-[6px] text-[13px]">
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                            Open posting
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setEditingApp(app)}
                        className="cursor-pointer rounded-[6px] text-[13px]"
                      >
                        <Edit3 className="w-4 h-4 mr-2 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                        Edit
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
              </div>
            );
          })}
        </div>
      )}

      {editingApp && (
        <ApplicationForm
          application={editingApp}
          onClose={() => setEditingApp(null)}
          onSubmit={async (updates) => {
            await updateApplication(editingApp.id, updates);
            setEditingApp(null);
          }}
        />
      )}
    </section>
  );
};
