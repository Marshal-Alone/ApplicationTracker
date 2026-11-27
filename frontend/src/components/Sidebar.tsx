import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  Briefcase,
  Calendar,
  Building2,
  BarChart3,
  Puzzle,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useTracker } from '@/context/TrackerContext';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  onNavigate?: () => void;
}

export const SidebarNavContent: React.FC<SidebarProps> = ({ onNavigate }) => {
  const { applications, interviews, syncMode, backendHealth } = useTracker();
  const { isAuthenticated, user } = useAuth();

  const scheduledInterviewsCount = interviews.filter((i) => i.status === 'Scheduled').length;

  const primaryNav = [
    { icon: LayoutGrid, label: 'Overview', path: '/', count: null },
    {
      icon: Briefcase,
      label: 'Applications',
      path: '/applications',
      count: applications.length > 0 ? applications.length : null,
    },
    {
      icon: Calendar,
      label: 'Interviews',
      path: '/interviews',
      count: scheduledInterviewsCount > 0 ? scheduledInterviewsCount : null,
    },
  ];

  const insightsNav = [
    { icon: Building2, label: 'Companies', path: '/companies' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  ];

  const toolsNav = [
    { icon: Puzzle, label: 'Chrome extension', path: '/extension' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const renderNavLink = (item: {
    icon: LucideIcon;
    label: string;
    path: string;
    count?: number | null;
  }) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center justify-between h-9 px-3 rounded-[8px] text-[14px] leading-5 transition-ui ${
          isActive
            ? 'bg-[hsl(var(--surface-card))] text-[hsl(var(--ink-primary))] font-medium border border-[var(--hairline)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]'
            : 'text-[hsl(var(--ink-secondary))] hover:bg-[hsl(var(--surface-raised))] hover:text-[hsl(var(--ink-primary))] font-normal border border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="w-4 flex items-center justify-center flex-shrink-0">
              <item.icon
                className={`w-4 h-4 transition-ui ${
                  isActive
                    ? 'text-[hsl(var(--accent-ink))]'
                    : 'text-[hsl(var(--ink-muted))] group-hover:text-[hsl(var(--ink-secondary))]'
                }`}
                strokeWidth={1.5}
              />
            </span>
            <span className="truncate">{item.label}</span>
          </span>
          {item.count !== undefined && item.count !== null && (
            <span className="font-mono-num text-[12px] text-[hsl(var(--ink-muted))] pl-2">
              {item.count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--surface-sidebar))] border-r border-[var(--hairline)]">
      {/* Brand header */}
      <div className="h-14 px-4 flex items-center border-b border-[var(--hairline)] flex-shrink-0">
        <NavLink
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-[6px] focus-visible:outline-none"
        >
          <span
            className="w-6 h-6 rounded-[6px] bg-[hsl(var(--ink-primary))] text-[hsl(var(--surface-card))] flex items-center justify-center flex-shrink-0 relative"
            aria-hidden="true"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2.5" width="10" height="2" rx="0.5" fill="currentColor" />
              <rect x="2" y="6" width="6.5" height="2" rx="0.5" fill="currentColor" fillOpacity="0.85" />
              <rect x="2" y="9.5" width="4" height="2" rx="0.5" fill="hsl(224, 76%, 62%)" />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-none tracking-[-0.01em] text-[hsl(var(--ink-primary))] truncate">
              ApplicationTracker
            </div>
          </div>
        </NavLink>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6" aria-label="Main navigation">
        <div>
          <div className="px-3 mb-2 text-[12px] leading-4 font-normal text-[hsl(var(--ink-muted))]">
            Workspace
          </div>
          <div className="space-y-0.5">{primaryNav.map(renderNavLink)}</div>
        </div>

        <div>
          <div className="px-3 mb-2 text-[12px] leading-4 font-normal text-[hsl(var(--ink-muted))]">
            Pipeline
          </div>
          <div className="space-y-0.5">{insightsNav.map(renderNavLink)}</div>
        </div>

        <div>
          <div className="px-3 mb-2 text-[12px] leading-4 font-normal text-[hsl(var(--ink-muted))]">
            Tools
          </div>
          <div className="space-y-0.5">{toolsNav.map(renderNavLink)}</div>
        </div>
      </nav>

      {/* Bottom sync status */}
      <div className="p-3 border-t border-[var(--hairline)] flex-shrink-0">
        <NavLink
          to="/settings"
          onClick={onNavigate}
          className="flex items-center justify-between px-3 py-2 rounded-[8px] hover:bg-[hsl(var(--surface-raised))] transition-ui"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                syncMode === 'synced' && backendHealth.ok
                  ? 'bg-[hsl(var(--semantic-positive))]'
                  : 'bg-[hsl(var(--ink-muted))]'
              }`}
            />
            <span className="text-[12px] text-[hsl(var(--ink-secondary))] truncate">
              {isAuthenticated && user
                ? syncMode === 'synced'
                  ? 'Account synced'
                  : 'Offline cache'
                : 'Local workspace'}
            </span>
          </div>
          {backendHealth.ok && backendHealth.latencyMs !== undefined && (
            <span className="font-mono-num text-[11px] text-[hsl(var(--ink-muted))]">
              {backendHealth.latencyMs}ms
            </span>
          )}
        </NavLink>
      </div>
    </div>
  );
};

export const Sidebar = () => {
  return (
    <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-60 z-30">
      <SidebarNavContent />
    </aside>
  );
};
