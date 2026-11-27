import React from 'react';
import {
  Download,
  FolderOpen,
  Settings2,
  Chrome,
  Upload,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const SUPPORTED_BOARDS = [
  'LinkedIn Jobs',
  'Internshala',
  'Unstop',
  'Indeed',
  'Naukri',
  'Glassdoor',
];

const SETUP_STEPS = [
  {
    icon: Download,
    title: 'Download extension archive',
    description: 'Download the unpacked extension zip package to your computer.',
  },
  {
    icon: FolderOpen,
    title: 'Extract folder',
    description: 'Unzip the archive into a permanent folder you will keep on disk.',
  },
  {
    icon: Chrome,
    title: 'Open chrome://extensions',
    description: 'Navigate to your Chrome extensions manager in a new tab.',
  },
  {
    icon: Settings2,
    title: 'Enable developer mode',
    description: 'Turn on the Developer mode toggle in the top-right corner.',
  },
  {
    icon: Upload,
    title: 'Load unpacked directory',
    description: 'Click Load unpacked and select the extracted folder containing manifest.json.',
  },
  {
    icon: CheckCircle2,
    title: 'Connect your API key',
    description: 'Open Extension settings, paste your personal key, and capture roles.',
  },
];

export const ExtensionDownload = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const handleCopyKey = () => {
    if (!user?.apiKey) return;
    navigator.clipboard.writeText(user.apiKey);
    toast({ title: 'API key copied' });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[hsl(var(--ink-primary))]">
          Chrome extension
        </h1>
        <p className="text-[14px] text-[hsl(var(--ink-secondary))] mt-1.5">
          Extract job titles, compensation, company names, and descriptions directly from job postings
        </p>
      </div>

      {/* Primary Card */}
      <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 text-[12px] font-mono-num text-[hsl(var(--accent-ink))]">
            <span>Manifest V3</span>
            <span>/</span>
            <span>Local &amp; synced capture</span>
          </div>
          <h2 className="text-[20px] font-medium tracking-[-0.01em] text-[hsl(var(--ink-primary))]">
            ApplicationTracker Assistant
          </h2>
          <p className="text-[13px] leading-relaxed text-[hsl(var(--ink-secondary))]">
            Opens in a persistent Chrome right sidebar that stays open as you browse, click, or inspect job boards, ATS portals, and startup career pages.
          </p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUPPORTED_BOARDS.map((board) => (
              <span
                key={board}
                className="px-2.5 py-1 rounded-[6px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] text-[12px] text-[hsl(var(--ink-secondary))]"
              >
                {board}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 flex-shrink-0 md:items-end">
          <a
            href="/extension.zip"
            download="applicationtracker-extension.zip"
            onClick={() =>
              toast({
                title: 'Downloading extension archive',
                description: 'Extract the zip and load it via chrome://extensions',
              })
            }
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] text-[13px] font-medium transition-ui"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            Download extension zip
          </a>

          {isAuthenticated && user?.apiKey && (
            <button
              type="button"
              onClick={handleCopyKey}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[8px] border border-[var(--hairline-strong)] bg-[hsl(var(--surface-card))] hover:bg-[hsl(var(--surface-raised))] text-[12px] font-medium text-[hsl(var(--ink-secondary))] transition-ui"
            >
              <Key className="w-3.5 h-3.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
              Copy personal API key
            </button>
          )}
        </div>
      </section>

      {/* Setup Steps Grid */}
      <section className="space-y-3">
        <h2 className="text-[15px] font-medium text-[hsl(var(--ink-primary))]">
          Installation steps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SETUP_STEPS.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.title}
                className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center">
                    <StepIcon className="w-4 h-4 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
                  </div>
                  <span className="font-mono-num text-[12px] text-[hsl(var(--ink-muted))]">
                    0{index + 1}
                  </span>
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-[hsl(var(--ink-primary))] mb-1">
                    {step.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-[hsl(var(--ink-secondary))]">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Operational Notes */}
      <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-5">
        <h2 className="text-[14px] font-medium text-[hsl(var(--ink-primary))] mb-2.5">
          Usage notes
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px] text-[hsl(var(--ink-secondary))]">
          <li>Reload any already-open job board tabs after installing or updating the extension.</li>
          <li>Pin ApplicationTracker Assistant in Chrome so auto-captured jobs stay one click away.</li>
          <li>Point Server URL in extension settings to http://localhost:3001 when running locally.</li>
          <li>Offline captures queue locally in extension storage and retry automatically when online.</li>
        </ul>
      </section>
    </div>
  );
};
