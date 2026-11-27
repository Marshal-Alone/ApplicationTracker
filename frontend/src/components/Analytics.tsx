import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useTracker } from '@/context/TrackerContext';
import {
  APPLICATION_STATUSES,
  exportApplicationsToCsv,
  extractDomain,
} from '@/lib/formatters';
import { diagnoseFresherFunnel } from '@/lib/fresherTools';

export const Analytics = () => {
  const { fresherProfile } = useAuth();
  const { applications, interviews } = useTracker();

  const diagnosis = useMemo(
    () => diagnoseFresherFunnel(applications, interviews, fresherProfile.skills),
    [applications, interviews, fresherProfile.skills]
  );

  const metrics = useMemo(() => {
    const total = applications.length;
    const responded = applications.filter((a) => a.status !== 'Applied').length;
    const interviewed = applications.filter(
      (a) => a.status === 'Interview Scheduled' || a.status === 'Offer'
    ).length;
    const offers = applications.filter((a) => a.status === 'Offer').length;
    const active = applications.filter((a) => a.status !== 'Rejected').length;

    const toPct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

    return {
      total,
      active,
      responseRate: toPct(responded),
      interviewRate: toPct(interviewed),
      offerRate: toPct(offers),
      totalInterviews: interviews.length,
    };
  }, [applications, interviews]);

  const stageBreakdown = useMemo(() => {
    const total = Math.max(applications.length, 1);
    return APPLICATION_STATUSES.map((status) => {
      const count = applications.filter((a) => a.status === status).length;
      const pct = applications.length === 0 ? 0 : Math.round((count / total) * 100);
      return { status, count, pct };
    });
  }, [applications]);

  const funnelStages = useMemo(() => {
    const total = applications.length;
    const denom = Math.max(total, 1);
    const screened = applications.filter((a) => a.status !== 'Applied').length;
    const interviewed = applications.filter(
      (a) => a.status === 'Interview Scheduled' || a.status === 'Offer'
    ).length;
    const offered = applications.filter((a) => a.status === 'Offer').length;

    return [
      { label: 'Submitted applications', count: total, pct: total === 0 ? 0 : 100 },
      { label: 'Moved past Applied', count: screened, pct: total === 0 ? 0 : Math.round((screened / denom) * 100) },
      { label: 'Reached interview stage', count: interviewed, pct: total === 0 ? 0 : Math.round((interviewed / denom) * 100) },
      { label: 'Received offer', count: offered, pct: total === 0 ? 0 : Math.round((offered / denom) * 100) },
    ];
  }, [applications]);

  const domainSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of applications) {
      const d = extractDomain(app.jobUrl);
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
  }, [applications]);

  const cadenceData = useMemo(() => {
    const dateCounts = new Map<string, number>();
    for (const app of applications) {
      const monthKey = (app.appliedDate || '').slice(0, 7);
      if (!monthKey) continue;
      dateCounts.set(monthKey, (dateCounts.get(monthKey) || 0) + 1);
    }
    return Array.from(dateCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([month, count]) => {
        const parsed = new Date(`${month}-01T00:00:00`);
        return {
          label: Number.isNaN(parsed.getTime())
            ? month
            : parsed.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          applications: count,
        };
      });
  }, [applications]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[hsl(var(--ink-primary))]">
            Analytics
          </h1>
          <p className="text-[14px] text-[hsl(var(--ink-secondary))] mt-1.5">
            Conversion metrics computed directly from your tracked pipeline
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={applications.length === 0}
          onClick={() => exportApplicationsToCsv(applications)}
          className="h-9 px-3.5 rounded-[8px] border-[var(--hairline-strong)] self-start sm:self-auto"
        >
          <Download className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
          Export CSV
        </Button>
      </div>

      {/* Top Conversion Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Response rate',
            value: `${metrics.responseRate}%`,
            meta: `${applications.filter((a) => a.status !== 'Applied').length} moved beyond Applied`,
          },
          {
            label: 'Interview conversion',
            value: `${metrics.interviewRate}%`,
            meta: `${metrics.totalInterviews} logged session${metrics.totalInterviews === 1 ? '' : 's'}`,
          },
          {
            label: 'Offer rate',
            value: `${metrics.offerRate}%`,
            meta: `${applications.filter((a) => a.status === 'Offer').length} offer${
              applications.filter((a) => a.status === 'Offer').length === 1 ? '' : 's'
            } received`,
          },
          {
            label: 'Active pipeline',
            value: `${metrics.active}`,
            meta: `of ${metrics.total} total applications`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 space-y-3"
          >
            <div className="text-[13px] text-[hsl(var(--ink-secondary))]">{card.label}</div>
            <div>
              <div className="text-[28px] leading-none font-medium font-mono-num text-[hsl(var(--ink-primary))]">
                {card.value}
              </div>
              <div className="text-[12px] font-mono-num text-[hsl(var(--ink-muted))] mt-1.5">
                {card.meta}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fresher Pipeline Diagnosis + Requested JD Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-2.5">
          <div className="text-[12px] font-mono-num text-[hsl(var(--accent-ink))]">
            Pipeline diagnosis
          </div>
          <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
            {diagnosis.headline}
          </h2>
          <p className="text-[13px] leading-relaxed text-[hsl(var(--ink-secondary))]">
            {diagnosis.detail}
          </p>
        </section>

        <section className="lg:col-span-6 bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
                Most requested skills across your JDs
              </h2>
              <p className="text-[13px] text-[hsl(var(--ink-muted))]">
                Compare recurring requirements against your{' '}
                <Link to="/settings" className="text-[hsl(var(--accent-ink))] hover:underline">
                  resume skills profile
                </Link>
              </p>
            </div>
          </div>

          {diagnosis.allSkillDemand.length === 0 ? (
            <p className="text-[13px] text-[hsl(var(--ink-muted))] py-2">
              Capture or paste full job descriptions to see ranked skill frequency across your target companies.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {diagnosis.allSkillDemand.slice(0, 14).map((item) => (
                <span
                  key={item.skill}
                  className={`px-2.5 py-1 rounded-[6px] text-[12px] font-mono-num border ${
                    item.hasSkill
                      ? 'bg-[hsl(var(--semantic-positive-bg))] border-[rgba(21,128,61,0.2)] text-[hsl(var(--semantic-positive))]'
                      : 'bg-[hsl(var(--surface-page))] border-[var(--hairline)] text-[hsl(var(--ink-secondary))]'
                  }`}
                  title={item.hasSkill ? 'On your resume skills list' : 'Missing from your resume skills list'}
                >
                  {item.skill} ({item.count})
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Funnel + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stage Breakdown */}
        <section className="lg:col-span-7 bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-5">
          <div>
            <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
              Stage distribution
            </h2>
            <p className="text-[13px] text-[hsl(var(--ink-muted))]">
              Current count and share per hiring outcome
            </p>
          </div>

          <div className="space-y-4">
            {stageBreakdown.map((row) => (
              <div key={row.status} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[hsl(var(--ink-primary))]">{row.status}</span>
                  <span className="font-mono-num text-[hsl(var(--ink-secondary))]">
                    {row.count} ({row.pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-[4px] bg-[hsl(var(--surface-raised))] overflow-hidden">
                  <div
                    className={`h-full rounded-[4px] transition-ui ${
                      row.status === 'Offer'
                        ? 'bg-[hsl(var(--semantic-positive))]'
                        : row.status === 'Rejected'
                        ? 'bg-[hsl(var(--semantic-danger))]'
                        : row.status === 'Interview Scheduled'
                        ? 'bg-[hsl(var(--accent-ink))]'
                        : 'bg-[hsl(var(--ink-secondary))]'
                    }`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Source Domains */}
        <section className="lg:col-span-5 bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-5">
          <div>
            <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
              Application sources
            </h2>
            <p className="text-[13px] text-[hsl(var(--ink-muted))]">
              Job boards and direct referrals by URL domain
            </p>
          </div>

          {domainSources.length === 0 ? (
            <p className="text-[13px] text-[hsl(var(--ink-muted))] py-8 text-center">
              No source domain records available yet.
            </p>
          ) : (
            <div className="divide-y divide-[var(--hairline)]">
              {domainSources.map((src) => (
                <div key={src.domain} className="py-2.5 flex items-center justify-between text-[13px]">
                  <span className="font-mono-num text-[hsl(var(--ink-primary))]">{src.domain}</span>
                  <span className="font-mono-num text-[hsl(var(--ink-secondary))]">
                    {src.count} role{src.count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Cumulative Funnel + Monthly Volume Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-5">
          <div>
            <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
              Pipeline conversion funnel
            </h2>
            <p className="text-[13px] text-[hsl(var(--ink-muted))]">
              Cumulative progression from submission to offer
            </p>
          </div>

          <div className="space-y-4">
            {funnelStages.map((step) => (
              <div key={step.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium text-[hsl(var(--ink-primary))]">{step.label}</span>
                  <span className="font-mono-num text-[hsl(var(--ink-secondary))]">
                    {step.count} ({step.pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-[4px] bg-[hsl(var(--surface-raised))] overflow-hidden">
                  <div
                    className="h-full rounded-[4px] bg-[hsl(var(--accent-ink))] transition-ui"
                    style={{ width: `${step.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-7 bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6">
          <div className="mb-5">
            <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
              Submission cadence
            </h2>
            <p className="text-[13px] text-[hsl(var(--ink-muted))]">
              Applications logged across active months
            </p>
          </div>

          {cadenceData.length === 0 ? (
            <div className="h-52 flex items-center justify-center border border-dashed border-[var(--hairline-strong)] rounded-[10px] text-[13px] text-[hsl(var(--ink-muted))]">
              Log applications with dates to chart monthly cadence
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cadenceData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(23,23,23,0.08)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#696969', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#696969', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(23,23,23,0.04)' }}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid rgba(23,23,23,0.14)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <Bar
                    dataKey="applications"
                    name="Applications"
                    fill="#1b4ad6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
