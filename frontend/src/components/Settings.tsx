import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Server,
  User as UserIcon,
  Briefcase,
  Plus,
  X,
  FileText,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectField } from '@/components/ui/select-field';
import { useAuth } from '@/context/AuthContext';
import { useTracker } from '@/context/TrackerContext';
import { useToast } from '@/hooks/use-toast';
import { exportApplicationsToCsv, exportWorkspaceJson } from '@/lib/formatters';
import { FRESHER_SKILL_PRESETS } from '@/lib/fresherTools';
import { AuthModal } from './AuthModal';

export const Settings = () => {
  const {
    user,
    isAuthenticated,
    backendUrl,
    setBackendUrl,
    updateProfile,
    updatePassword,
    regenerateApiKey,
    deleteAccount,
    logout,
    fresherProfile,
    saveFresherProfile,
    geminiApiKey,
    setGeminiApiKey,
    aiStatus,
    buildAiResumeContext,
  } = useAuth();
  const {
    applications,
    interviews,
    backendHealth,
    wsStatus,
    checkBackendHealth,
    importApplications,
    clearLocalWorkspace,
  } = useTracker();
  const { toast } = useToast();

  const [nameInput, setNameInput] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [skillsInput, setSkillsInput] = useState<string[]>(fresherProfile.skills || []);
  const [customSkill, setCustomSkill] = useState('');
  const [targetRolesInput, setTargetRolesInput] = useState(
    (fresherProfile.targetRoles || []).join(', ')
  );
  const [expYearsInput, setExpYearsInput] = useState(String(fresherProfile.experienceYears ?? 0));
  const [savingCareer, setSavingCareer] = useState(false);

  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedResumeFile, setSelectedResumeFile] = useState<{
    fileName: string;
    mimeType: string;
    base64Data: string;
  } | null>(null);
  const [pastedResumeText, setPastedResumeText] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState(geminiApiKey);
  const [buildingAiContext, setBuildingAiContext] = useState(false);
  const [aiBuildError, setAiBuildError] = useState<string | null>(null);
  const [showFullDigest, setShowFullDigest] = useState(false);

  useEffect(() => {
    setGeminiKeyInput(geminiApiKey);
  }, [geminiApiKey]);

  const inferResumeMimeType = (fileName: string, rawType: string) => {
    if (rawType && rawType !== 'application/octet-stream') return rawType;
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.doc')) return 'application/msword';
    if (lower.endsWith('.md')) return 'text/markdown';
    return 'text/plain';
  };

  const handleResumeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Upload a resume file smaller than 4.5 MB',
        variant: 'destructive',
      });
      return;
    }
    setAiBuildError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64Part = result.includes(',') ? result.split(',')[1] : result;
      setSelectedResumeFile({
        fileName: file.name,
        mimeType: inferResumeMimeType(file.name, file.type),
        base64Data: base64Part,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(geminiKeyInput);
    setAiBuildError(null);
    toast({
      title: geminiKeyInput.trim() ? 'Gemini API key saved in browser' : 'Personal Gemini key cleared',
    });
  };

  const handleBuildAiContext = async () => {
    if (!selectedResumeFile && !pastedResumeText.trim()) {
      toast({
        title: 'Resume required',
        description: 'Choose a PDF/DOCX/TXT file or paste your resume text first',
        variant: 'destructive',
      });
      return;
    }

    setBuildingAiContext(true);
    setAiBuildError(null);
    try {
      const res = await buildAiResumeContext({
        fileName: selectedResumeFile?.fileName || 'Pasted Resume',
        mimeType: selectedResumeFile?.mimeType,
        fileDataBase64: selectedResumeFile?.base64Data,
        resumeText: pastedResumeText.trim() || undefined,
        targetRolesHint: targetRolesInput.trim() || undefined,
      });

      if (res.success && res.resumeContext) {
        toast({
          title: 'AI resume context ready',
          description: `Indexed ${res.resumeContext.technicalSkills.length} skills and ${res.resumeContext.projects.length} projects from ${res.resumeContext.fileName}`,
        });
        setSelectedResumeFile(null);
        setPastedResumeText('');
        if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
      } else {
        const message = res.error || 'Failed to parse resume with Gemini AI.';
        setAiBuildError(message);
        toast({
          title: res.code === 'GEMINI_KEY_MISSING' ? 'Gemini API key needed' : 'Could not build context',
          description: message.length > 140 ? `${message.slice(0, 137)}...` : message,
          variant: 'destructive',
        });
      }
    } finally {
      setBuildingAiContext(false);
    }
  };

  useEffect(() => {
    setSkillsInput(fresherProfile.skills || []);
    setTargetRolesInput((fresherProfile.targetRoles || []).join(', '));
    setExpYearsInput(String(fresherProfile.experienceYears ?? 0));
  }, [fresherProfile]);

  const toggleSkillPreset = (skill: string) => {
    setSkillsInput((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === skill.toLowerCase());
      return exists ? prev.filter((s) => s.toLowerCase() !== skill.toLowerCase()) : [...prev, skill];
    });
  };

  const addCustomSkill = () => {
    const clean = customSkill.trim();
    if (!clean) return;
    if (!skillsInput.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSkillsInput((prev) => [...prev, clean]);
    }
    setCustomSkill('');
  };

  const handleSaveCareerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCareer(true);
    try {
      const parsedRoles = targetRolesInput
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const res = await saveFresherProfile({
        skills: skillsInput,
        targetRoles: parsedRoles,
        experienceYears: Number(expYearsInput) || 0,
      });
      toast({
        title: res.success ? 'Career profile saved' : 'Could not save career profile',
        description: res.success
          ? 'Job descriptions will now highlight matched & missing skills for you'
          : res.error,
        variant: res.success ? 'default' : 'destructive',
      });
    } finally {
      setSavingCareer(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [serverUrlInput, setServerUrlInput] = useState(backendUrl);
  const [testingHealth, setTestingHealth] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateProfile(nameInput);
      toast({
        title: res.success ? 'Profile updated' : 'Update failed',
        description: res.success ? 'Display name saved to account' : res.error,
        variant: res.success ? 'default' : 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const res = await updatePassword(currentPassword, newPassword);
      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        toast({ title: 'Password updated' });
      } else {
        toast({
          title: 'Could not update password',
          description: res.error,
          variant: 'destructive',
        });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveServerUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackendUrl(serverUrlInput);
    setTestingHealth(true);
    try {
      const result = await checkBackendHealth();
      toast({
        title: result.ok ? 'Backend reachable' : 'Backend offline',
        description: result.ok
          ? `Connected in ${result.latencyMs}ms`
          : 'Workspace remains usable with local browser storage',
      });
    } finally {
      setTestingHealth(false);
    }
  };

  const handleCopyKey = () => {
    if (!user?.apiKey) return;
    navigator.clipboard.writeText(user.apiKey);
    setCopied(true);
    toast({ title: 'API key copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('Revoke the current Chrome extension API key?')) return;
    setRegenerating(true);
    try {
      const next = await regenerateApiKey();
      if (next) {
        toast({ title: 'API key regenerated' });
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const appsToImport = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.applications)
        ? parsed.applications
        : [];
      const ivsToImport = Array.isArray(parsed?.interviews) ? parsed.interviews : [];
      const imported = await importApplications(appsToImport, ivsToImport);
      toast({
        title: 'Import complete',
        description: `Imported ${imported} new application${imported === 1 ? '' : 's'}`,
      });
    } catch {
      toast({
        title: 'Invalid backup file',
        description: 'Upload a valid JSON backup exported from ApplicationTracker',
        variant: 'destructive',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Permanently delete your account, applications, and interview schedule? This action cannot be undone.'
    );
    if (!confirmed) return;
    const res = await deleteAccount();
    if (res.success) {
      toast({ title: 'Account deleted' });
    } else {
      toast({
        title: 'Failed to delete account',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-[hsl(var(--ink-primary))]">
          Settings
        </h1>
        <p className="text-[14px] text-[hsl(var(--ink-secondary))] mt-1.5">
          Account credentials, extension API key, server target, and workspace backups
        </p>
      </div>

      {/* Account Section */}
      <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">Account</h2>
              <p className="text-[13px] text-[hsl(var(--ink-muted))]">
                {isAuthenticated && user
                  ? `Signed in as ${user.email}`
                  : 'Currently operating in unauthenticated local mode'}
              </p>
            </div>
          </div>

          {isAuthenticated && user ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={logout}
              className="h-8 px-3 rounded-[8px] border-[var(--hairline-strong)]"
            >
              Sign out
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setAuthModalOpen(true)}
              className="h-8 px-3.5 rounded-[8px] bg-[hsl(var(--ink-primary))] text-[hsl(var(--surface-card))]"
            >
              Sign in
            </Button>
          )}
        </div>

        {isAuthenticated && user && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <Label htmlFor="set-name" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Display name
                </Label>
                <Input
                  id="set-name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
              <Button
                type="submit"
                disabled={savingProfile}
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-[8px] border-[var(--hairline-strong)]"
              >
                {savingProfile ? 'Saving...' : 'Update name'}
              </Button>
            </form>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <Label htmlFor="set-cur-pw" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  Current password
                </Label>
                <Input
                  id="set-cur-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
              <div>
                <Label htmlFor="set-new-pw" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                  New password
                </Label>
                <Input
                  id="set-new-pw"
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1.5 h-9 rounded-[8px]"
                />
              </div>
              <Button
                type="submit"
                disabled={savingPassword}
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-[8px] border-[var(--hairline-strong)]"
              >
                {savingPassword ? 'Updating...' : 'Change password'}
              </Button>
            </form>
          </div>
        )}

        {isAuthenticated && user && (
          <div className="pt-4 border-t border-[var(--hairline)] space-y-2">
            <Label htmlFor="set-apikey" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
              Chrome extension API key
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="set-apikey"
                readOnly
                value={user.apiKey}
                className="font-mono-num text-[12px] h-9 bg-[hsl(var(--surface-raised))] rounded-[8px]"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyKey}
                  className="h-9 px-3 rounded-[8px] border-[var(--hairline-strong)]"
                >
                  {copied ? (
                    <Check className="w-4 h-4 mr-1.5 text-[hsl(var(--semantic-positive))]" strokeWidth={1.5} />
                  ) : (
                    <Copy className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRegenerateKey}
                  disabled={regenerating}
                  className="h-9 px-3 rounded-[8px] border-[var(--hairline-strong)]"
                >
                  <RefreshCw className={`w-4 h-4 mr-1.5 ${regenerating ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  Regenerate
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Career & Fresher Skills Profile + AI Resume Context */}
      <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center">
              <FileText className="w-4 h-4 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
                AI resume context &amp; skills baseline
              </h2>
              <p className="text-[13px] text-[hsl(var(--ink-muted))]">
                Upload your resume once so Gemini builds your full context for every job match and edit suggestion
              </p>
            </div>
          </div>

          <span className="text-[11px] font-mono-num px-2.5 py-1 rounded-[6px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] text-[hsl(var(--ink-secondary))]">
            {aiStatus.serverConfigured
              ? `Server AI ready (${aiStatus.model})`
              : geminiApiKey
                ? `Personal key active (${aiStatus.model})`
                : 'Add Gemini key below for AI parsing'}
          </span>
        </div>

        {/* Gemini Key Configuration */}
        <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] space-y-2.5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--ink-primary))]">
            <KeyRound className="w-4 h-4 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
            <span>Gemini API key</span>
          </div>
          <p className="text-[12px] text-[hsl(var(--ink-muted))]">
            {aiStatus.serverConfigured
              ? 'Server GEMINI_API_KEY is active. You can optionally override it with your own Google AI Studio key stored locally in this browser.'
              : 'Enter a Gemini API key from Google AI Studio (stored only in your browser localStorage) to parse PDF/DOCX resumes and generate tailored edits.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="set-gemini-key"
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="AIza..."
              className="h-9 rounded-[8px] font-mono-num text-[12px] bg-[hsl(var(--surface-card))]"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveGeminiKey}
              className="h-9 px-3.5 rounded-[8px] border-[var(--hairline-strong)] flex-shrink-0"
            >
              Save key
            </Button>
          </div>
        </div>

        {/* Resume Upload / Text Input */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label className="text-[13px] font-medium text-[hsl(var(--ink-primary))]">
                Parse resume into Master Context
              </Label>
              <p className="text-[12px] text-[hsl(var(--ink-muted))]">
                Accepts PDF, DOCX, TXT, or Markdown files (up to 4.5 MB), or paste raw resume text
              </p>
            </div>

            <input
              ref={resumeFileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleResumeFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => resumeFileInputRef.current?.click()}
              className="h-9 px-3.5 rounded-[8px] border-[var(--hairline-strong)]"
            >
              <Upload className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
              {selectedResumeFile ? selectedResumeFile.fileName : 'Choose resume file'}
            </Button>
          </div>

          <textarea
            id="set-resume-text"
            value={pastedResumeText}
            onChange={(e) => {
              setPastedResumeText(e.target.value);
              if (aiBuildError) setAiBuildError(null);
            }}
            rows={4}
            placeholder="Or paste full resume text here (education, projects, internships, tech stack, metrics)..."
            className="w-full px-3 py-2 text-[13px] border border-[var(--hairline-strong)] rounded-[8px] bg-[hsl(var(--surface-card))] resize-y"
          />

          {aiBuildError && (
            <div className="p-3 rounded-[8px] border border-[rgba(185,28,28,0.28)] bg-[hsl(var(--semantic-danger-bg))] text-[12px] text-[hsl(var(--semantic-danger))] break-words">
              {aiBuildError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-[hsl(var(--ink-muted))]">
              {selectedResumeFile
                ? `Ready to parse: ${selectedResumeFile.fileName}`
                : 'Full parsed text, projects, skills, and context digest will sync to your workspace.'}
            </span>
            <Button
              type="button"
              disabled={buildingAiContext || (!selectedResumeFile && !pastedResumeText.trim())}
              onClick={handleBuildAiContext}
              className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] text-[13px] font-medium"
            >
              {buildingAiContext ? 'Parsing resume with AI...' : 'Parse & build full AI context'}
            </Button>
          </div>
        </div>

        {/* Synthesized Master Context Preview */}
        {fresherProfile.resumeContext && (
          <div className="p-4 rounded-[10px] bg-[hsl(var(--surface-page))] border border-[var(--hairline)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--semantic-positive))]" strokeWidth={1.75} />
                <span className="text-[13px] font-medium text-[hsl(var(--ink-primary))]">
                  Active AI context: {fresherProfile.resumeContext.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullDigest((v) => !v)}
                  className="text-[12px] font-medium text-[hsl(var(--accent-ink))] hover:underline"
                >
                  {showFullDigest ? 'Hide AI digest' : 'Inspect full AI digest'}
                </button>
                <button
                  type="button"
                  onClick={() => saveFresherProfile({ resumeContext: null })}
                  className="text-[12px] text-[hsl(var(--ink-muted))] hover:text-[hsl(var(--semantic-danger))]"
                >
                  Clear
                </button>
              </div>
            </div>

            {fresherProfile.resumeContext.candidateSummary && (
              <p className="text-[13px] leading-relaxed text-[hsl(var(--ink-secondary))]">
                {fresherProfile.resumeContext.candidateSummary}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
              {fresherProfile.resumeContext.projects.length > 0 && (
                <div>
                  <div className="font-medium text-[hsl(var(--ink-primary))] mb-1">
                    Indexed projects ({fresherProfile.resumeContext.projects.length})
                  </div>
                  <ul className="space-y-1 text-[hsl(var(--ink-secondary))]">
                    {fresherProfile.resumeContext.projects.map((p) => (
                      <li key={p.name}>
                        <span className="font-medium text-[hsl(var(--ink-primary))]">{p.name}:</span>{' '}
                        {p.impactSummary}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(fresherProfile.resumeContext.strengths.length > 0 ||
                fresherProfile.resumeContext.gapsToWatch.length > 0) && (
                <div className="space-y-2">
                  {fresherProfile.resumeContext.strengths.length > 0 && (
                    <div>
                      <div className="font-medium text-[hsl(var(--ink-primary))] mb-1">Key strengths</div>
                      <ul className="space-y-0.5 text-[hsl(var(--ink-secondary))]">
                        {fresherProfile.resumeContext.strengths.slice(0, 3).map((s) => (
                          <li key={s}>- {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {fresherProfile.resumeContext.gapsToWatch.length > 0 && (
                    <div>
                      <div className="font-medium text-[hsl(var(--ink-primary))] mb-1">Gaps to address</div>
                      <ul className="space-y-0.5 text-[hsl(var(--ink-muted))]">
                        {fresherProfile.resumeContext.gapsToWatch.slice(0, 3).map((g) => (
                          <li key={g}>- {g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {showFullDigest && (
              <div className="pt-2 border-t border-[var(--hairline)] space-y-2 text-[12px]">
                <div className="font-medium text-[hsl(var(--ink-primary))]">
                  Master Context sent to Gemini when matching JDs
                </div>
                <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[hsl(var(--ink-secondary))] max-h-48 overflow-y-auto">
                  {fresherProfile.resumeContext.fullContextPrompt}
                </pre>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSaveCareerProfile} className="space-y-4 pt-2 border-t border-[var(--hairline)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="set-exp" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Experience level
              </Label>
              <div className="mt-1.5">
                <SelectField
                  id="set-exp"
                  value={expYearsInput}
                  onValueChange={setExpYearsInput}
                  className="w-full"
                  options={[
                    { value: '0', label: '0 yrs (Fresher / New grad)' },
                    { value: '0.5', label: '0.5 yrs (Internship experience)' },
                    { value: '1', label: '1 year' },
                    { value: '2', label: '2 years' },
                    { value: '3', label: '3+ years' },
                  ]}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="set-roles" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Target role titles
              </Label>
              <Input
                id="set-roles"
                value={targetRolesInput}
                onChange={(e) => setTargetRolesInput(e.target.value)}
                placeholder="Software Engineer, Backend Developer"
                className="mt-1.5 h-9 rounded-[8px]"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
                Skills on your resume ({skillsInput.length})
              </Label>
            </div>

            {skillsInput.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skillsInput.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkillPreset(skill)}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] bg-[var(--accent-tint)] border border-[rgba(27,74,214,0.2)] text-[12px] font-medium text-[hsl(var(--accent-ink))]"
                  >
                    <span>{skill}</span>
                    <X className="w-3 h-3" strokeWidth={1.75} />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 max-w-md">
              <Input
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSkill();
                  }
                }}
                placeholder="Add skill (e.g. Spring Boot, Docker)"
                className="h-9 rounded-[8px]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomSkill}
                className="h-9 px-3 rounded-[8px] border-[var(--hairline-strong)]"
              >
                <Plus className="w-4 h-4 mr-1" strokeWidth={1.5} />
                Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {FRESHER_SKILL_PRESETS.filter(
                (preset) => !skillsInput.some((s) => s.toLowerCase() === preset.toLowerCase())
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => toggleSkillPreset(preset)}
                  className="h-7 px-2.5 rounded-[6px] border border-[var(--hairline)] bg-[hsl(var(--surface-page))] hover:bg-[hsl(var(--surface-raised))] text-[12px] text-[hsl(var(--ink-secondary))] transition-ui"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1">
            <Button
              type="submit"
              disabled={savingCareer}
              className="h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] hover:bg-[hsl(0_0%_18%)] text-[hsl(var(--surface-card))] text-[13px] font-medium"
            >
              {savingCareer ? 'Saving...' : 'Save resume skills'}
            </Button>
          </div>
        </form>
      </section>

      {/* Server Connection */}
      <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[hsl(var(--surface-raised))] border border-[var(--hairline)] flex items-center justify-center">
              <Server className="w-4 h-4 text-[hsl(var(--ink-secondary))]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
                Backend endpoint
              </h2>
              <p className="text-[13px] font-mono-num text-[hsl(var(--ink-muted))]">
                {backendHealth.ok
                  ? `Healthy (${backendHealth.latencyMs}ms, WS ${wsStatus})`
                  : 'Offline — fallback to browser storage'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveServerUrl} className="space-y-3">
          <div>
            <Label htmlFor="set-backend" className="text-[13px] font-medium text-[hsl(var(--ink-secondary))]">
              Server URL
            </Label>
            <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
              <Input
                id="set-backend"
                type="url"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="http://localhost:3001"
                className="h-9 font-mono-num text-[13px] rounded-[8px]"
              />
              <Button
                type="submit"
                disabled={testingHealth}
                variant="outline"
                className="h-9 px-4 rounded-[8px] border-[var(--hairline-strong)] flex-shrink-0"
              >
                {testingHealth ? 'Checking...' : 'Save & test'}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => setServerUrlInput('http://localhost:3001')}
              className="text-[hsl(var(--accent-ink))] hover:underline font-mono-num"
            >
              Use http://localhost:3001
            </button>
          </div>
        </form>
      </section>

      {/* Data Portability */}
      <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 space-y-4">
        <div className="border-b border-[var(--hairline)] pb-4">
          <h2 className="text-[16px] font-medium text-[hsl(var(--ink-primary))]">
            Data &amp; backups
          </h2>
          <p className="text-[13px] text-[hsl(var(--ink-muted))] font-mono-num mt-0.5">
            {applications.length} applications, {interviews.length} interviews in current view
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={applications.length === 0}
            onClick={() => exportApplicationsToCsv(applications)}
            className="h-9 px-3.5 rounded-[8px] border-[var(--hairline-strong)]"
          >
            <Download className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
            Export CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => exportWorkspaceJson(applications, interviews)}
            className="h-9 px-3.5 rounded-[8px] border-[var(--hairline-strong)]"
          >
            <Download className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
            Backup JSON
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-9 px-3.5 rounded-[8px] border-[var(--hairline-strong)]"
          >
            <Upload className="w-4 h-4 mr-1.5 text-[hsl(var(--ink-muted))]" strokeWidth={1.5} />
            Import JSON
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (window.confirm('Clear locally cached applications and interviews from this browser?')) {
                clearLocalWorkspace();
              }
            }}
            className="h-9 px-3.5 rounded-[8px] text-[hsl(var(--semantic-danger))] hover:bg-[hsl(var(--semantic-danger-bg))] ml-auto"
          >
            <Trash2 className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
            Clear local cache
          </Button>
        </div>
      </section>

      {isAuthenticated && user && (
        <section className="bg-[hsl(var(--surface-card))] rounded-[12px] surface-hairline p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-medium text-[hsl(var(--ink-primary))]">
              Delete account
            </h2>
            <p className="text-[13px] text-[hsl(var(--ink-muted))] mt-0.5">
              Permanently remove your account profile and all synced MongoDB records
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDeleteAccount}
            className="h-9 px-4 rounded-[8px] border-[rgba(185,28,28,0.28)] text-[hsl(var(--semantic-danger))] hover:bg-[hsl(var(--semantic-danger-bg))]"
          >
            Delete account
          </Button>
        </section>
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};
