import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Video,
  MapPin,
  Phone,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTracker } from '@/context/TrackerContext';
import { InterviewFormDialog } from './InterviewFormDialog';
import { formatInterviewDateTime, safeExternalUrl } from '@/lib/formatters';
import { Interview, InterviewStatus, InterviewType } from '@/types/tracker';

type InterviewFilter = 'Scheduled' | 'Completed' | 'Cancelled' | 'All';

export const Interviews = () => {
  const {
    applications,
    interviews,
    createInterview,
    updateInterview,
    deleteInterview,
    searchQuery,
  } = useTracker();

  const [filter, setFilter] = useState<InterviewFilter>('Scheduled');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);

  const filteredInterviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return interviews
      .filter((iv) => {
        const matchesTab = filter === 'All' || iv.status === filter;
        const matchesSearch =
          !q ||
          iv.company.toLowerCase().includes(q) ||
          iv.position.toLowerCase().includes(q) ||
          (iv.interviewer && iv.interviewer.toLowerCase().includes(q));
        return matchesTab && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time || '09:00'}`).getTime() -
          new Date(`${b.date}T${b.time || '09:00'}`).getTime()
      );
  }, [interviews, filter, searchQuery]);

  const counts = useMemo(
    () => ({
      Scheduled: interviews.filter((i) => i.status === 'Scheduled').length,
      Completed: interviews.filter((i) => i.status === 'Completed').length,
      Cancelled: interviews.filter((i) => i.status === 'Cancelled').length,
      All: interviews.length,
    }),
    [interviews]
  );

  const getTypeIcon = (type: InterviewType) => {
    switch (type) {
      case 'Video Call':
        return Video;
      case 'On-site':
        return MapPin;
      case 'Phone Call':
        return Phone;
    }
  };

  const setStatus = (id: string, status: InterviewStatus) => {
    updateInterview(id, { status });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[hsl(var(--ink-primary))]">
            Interviews
          </h1>
          <p className="text-[14px] text-[hsl(var(--ink-secondary))] mt-1.5 font-mono-num flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>{counts.Scheduled} upcoming</span>
            <span className="text-[hsl(var(--ink-muted))]">{counts.Completed} completed</span>
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] font-medium text-[13px] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
          Schedule interview
        </Button>
      </div>

      <div
        className="inline-flex max-w-full overflow-x-auto items-center gap-1 bg-[hsl(var(--surface-raised))] p-1 rounded-[10px] border border-[var(--hairline)]"
        role="tablist"
      >
        {(['Scheduled', 'Completed', 'Cancelled', 'All'] as InterviewFilter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filter === tab}
            onClick={() => setFilter(tab)}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-[7px] text-[12px] sm:text-[13px] font-medium whitespace-nowrap transition-ui flex items-center gap-1.5 sm:gap-2 ${
              filter === tab
                ? 'bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                : 'text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))]'
            }`}
          >
            <span>{tab}</span>
            <span className="font-mono-num text-[11px] sm:text-[12px] text-[hsl(var(--ink-muted))]">
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {filteredInterviews.length === 0 ? (
        <div className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-12 text-center">
          <div className="w-11 h-11 rounded-[10px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-5 h-5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
          </div>
          <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))] mb-1">
            No {filter === 'All' ? '' : `${filter.toLowerCase()} `}interviews
          </h2>
          <p className="text-[13px] text-[hsl(var(--ink-muted))] mb-5 max-w-sm mx-auto">
            Keep interview dates, meeting URLs, interviewer names, and prep notes organized per application.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="h-9 px-4 rounded-[8px] border-[var(--hairline-strong)]"
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
            Schedule interview
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInterviews.map((iv) => {
            const Icon = getTypeIcon(iv.type);
            const { dateLabel, timeLabel, timestamp } = formatInterviewDateTime(iv.date, iv.time);
            const validLink = safeExternalUrl(iv.meetingLink);
            const isOverdue = iv.status === 'Scheduled' && timestamp > 0 && timestamp < Date.now() - 3600000;

            return (
              <article
                key={iv.id}
                className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-[15px] font-medium text-[hsl(var(--ink-primary))]">
                        {iv.company}
                      </h2>
                      <span className="text-[12px] px-2 py-0.5 rounded-[5px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] text-[hsl(var(--ink-secondary))]">
                        {iv.status}
                      </span>
                      {isOverdue && (
                        <span className="text-[12px] px-2 py-0.5 rounded-[5px] bg-[hsl(var(--semantic-warning-bg))] border border-[rgba(180,83,9,0.2)] text-[hsl(var(--semantic-warning))]">
                          Past due
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[hsl(var(--ink-secondary))] mt-0.5">
                      {iv.position}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-[12px] font-mono-num text-[hsl(var(--ink-muted))]">
                      <span>{dateLabel}</span>
                      <span>{timeLabel}</span>
                      <span>{iv.type}</span>
                      {iv.interviewer && <span>Interviewer: {iv.interviewer}</span>}
                      {iv.location && <span>{iv.location}</span>}
                    </div>
                    {iv.notes && (
                      <p className="text-[13px] text-[hsl(var(--ink-secondary))] mt-2.5 bg-[hsl(var(--surface-page))] border border-[var(--hairline)] rounded-[8px] p-2.5">
                        {iv.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {validLink && (
                    <a
                      href={validLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[hsl(var(--surface-card))] hover:bg-[hsl(var(--surface-raised))] text-[12px] font-medium text-[hsl(var(--accent-ink))]"
                    >
                      Join
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </a>
                  )}
                  {iv.status === 'Scheduled' && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatus(iv.id, 'Completed')}
                        className="h-8 w-8 p-0 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-positive))]"
                        title="Mark completed"
                        aria-label="Mark completed"
                      >
                        <Check className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatus(iv.id, 'Cancelled')}
                        className="h-8 w-8 p-0 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-warning))]"
                        title="Cancel interview"
                        aria-label="Cancel interview"
                      >
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </Button>
                    </>
                  )}
                  {iv.status !== 'Scheduled' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStatus(iv.id, 'Scheduled')}
                      className="h-8 w-8 p-0 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))]"
                      title="Reopen as scheduled"
                      aria-label="Reopen as scheduled"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(iv);
                      setModalOpen(true);
                    }}
                    className="h-8 w-8 p-0 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))]"
                    title="Edit"
                    aria-label="Edit"
                  >
                    <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteInterview(iv.id)}
                    className="h-8 w-8 p-0 text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-danger))]"
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <InterviewFormDialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
        applications={applications}
        onSave={async (data, editingId) =>
          editingId ? updateInterview(editingId, data) : createInterview(data)
        }
      />
    </div>
  );
};
