import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTracker } from '@/context/TrackerContext';
import { APPLICATION_STATUSES } from '@/lib/formatters';

type ChartView = 'timeline' | 'stages';

export const ApplicationChart = () => {
  const { applications, interviews } = useTracker();
  const [view, setView] = useState<ChartView>('timeline');

  const { monthlyData, rangeLabel } = useMemo(() => {
    // Anchor 6-month window at latest application date or current date if recent apps exist
    const validDates = applications
      .map((a) => new Date(`${a.appliedDate}T00:00:00`))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());

    const now = new Date();
    let anchor = now;
    if (validDates.length > 0) {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      if (validDates[0] < sixMonthsAgo) {
        anchor = validDates[0];
      }
    }

    const buckets: { key: string; name: string; submitted: number; progressed: number }[] = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleDateString('en-US', { month: 'short' });
      buckets.push({ key, name, submitted: 0, progressed: 0 });
    }

    const bucketMap = new Map(buckets.map((b) => [b.key, b]));
    const progressedAppIds = new Set<string>();

    for (const iv of interviews) {
      if (iv.status !== 'Cancelled' && iv.applicationId) {
        progressedAppIds.add(iv.applicationId);
      }
    }

    for (const app of applications) {
      const key = (app.appliedDate || '').slice(0, 7);
      const bucket = bucketMap.get(key);
      if (bucket) {
        bucket.submitted += 1;
        if (
          (app.status !== 'Applied' && app.status !== 'Rejected') ||
          progressedAppIds.has(app.id)
        ) {
          bucket.progressed += 1;
        }
      }
    }

    const firstDate = new Date(anchor.getFullYear(), anchor.getMonth() - 5, 1);
    const label = `${firstDate.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })} — ${anchor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

    return { monthlyData: buckets, rangeLabel: label };
  }, [applications, interviews]);

  const stageData = useMemo(() => {
    return APPLICATION_STATUSES.map((status) => ({
      stage: status === 'Interview Scheduled' ? 'Interview' : status,
      count: applications.filter((a) => a.status === status).length,
    }));
  }, [applications]);

  return (
    <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 flex flex-col justify-between h-full">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[16px] leading-6 font-medium text-[hsl(var(--ink-primary))]">
            Pipeline activity
          </h2>
          <p className="text-[13px] leading-5 text-[hsl(var(--ink-muted))] font-mono-num">
            {view === 'timeline' ? rangeLabel : 'Distribution across stages'}
          </p>
        </div>

        <div
          className="inline-flex items-center bg-[hsl(var(--surface-raised))] p-1 rounded-[8px] border border-[var(--hairline)] self-start"
          role="tablist"
          aria-label="Chart mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'timeline'}
            onClick={() => setView('timeline')}
            className={`px-3 py-1 rounded-[6px] text-[12px] font-medium transition-ui ${
              view === 'timeline'
                ? 'bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                : 'text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'stages'}
            onClick={() => setView('stages')}
            className={`px-3 py-1 rounded-[6px] text-[12px] font-medium transition-ui ${
              view === 'stages'
                ? 'bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                : 'text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))]'
            }`}
          >
            By stage
          </button>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="h-[264px] flex flex-col items-center justify-center border border-dashed border-[var(--hairline-strong)] rounded-[10px] text-center px-4">
          <p className="text-[14px] font-medium text-[hsl(var(--ink-secondary))] mb-1">
            No pipeline history yet
          </p>
          <p className="text-[13px] text-[hsl(var(--ink-muted))] max-w-xs">
            Your monthly application cadence and stage conversion will render here as roles are logged.
          </p>
        </div>
      ) : (
        <>
          <div className="h-[248px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {view === 'timeline' ? (
                <AreaChart data={monthlyData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="atSubmittedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1b4ad6" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="#1b4ad6" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(23, 23, 23, 0.08)"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#696969', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                    dy={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#696969', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid rgba(23, 23, 23, 0.14)',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(23, 23, 23, 0.07)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="submitted"
                    name="Applications"
                    stroke="#1b4ad6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#atSubmittedFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="progressed"
                    name="Responses & interviews"
                    stroke="#15803d"
                    strokeWidth={1.75}
                    fillOpacity={0}
                  />
                </AreaChart>
              ) : (
                <BarChart data={stageData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(23, 23, 23, 0.08)"
                  />
                  <XAxis
                    dataKey="stage"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#696969', fontSize: 12 }}
                    dy={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#696969', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(23, 23, 23, 0.04)' }}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid rgba(23, 23, 23, 0.14)',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(23, 23, 23, 0.07)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Roles"
                    fill="#1b4ad6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-5 pt-4 mt-2 border-t border-[var(--hairline)] text-[12px] text-[hsl(var(--ink-secondary))]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[hsl(var(--accent-ink))]" />
              <span>{view === 'timeline' ? 'Applications submitted' : 'Roles in stage'}</span>
            </div>
            {view === 'timeline' && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-[hsl(var(--semantic-positive))]" />
                <span>Responses &amp; interviews</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
