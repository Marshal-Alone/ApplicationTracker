import React from 'react';
import { ApplicationStatus } from '@/types/tracker';
import { STAGE_STEP_INDEX, STATUS_STYLE } from '@/lib/formatters';

interface StagePipsProps {
  status: ApplicationStatus;
  compact?: boolean;
}

const STEPS = ['Applied', 'Review', 'Interview', 'Offer'];

export const StagePips: React.FC<StagePipsProps> = ({ status, compact = false }) => {
  const stepIndex = STAGE_STEP_INDEX[status];
  const isRejected = status === 'Rejected';
  const style = STATUS_STYLE[status] || STATUS_STYLE.Applied;

  return (
    <div className="inline-flex items-center gap-2.5" title={`Stage: ${style.label}`}>
      <div className="flex items-center gap-1" aria-hidden="true">
        {STEPS.map((label, idx) => {
          const active = !isRejected && idx < stepIndex;
          const current = !isRejected && idx === stepIndex - 1;
          let barClass = 'bg-[var(--hairline-strong)]';
          if (isRejected) {
            barClass = idx === 0 ? 'bg-[hsl(var(--semantic-danger))]' : 'bg-[var(--hairline)]';
          } else if (status === 'Offer' && active) {
            barClass = 'bg-[hsl(var(--semantic-positive))]';
          } else if (current || active) {
            barClass = 'bg-[hsl(var(--accent-ink))]';
          }

          return (
            <span
              key={label}
              className={`h-1.5 rounded-[2px] transition-ui ${
                compact ? 'w-3' : 'w-4'
              } ${barClass}`}
            />
          );
        })}
      </div>
      <span className="text-[12px] leading-4 text-[hsl(var(--ink-secondary))] font-medium whitespace-nowrap">
        {style.label}
      </span>
    </div>
  );
};
