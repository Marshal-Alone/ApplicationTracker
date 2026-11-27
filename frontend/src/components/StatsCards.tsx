import React from 'react';
import { Interview, JobApplication } from '@/types/tracker';

interface StatsCardsProps {
  applications: JobApplication[];
  interviews?: Interview[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ applications, interviews = [] }) => {
  const totalApplications = applications.length;
  const underReview = applications.filter((app) => app.status === 'Under Review').length;
  const interviewsCount = applications.filter(
    (app) => app.status === 'Interview Scheduled'
  ).length;
  const scheduledUpcoming = interviews.filter(
    (iv) => iv.status === 'Scheduled' && new Date(`${iv.date}T${iv.time || '09:00'}`) >= new Date()
  ).length;
  const offers = applications.filter((app) => app.status === 'Offer').length;
  const activeCount = applications.filter((app) => app.status !== 'Rejected').length;

  const pct = (count: number) => {
    if (totalApplications === 0) return '0%';
    return `${Math.round((count / totalApplications) * 100)}%`;
  };

  const stats = [
    {
      label: 'Total applications',
      value: totalApplications,
      meta:
        totalApplications === 0
          ? 'No roles logged yet'
          : `${activeCount} active in pipeline`,
      accent: false,
    },
    {
      label: 'Under review',
      value: underReview,
      meta: `${pct(underReview)} of total`,
      accent: false,
    },
    {
      label: 'Interviews',
      value: Math.max(interviewsCount, scheduledUpcoming),
      meta:
        scheduledUpcoming > 0
          ? `${scheduledUpcoming} upcoming scheduled`
          : `${pct(interviewsCount)} interview rate`,
      accent: scheduledUpcoming > 0 || interviewsCount > 0,
    },
    {
      label: 'Offers',
      value: offers,
      meta: offers > 0 ? `${pct(offers)} conversion rate` : 'No offers recorded',
      accent: offers > 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 flex flex-col justify-between gap-4"
        >
          <div className="text-[13px] leading-5 font-normal text-[hsl(var(--ink-secondary))]">
            {stat.label}
          </div>
          <div className="space-y-1.5">
            <div className="text-[30px] leading-none font-medium tracking-[-0.02em] font-mono-num text-[hsl(var(--ink-primary))]">
              {stat.value}
            </div>
            <div
              className={`text-[12px] leading-4 font-mono-num ${
                stat.accent
                  ? 'text-[hsl(var(--accent-ink))]'
                  : 'text-[hsl(var(--ink-muted))]'
              }`}
            >
              {stat.meta}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
