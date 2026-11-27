import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Key,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Settings,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useTracker } from '@/context/TrackerContext';
import { AuthModal } from './AuthModal';
import { ApiKeyModal } from './ApiKeyModal';
import { ApplicationForm } from './ApplicationForm';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SidebarNavContent } from './Sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { JobApplication } from '@/types/tracker';

export const Header = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { applications, searchQuery, setSearchQuery, createApplication } = useTracker();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [addAppModalOpen, setAddAppModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const quickMatches = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return applications
      .filter(
        (app) =>
          app.company.toLowerCase().includes(q) ||
          app.position.toLowerCase().includes(q) ||
          (app.location && app.location.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [applications, searchQuery]);

  const handleQuickSelect = (app: JobApplication) => {
    setSearchQuery(app.company);
    setSearchFocused(false);
    navigate('/applications');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setSearchFocused(false);
      navigate('/applications');
    } else if (e.key === 'Escape') {
      setSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <header className="h-14 bg-[hsl(var(--surface-card))] border-b border-[var(--hairline)] px-4 sm:px-6 lg:px-8 sticky top-0 z-30 flex items-center justify-between gap-3">
      {/* Left: Mobile Drawer Trigger + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMobileNavOpen(true)}
          className="lg:hidden h-9 w-9 p-0 text-[hsl(var(--ink-secondary))]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" strokeWidth={1.5} />
        </Button>

        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--ink-muted))] w-4 h-4 pointer-events-none"
            strokeWidth={1.5}
          />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search"
            aria-label="Search applications"
            className="pl-9 pr-10 sm:pr-14 h-9 bg-[hsl(var(--surface-raised))] border-[var(--hairline)] focus:bg-[hsl(var(--surface-card))] rounded-[8px] text-[14px] placeholder:text-[hsl(var(--ink-muted))]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--ink-primary))]"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-mono-num text-[hsl(var(--ink-muted))] bg-[hsl(var(--surface-card))] border border-[var(--hairline)] rounded-[4px] pointer-events-none">
              ⌘K
            </kbd>
          )}

          {/* Quick Search Matches Popover */}
          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-11 bg-[hsl(var(--surface-card))] border border-[var(--hairline-strong)] rounded-[10px] shadow-[var(--shadow-float)] py-1.5 z-50">
              {quickMatches.length > 0 ? (
                <>
                  {quickMatches.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onMouseDown={() => handleQuickSelect(app)}
                      className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[hsl(var(--surface-raised))] transition-ui"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-[13px] font-medium text-[hsl(var(--ink-primary))] truncate">
                          {app.company}
                        </div>
                        <div className="text-[12px] text-[hsl(var(--ink-muted))] truncate">
                          {app.position}
                        </div>
                      </div>
                      <ArrowUpRight
                        className="w-3.5 h-3.5 text-[hsl(var(--ink-muted))] flex-shrink-0"
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                  <div className="border-t border-[var(--hairline)] mt-1 pt-1 px-3 py-1">
                    <button
                      type="button"
                      onMouseDown={() => navigate('/applications')}
                      className="text-[12px] text-[hsl(var(--accent-ink))] hover:underline"
                    >
                      View all matches in Applications
                    </button>
                  </div>
                </>
              ) : (
                <div className="px-3 py-2 text-[12px] text-[hsl(var(--ink-muted))]">
                  No tracked applications match &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Add application"
          onClick={() => setAddAppModalOpen(true)}
          className="h-9 px-3 rounded-[8px] border-[var(--hairline-strong)] text-[hsl(var(--ink-primary))] bg-[hsl(var(--surface-card))] hover:bg-[hsl(var(--surface-raised))] font-medium text-[13px]"
        >
          <Plus className="w-4 h-4 sm:mr-1.5 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
          <span className="hidden sm:inline">Add application</span>
        </Button>

        {isAuthenticated && user ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApiKeyModalOpen(true)}
              className="hidden md:inline-flex h-9 px-3 rounded-[8px] border-[var(--hairline)] text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))] hover:bg-[hsl(var(--surface-raised))] font-medium text-[13px]"
            >
              <Key className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
              Extension key
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-[8px] border border-[var(--hairline)] hover:bg-[hsl(var(--surface-raised))] transition-ui"
                >
                  <span className="w-6 h-6 rounded-[6px] bg-[hsl(var(--ink-primary))] text-[hsl(var(--surface-card))] flex items-center justify-center text-[12px] font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline text-[13px] font-medium text-[hsl(var(--ink-primary))] max-w-[110px] truncate">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-[hsl(var(--surface-card))] border border-[var(--hairline-strong)] rounded-[10px] shadow-[var(--shadow-float)] p-1"
              >
                <DropdownMenuLabel className="font-normal px-2.5 py-2">
                  <div className="text-[13px] font-medium text-[hsl(var(--ink-primary))] truncate">
                    {user.name}
                  </div>
                  <div className="text-[12px] text-[hsl(var(--ink-muted))] truncate">
                    {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setApiKeyModalOpen(true)}
                  className="gap-2 cursor-pointer rounded-[6px] text-[13px]"
                >
                  <Key className="w-4 h-4 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                  Chrome extension key
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/settings')}
                  className="gap-2 cursor-pointer rounded-[6px] text-[13px]"
                >
                  <Settings className="w-4 h-4 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="gap-2 cursor-pointer rounded-[6px] text-[13px] text-[hsl(var(--semantic-danger))]"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.5} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="h-9 px-3 text-[13px] font-medium whitespace-nowrap text-[hsl(var(--ink-secondary))] hover:text-[hsl(var(--ink-primary))] rounded-[8px] hover:bg-[hsl(var(--surface-raised))] transition-ui"
            >
              Sign in
            </button>
            <Button
              type="button"
              size="sm"
              onClick={() => openAuth('signup')}
              className="h-9 px-3.5 whitespace-nowrap bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] rounded-[8px] font-medium text-[13px]"
            >
              <LogIn className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" strokeWidth={1.5} />
              Get started
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Navigation Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r border-[var(--hairline)]">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarNavContent onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultMode={authMode}
      />

      <ApiKeyModal isOpen={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />

      {addAppModalOpen && (
        <ApplicationForm
          onClose={() => setAddAppModalOpen(false)}
          onSubmit={async (data) => {
            await createApplication(data);
          }}
        />
      )}
    </header>
  );
};
