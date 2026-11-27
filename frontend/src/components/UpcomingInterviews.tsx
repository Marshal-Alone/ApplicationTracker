import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Video, MapPin, Phone, Plus, Edit3, Trash2, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTracker } from '@/context/TrackerContext';
import { InterviewFormDialog } from './InterviewFormDialog';
import { Interview, InterviewType } from '@/types/tracker';
import { formatInterviewDateTime, safeExternalUrl } from '@/lib/formatters';

interface UpcomingInterviewsProps {
  applications?: { id: string; company: string; position: string; status: string }[];
}

export const UpcomingInterviews: React.FC<UpcomingInterviewsProps> = () => {
  const {
    applications,
    interviews,
    createInterview,
    updateInterview,
    deleteInterview,
  } = useTracker();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);

  const scheduledApplications = applications.filter(
    (app) => app.status === 'Interview Scheduled'
  );

  const upcomingInterviews = interviews
    .filter(
      (iv) =>
        iv.status === 'Scheduled' &&
        new Date(`${iv.date}T${iv.time || '23:59'}`).getTime() >= Date.now() - 3600000
    )
    .sort(
      (a, b) =>
        new Date(`${a.date}T${a.time || '09:00'}`).getTime() -
        new Date(`${b.date}T${b.time || '09:00'}`).getTime()
    )
    .slice(0, 4);

  const prefillApp = scheduledApplications[0] || applications[0] || null;

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

  return (
    <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[16px] leading-6 font-medium text-[hsl(var(--ink-primary))]">
            Upcoming interviews
          </h2>
          <p className="text-[13px] leading-5 text-[hsl(var(--ink-muted))] font-mono-num">
            {upcomingInterviews.length > 0
              ? `${upcomingInterviews.length} scheduled`
              : `${scheduledApplications.length} awaiting time slot`}
          </p>
        </div>

        {upcomingInterviews.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingInterview(null);
              setModalOpen(true);
            }}
            className="h-8 px-2.5 text-[12px] rounded-[8px] border-[var(--hairline-strong)]"
          >
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
            Schedule
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {upcomingInterviews.length > 0 ? (
          <div className="space-y-2.5">
            {upcomingInterviews.map((iv) => {
              const Icon = getTypeIcon(iv.type);
              const { dateLabel, timeLabel } = formatInterviewDateTime(iv.date, iv.time);
              const validMeetingLink = safeExternalUrl(iv.meetingLink);
              const isToday =
                new Date(`${iv.date}T00:00:00`).toDateString() === new Date().toDateString();

              return (
                <div
                  key={iv.id}
                  className={`p-3.5 rounded-[10px] border transition-ui ${
                    isToday
                      ? 'bg-[var(--accent-tint)] border-[rgba(27,74,214,0.22)]'
                      : 'bg-[hsl(var(--surface-page))] border-[var(--hairline)]'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-[6px] bg-[hsl(var(--surface-card))] border border-[var(--hairline)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-medium text-[hsl(var(--ink-primary))] truncate">
                            {iv.company}
                          </span>
                          {isToday && (
                            <span className="text-[11px] font-mono-num font-medium text-[hsl(var(--accent-ink))] flex-shrink-0">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] text-[hsl(var(--ink-secondary))] truncate">
                          {iv.position}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--hairline)]">
                      <div className="flex flex-wrap items-center gap-2.5 text-[12px] font-mono-num text-[hsl(var(--ink-muted))]">
                        <span>{dateLabel}</span>
                        <span>{timeLabel}</span>
                      </div>

                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {validMeetingLink && (
                          <a
                            href={validMeetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-[6px] text-[hsl(var(--accent-ink))] hover:bg-[hsl(var(--surface-card))] transition-ui"
                            title="Open meeting link"
                            aria-label="Open meeting link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => updateInterview(iv.id, { status: 'Completed' })}
                          className="p-1.5 rounded-[6px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-positive))] hover:bg-[hsl(var(--surface-card))] transition-ui"
                          title="Mark completed"
                          aria-label="Mark completed"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingInterview(iv);
                            setModalOpen(true);
                          }}
                          className="p-1.5 rounded-[6px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))] hover:bg-[hsl(var(--surface-card))] transition-ui"
                          title="Edit interview"
                          aria-label="Edit interview"
                        >
                          <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteInterview(iv.id)}
                          className="p-1.5 rounded-[6px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-danger))] hover:bg-[hsl(var(--surface-card))] transition-ui"
                          title="Remove interview"
                          aria-label="Remove interview"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="pt-2">
              <Link
                to="/interviews"
                className="text-[12px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
              >
                Open full interview schedule
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="w-10 h-10 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-4 h-4 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-medium text-[hsl(var(--ink-primary))] mb-1">
              {scheduledApplications.length > 0 ? 'Ready to schedule' : 'No interviews scheduled'}
            </p>
            <p className="text-[13px] text-[hsl(var(--ink-muted))] mb-4 max-w-[240px] mx-auto">
              {scheduledApplications.length > 0
                ? `${scheduledApplications.length} application${
                    scheduledApplications.length === 1 ? '' : 's'
                  } reached interview stage`
                : 'Log upcoming phone screens, technical rounds, and panels'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingInterview(null);
                setModalOpen(true);
              }}
              className="h-9 px-3.5 rounded-[8px] border-[var(--hairline-strong)] font-medium text-[13px]"
            >
              <Plus className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
              Schedule interview
            </Button>
          </div>
        )}
      </div>

      <InterviewFormDialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingInterview(null);
        }}
        editing={editingInterview}
        prefillApplication={!editingInterview ? prefillApp : null}
        applications={applications}
        onSave={async (data, editingId) =>
          editingId ? updateInterview(editingId, data) : createInterview(data)
        }
      />
    </section>
  );
};
