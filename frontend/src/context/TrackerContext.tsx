import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import {
  AiJobMatch,
  ApplicationStatus,
  BackendHealth,
  Interview,
  JobApplication,
} from '@/types/tracker';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export type SyncMode = 'synced' | 'local';
export type WsStatus = 'connected' | 'disconnected' | 'idle';

interface TrackerContextType {
  applications: JobApplication[];
  interviews: Interview[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  syncMode: SyncMode;
  wsStatus: WsStatus;
  backendHealth: BackendHealth;
  guestLocalCount: number;
  refreshData: () => Promise<void>;
  checkBackendHealth: () => Promise<BackendHealth>;
  syncGuestApplicationsToAccount: () => Promise<number>;
  createApplication: (
    data: Partial<JobApplication>,
    options?: { silent?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  updateApplication: (id: string, data: Partial<JobApplication>) => Promise<{ ok: boolean; error?: string }>;
  deleteApplication: (id: string) => Promise<{ ok: boolean; error?: string }>;
  importApplications: (items: JobApplication[], nextInterviews?: Interview[]) => Promise<number>;
  clearLocalWorkspace: () => void;
  createInterview: (data: Partial<Interview>) => Promise<{ ok: boolean; error?: string }>;
  updateInterview: (id: string, data: Partial<Interview>) => Promise<{ ok: boolean; error?: string }>;
  deleteInterview: (id: string) => Promise<{ ok: boolean; error?: string }>;
  runAiJobMatch: (
    app: Partial<JobApplication> & { id?: string }
  ) => Promise<{ ok: boolean; aiMatch?: AiJobMatch; error?: string; code?: string }>;
}

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

const GUEST_APPS_KEY = 'jobApplications';
const GUEST_INTERVIEWS_KEY = 'interviews';

function getAppsCacheKey(userId?: string | null) {
  return userId ? `at_apps_cache_${userId}` : GUEST_APPS_KEY;
}

function getInterviewsCacheKey(userId?: string | null) {
  return userId ? `at_interviews_cache_${userId}` : GUEST_INTERVIEWS_KEY;
}

function readJsonStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isAuthenticated, backendUrl, geminiApiKey, fresherProfile } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [syncMode, setSyncMode] = useState<SyncMode>('local');
  const [wsStatus, setWsStatus] = useState<WsStatus>('idle');
  const [backendHealth, setBackendHealth] = useState<BackendHealth>({ ok: false });
  const [guestLocalCount, setGuestLocalCount] = useState<number>(
    () =>
      readJsonStorage<JobApplication>(GUEST_APPS_KEY).length +
      readJsonStorage<Interview>(GUEST_INTERVIEWS_KEY).length
  );

  const wsRef = useRef<WebSocket | null>(null);
  const wsRetriesRef = useRef<number>(0);

  const authHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const recomputeGuestCount = useCallback(() => {
    const appCount = readJsonStorage<JobApplication>(GUEST_APPS_KEY).length;
    const ivCount = readJsonStorage<Interview>(GUEST_INTERVIEWS_KEY).length;
    setGuestLocalCount(appCount + ivCount);
  }, []);

  const checkBackendHealth = useCallback(async (): Promise<BackendHealth> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const start = performance.now();
    try {
      const res = await fetch(`${backendUrl}/health`, { signal: controller.signal });
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        const next: BackendHealth = {
          ok: true,
          latencyMs,
          database: data.database || 'MongoDB',
          checkedAt: new Date().toISOString(),
        };
        setBackendHealth(next);
        return next;
      }
      const fail: BackendHealth = { ok: false, latencyMs, checkedAt: new Date().toISOString() };
      setBackendHealth(fail);
      return fail;
    } catch {
      const fail: BackendHealth = { ok: false, checkedAt: new Date().toISOString() };
      setBackendHealth(fail);
      return fail;
    } finally {
      clearTimeout(timer);
    }
  }, [backendUrl]);

  const refreshData = useCallback(async () => {
    recomputeGuestCount();

    if (!isAuthenticated || !token) {
      setApplications(readJsonStorage<JobApplication>(GUEST_APPS_KEY));
      setInterviews(readJsonStorage<Interview>(GUEST_INTERVIEWS_KEY));
      setSyncMode('local');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const appsKey = getAppsCacheKey(user?.id);
    const interviewsKey = getInterviewsCacheKey(user?.id);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const [appsRes, ivRes] = await Promise.all([
        fetch(`${backendUrl}/api/applications`, { headers: authHeaders(), signal: controller.signal }),
        fetch(`${backendUrl}/api/interviews`, { headers: authHeaders(), signal: controller.signal }),
      ]);
      clearTimeout(timer);

      if (appsRes.ok) {
        const appsJson = await appsRes.json();
        const remoteApps = Array.isArray(appsJson.applications) ? appsJson.applications : [];
        setApplications(remoteApps);
        localStorage.setItem(appsKey, JSON.stringify(remoteApps));
        setSyncMode('synced');
        setBackendHealth((prev) => ({ ...prev, ok: true }));
      } else {
        setApplications(readJsonStorage<JobApplication>(appsKey));
        setSyncMode('local');
      }

      if (ivRes.ok) {
        const ivJson = await ivRes.json();
        const remoteIvs = Array.isArray(ivJson.interviews) ? ivJson.interviews : [];
        setInterviews(remoteIvs);
        localStorage.setItem(interviewsKey, JSON.stringify(remoteIvs));
      } else {
        setInterviews(readJsonStorage<Interview>(interviewsKey));
      }
    } catch {
      setApplications(readJsonStorage<JobApplication>(appsKey));
      setInterviews(readJsonStorage<Interview>(interviewsKey));
      setSyncMode('local');
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, backendUrl, isAuthenticated, recomputeGuestCount, token, user?.id]);

  useEffect(() => {
    checkBackendHealth();
    refreshData();
  }, [checkBackendHealth, refreshData]);

  useEffect(() => {
    const handleExtensionRefresh = () => {
      refreshData();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'JOB_APPLICATION_DATA' && event.data?.jobData) {
        if (!isAuthenticated) {
          const item = event.data.jobData as Partial<JobApplication>;
          if (item.company && item.position) {
            const existing = readJsonStorage<JobApplication>(GUEST_APPS_KEY);
            const dup = existing.some(
              (a) =>
                a.company.toLowerCase() === item.company!.toLowerCase() &&
                a.position.toLowerCase() === item.position!.toLowerCase()
            );
            if (!dup) {
              const newItem: JobApplication = {
                id: `ext_${Date.now()}`,
                company: item.company,
                position: item.position,
                location: item.location || '',
                salary: item.salary || '',
                jobUrl: item.jobUrl || '',
                applyUrl: item.applyUrl || '',
                companyUrl: item.companyUrl || '',
                companyLogo: item.companyLogo || '',
                verifiedJob: Boolean(item.verifiedJob),
                tags: Array.isArray(item.tags) ? item.tags : [],
                postedTime: item.postedTime || '',
                applicants: item.applicants || '',
                responseNote: item.responseNote || '',
                benefits: item.benefits || '',
                employeeGrowth: item.employeeGrowth || '',
                requirements: Array.isArray(item.requirements) ? item.requirements : [],
                description: item.description || '',
                status: (item.status as ApplicationStatus) || 'Applied',
                appliedDate: item.appliedDate || new Date().toISOString().split('T')[0],
                notes: item.notes || '',
                resumeVersion: item.resumeVersion || '',
                referralContact: item.referralContact || '',
                followUpDate: item.followUpDate || '',
                aiMatch: item.aiMatch || null,
              };
              const next = [newItem, ...existing];
              localStorage.setItem(GUEST_APPS_KEY, JSON.stringify(next));
              setApplications(next);
              recomputeGuestCount();
            }
          }
        } else {
          refreshData();
        }
      }
    };

    window.addEventListener('jobApplicationAdded', handleExtensionRefresh);
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('jobApplicationAdded', handleExtensionRefresh);
      window.removeEventListener('message', handleMessage);
    };
  }, [isAuthenticated, recomputeGuestCount, refreshData]);

  useEffect(() => {
    if (!isAuthenticated || !token || !backendHealth.ok) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsStatus('idle');
      return;
    }

    if (backendUrl.includes('vercel.app')) {
      setWsStatus('idle');
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      try {
        const parsed = new URL(backendUrl);
        const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${parsed.host}?token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            ws.close();
            return;
          }
          wsRetriesRef.current = 0;
          setWsStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            switch (payload.type) {
              case 'NEW_APPLICATION':
                if (payload.application) {
                  setApplications((prev) =>
                    prev.some((a) => a.id === payload.application.id)
                      ? prev
                      : [payload.application, ...prev]
                  );
                }
                break;
              case 'APPLICATION_UPDATED':
                if (payload.application) {
                  setApplications((prev) =>
                    prev.map((a) => (a.id === payload.application.id ? payload.application : a))
                  );
                }
                break;
              case 'APPLICATION_DELETED':
                if (payload.applicationId) {
                  setApplications((prev) => prev.filter((a) => a.id !== payload.applicationId));
                  setInterviews((prev) =>
                    prev.map((i) =>
                      i.applicationId === payload.applicationId ? { ...i, applicationId: '' } : i
                    )
                  );
                }
                break;
              case 'APPLICATIONS_SYNCED':
                if (Array.isArray(payload.applications)) {
                  setApplications(payload.applications);
                }
                break;
              case 'NEW_INTERVIEW':
                if (payload.interview) {
                  setInterviews((prev) =>
                    prev.some((i) => i.id === payload.interview.id)
                      ? prev
                      : [...prev, payload.interview]
                  );
                }
                break;
              case 'INTERVIEW_UPDATED':
                if (payload.interview) {
                  setInterviews((prev) =>
                    prev.map((i) => (i.id === payload.interview.id ? payload.interview : i))
                  );
                }
                break;
              case 'INTERVIEW_DELETED':
                if (payload.interviewId) {
                  setInterviews((prev) => prev.filter((i) => i.id !== payload.interviewId));
                }
                break;
              case 'INTERVIEWS_SYNCED':
                if (Array.isArray(payload.interviews)) {
                  setInterviews(payload.interviews);
                }
                break;
            }
          } catch {
            // Ignore malformed socket frames
          }
        };

        ws.onerror = () => {
          setWsStatus('disconnected');
        };

        ws.onclose = () => {
          setWsStatus('disconnected');
          if (!cancelled && wsRetriesRef.current < 3) {
            const delay = 5000 * Math.pow(2, wsRetriesRef.current);
            wsRetriesRef.current += 1;
            reconnectTimer = setTimeout(connect, delay);
          }
        };
      } catch {
        setWsStatus('disconnected');
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [backendHealth.ok, backendUrl, isAuthenticated, token]);

  const syncGuestApplicationsToAccount = useCallback(async (): Promise<number> => {
    if (!isAuthenticated || !token) return 0;
    const guestApps = readJsonStorage<JobApplication>(GUEST_APPS_KEY);
    const guestIvs = readJsonStorage<Interview>(GUEST_INTERVIEWS_KEY);
    if (guestApps.length === 0 && guestIvs.length === 0) return 0;

    let totalSynced = 0;

    try {
      if (guestApps.length > 0) {
        const res = await fetch(`${backendUrl}/api/applications/sync`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ frontendApplications: guestApps }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (Array.isArray(data.applications)) {
            setApplications(data.applications);
            localStorage.setItem(getAppsCacheKey(user?.id), JSON.stringify(data.applications));
          }
          localStorage.removeItem(GUEST_APPS_KEY);
          totalSynced += data.syncedCount || 0;
        }
      }

      if (guestIvs.length > 0) {
        const ivRes = await fetch(`${backendUrl}/api/interviews/sync`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ frontendInterviews: guestIvs }),
        });
        const ivData = await ivRes.json();
        if (ivRes.ok && ivData.success) {
          if (Array.isArray(ivData.interviews)) {
            setInterviews(ivData.interviews);
            localStorage.setItem(
              getInterviewsCacheKey(user?.id),
              JSON.stringify(ivData.interviews)
            );
          }
          localStorage.removeItem(GUEST_INTERVIEWS_KEY);
          totalSynced += ivData.syncedCount || 0;
        }
      }
    } finally {
      recomputeGuestCount();
    }

    return totalSynced;
  }, [authHeaders, backendUrl, isAuthenticated, recomputeGuestCount, token, user?.id]);

  const persistAppsCache = useCallback(
    (updater: JobApplication[] | ((prev: JobApplication[]) => JobApplication[])) => {
      setApplications((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem(getAppsCacheKey(user?.id), JSON.stringify(next));
        return next;
      });
      if (!user?.id) {
        setTimeout(recomputeGuestCount, 0);
      }
    },
    [recomputeGuestCount, user?.id]
  );

  const persistInterviewsCache = useCallback(
    (updater: Interview[] | ((prev: Interview[]) => Interview[])) => {
      setInterviews((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem(getInterviewsCacheKey(user?.id), JSON.stringify(next));
        return next;
      });
      if (!user?.id) {
        setTimeout(recomputeGuestCount, 0);
      }
    },
    [recomputeGuestCount, user?.id]
  );

  const createApplication = async (
    data: Partial<JobApplication>,
    options?: { silent?: boolean }
  ) => {
    const company = (data.company || '').trim();
    const position = (data.position || '').trim();
    if (!company || !position) {
      return { ok: false, error: 'Company and position are required' };
    }

    const payload = {
      company,
      position,
      location: (data.location || '').trim(),
      salary: (data.salary || '').trim(),
      jobUrl: (data.jobUrl || '').trim(),
      applyUrl: (data.applyUrl || '').trim(),
      companyUrl: (data.companyUrl || '').trim(),
      companyLogo: (data.companyLogo || '').trim(),
      verifiedJob: Boolean(data.verifiedJob),
      tags: Array.isArray(data.tags) ? data.tags : [],
      postedTime: (data.postedTime || '').trim(),
      applicants: (data.applicants || '').trim(),
      responseNote: (data.responseNote || '').trim(),
      benefits: (data.benefits || '').trim(),
      employeeGrowth: (data.employeeGrowth || '').trim(),
      requirements: Array.isArray(data.requirements) ? data.requirements : [],
      description: (data.description || '').trim(),
      status: (data.status as ApplicationStatus) || 'Applied',
      appliedDate: data.appliedDate || new Date().toISOString().split('T')[0],
      notes: (data.notes || '').trim(),
      resumeVersion: (data.resumeVersion || '').trim(),
      referralContact: (data.referralContact || '').trim(),
      followUpDate: (data.followUpDate || '').trim(),
      aiMatch: data.aiMatch || null,
    };

    if (isAuthenticated && token) {
      try {
        const res = await fetch(`${backendUrl}/api/applications`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (res.ok && json.data) {
          persistAppsCache((prev) =>
            prev.some((a) => a.id === json.data.id) ? prev : [json.data, ...prev]
          );
          if (!options?.silent) {
            toast({
              title: 'Application added',
              description: `${payload.position} at ${payload.company}`,
            });
          }
          return { ok: true };
        }
        if (res.status === 409) {
          if (!options?.silent) {
            toast({
              title: 'Duplicate application',
              description: 'This application is already in your tracker',
              variant: 'destructive',
            });
          }
          return { ok: false, error: json.error || 'Duplicate application' };
        }
        return { ok: false, error: json.error || 'Failed to save application' };
      } catch {
        // Fallback offline
      }
    }

    let duplicateFound = false;
    const localItem: JobApplication = {
      id: `local_${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    persistAppsCache((prev) => {
      duplicateFound = prev.some(
        (a) =>
          a.company.toLowerCase() === payload.company.toLowerCase() &&
          a.position.toLowerCase() === payload.position.toLowerCase() &&
          (a.jobUrl || '') === (payload.jobUrl || '')
      );
      return duplicateFound ? prev : [localItem, ...prev];
    });

    if (duplicateFound) {
      if (!options?.silent) {
        toast({
          title: 'Duplicate application',
          description: 'This application is already in your workspace',
          variant: 'destructive',
        });
      }
      return { ok: false, error: 'Duplicate application' };
    }

    if (!options?.silent) {
      toast({
        title: 'Application added',
        description: `${payload.position} at ${payload.company}`,
      });
    }
    return { ok: true };
  };

  const updateApplication = async (id: string, updates: Partial<JobApplication>) => {
    if (isAuthenticated && token) {
      try {
        const res = await fetch(`${backendUrl}/api/applications/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (res.ok && json.data) {
          persistAppsCache((prev) => prev.map((a) => (a.id === id ? json.data : a)));
          toast({ title: 'Application updated' });
          return { ok: true };
        }
        return { ok: false, error: json.error || 'Failed to update application' };
      } catch {
        // Fallback offline
      }
    }

    persistAppsCache((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a))
    );
    toast({ title: 'Application updated' });
    return { ok: true };
  };

  const deleteApplication = async (id: string) => {
    const deletedApp = applications.find((a) => a.id === id);

    const unlinkRelatedInterviews = () => {
      persistInterviewsCache((prev) =>
        prev.some((iv) => iv.applicationId === id)
          ? prev.map((iv) => (iv.applicationId === id ? { ...iv, applicationId: '' } : iv))
          : prev
      );
    };

    const showUndoToast = () => {
      if (!deletedApp) {
        toast({ title: 'Application deleted' });
        return;
      }
      let undone = false;
      toast({
        title: 'Application removed',
        description: `${deletedApp.position} at ${deletedApp.company}`,
        action: (
          <ToastAction
            altText="Undo delete"
            onClick={() => {
              if (undone) return;
              undone = true;
              createApplication(deletedApp, { silent: true }).then((res) => {
                if (res.ok) {
                  toast({ title: 'Application restored' });
                }
              });
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    };

    if (isAuthenticated && token) {
      try {
        const res = await fetch(`${backendUrl}/api/applications/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) {
          persistAppsCache((prev) => prev.filter((a) => a.id !== id));
          unlinkRelatedInterviews();
          showUndoToast();
          return { ok: true };
        }
      } catch {
        // Fallback offline
      }
    }

    persistAppsCache((prev) => prev.filter((a) => a.id !== id));
    unlinkRelatedInterviews();
    showUndoToast();
    return { ok: true };
  };

  const createInterview = async (data: Partial<Interview>) => {
    if (!data.company || !data.position || !data.date || !data.time) {
      return { ok: false, error: 'Company, position, date, and time are required' };
    }

    const payload = {
      applicationId: data.applicationId || '',
      company: data.company.trim(),
      position: data.position.trim(),
      date: data.date,
      time: data.time,
      type: data.type || 'Video Call',
      location: (data.location || '').trim(),
      meetingLink: (data.meetingLink || '').trim(),
      notes: (data.notes || '').trim(),
      interviewer: (data.interviewer || '').trim(),
      status: data.status || 'Scheduled',
    };

    const promoteLinkedApplication = async () => {
      if (!payload.applicationId || payload.status !== 'Scheduled') return;
      const linked = applications.find((a) => a.id === payload.applicationId);
      if (linked && (linked.status === 'Applied' || linked.status === 'Under Review')) {
        await updateApplication(linked.id, { status: 'Interview Scheduled' });
      }
    };

    if (isAuthenticated && token) {
      try {
        const res = await fetch(`${backendUrl}/api/interviews`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (res.ok && json.data) {
          persistInterviewsCache((prev) =>
            prev.some((i) => i.id === json.data.id) ? prev : [...prev, json.data]
          );
          await promoteLinkedApplication();
          toast({
            title: 'Interview scheduled',
            description: `${payload.position} at ${payload.company}`,
          });
          return { ok: true };
        }
        return { ok: false, error: json.error || 'Failed to schedule interview' };
      } catch {
        // Fallback offline
      }
    }

    const localIv: Interview = {
      id: `iv_${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistInterviewsCache((prev) => [...prev, localIv]);
    await promoteLinkedApplication();
    toast({
      title: 'Interview scheduled',
      description: `${payload.position} at ${payload.company}`,
    });
    return { ok: true };
  };

  const updateInterview = async (id: string, updates: Partial<Interview>) => {
    if (isAuthenticated && token) {
      try {
        const res = await fetch(`${backendUrl}/api/interviews/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(updates),
        });
        const json = await res.json();
        if (res.ok && json.data) {
          persistInterviewsCache((prev) => prev.map((i) => (i.id === id ? json.data : i)));
          toast({ title: 'Interview updated' });
          return { ok: true };
        }
        return { ok: false, error: json.error || 'Failed to update interview' };
      } catch {
        // Fallback offline
      }
    }

    persistInterviewsCache((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i))
    );
    toast({ title: 'Interview updated' });
    return { ok: true };
  };

  const deleteInterview = async (id: string) => {
    if (isAuthenticated && token) {
      try {
        const res = await fetch(`${backendUrl}/api/interviews/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) {
          persistInterviewsCache((prev) => prev.filter((i) => i.id !== id));
          toast({ title: 'Interview removed' });
          return { ok: true };
        }
      } catch {
        // Fallback offline
      }
    }

    persistInterviewsCache((prev) => prev.filter((i) => i.id !== id));
    toast({ title: 'Interview removed' });
    return { ok: true };
  };

  const importApplications = async (items: JobApplication[], nextInterviews?: Interview[]) => {
    let added = 0;
    const current = [...applications];
    for (const item of items) {
      if (!item?.company || !item?.position) continue;
      const dup = current.some(
        (c) =>
          c.company.toLowerCase() === item.company.toLowerCase() &&
          c.position.toLowerCase() === item.position.toLowerCase()
      );
      if (!dup) {
        current.unshift({
          ...item,
          id: item.id || `imp_${Date.now()}_${added}`,
          status: item.status || 'Applied',
          appliedDate: item.appliedDate || new Date().toISOString().split('T')[0],
        });
        added += 1;
      }
    }

    if (isAuthenticated && token) {
      try {
        const res = await fetch(`${backendUrl}/api/applications/sync`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ frontendApplications: items }),
        });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.applications)) {
          persistAppsCache(json.applications);
          added = json.syncedCount || added;
        } else {
          persistAppsCache(current);
        }

        if (Array.isArray(nextInterviews) && nextInterviews.length > 0) {
          const ivRes = await fetch(`${backendUrl}/api/interviews/sync`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ frontendInterviews: nextInterviews }),
          });
          const ivJson = await ivRes.json();
          if (ivRes.ok && ivJson.success && Array.isArray(ivJson.interviews)) {
            persistInterviewsCache(ivJson.interviews);
          }
        }
      } catch {
        persistAppsCache(current);
      }
    } else {
      persistAppsCache(current);
      if (Array.isArray(nextInterviews) && nextInterviews.length > 0) {
        const mergedIvs = [...interviews];
        for (const iv of nextInterviews) {
          if (!iv?.company || !iv?.date) continue;
          if (!mergedIvs.some((m) => m.id === iv.id)) {
            mergedIvs.push(iv);
          }
        }
        persistInterviewsCache(mergedIvs);
      }
    }

    return added;
  };

  const clearLocalWorkspace = () => {
    localStorage.removeItem(GUEST_APPS_KEY);
    localStorage.removeItem(GUEST_INTERVIEWS_KEY);
    if (!isAuthenticated) {
      setApplications([]);
      setInterviews([]);
    }
    setGuestLocalCount(0);
    toast({ title: 'Local workspace cache cleared' });
  };

  const runAiJobMatch = async (
    target: Partial<JobApplication> & { id?: string }
  ): Promise<{ ok: boolean; aiMatch?: AiJobMatch; error?: string; code?: string }> => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (geminiApiKey) headers['x-gemini-api-key'] = geminiApiKey;

      const isServerPersistedId =
        Boolean(target.id) &&
        !String(target.id).startsWith('local_') &&
        !String(target.id).startsWith('ext_');

      const res = await fetch(`${backendUrl}/api/ai/match-job`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          applicationId: isServerPersistedId ? target.id : undefined,
          company: target.company,
          position: target.position,
          location: target.location,
          salary: target.salary,
          jobUrl: target.jobUrl,
          applyUrl: target.applyUrl,
          requirements: target.requirements,
          description: target.description,
          resumeContext: fresherProfile.resumeContext || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          ok: false,
          code: json.code,
          error: json.error || 'Could not generate AI match analysis',
        };
      }

      if (target.id && json.aiMatch) {
        persistAppsCache((prev) =>
          prev.map((a) =>
            a.id === target.id
              ? json.application || { ...a, aiMatch: json.aiMatch, updatedAt: new Date().toISOString() }
              : a
          )
        );
      }

      return { ok: true, aiMatch: json.aiMatch };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to reach AI matching endpoint';
      return { ok: false, error: msg };
    }
  };

  return (
    <TrackerContext.Provider
      value={{
        applications,
        interviews,
        isLoading,
        searchQuery,
        setSearchQuery,
        syncMode,
        wsStatus,
        backendHealth,
        guestLocalCount,
        refreshData,
        checkBackendHealth,
        syncGuestApplicationsToAccount,
        createApplication,
        updateApplication,
        deleteApplication,
        importApplications,
        clearLocalWorkspace,
        createInterview,
        updateInterview,
        deleteInterview,
        runAiJobMatch,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
};

export const useTracker = () => {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error('useTracker must be used within an AuthProvider');
  }
  return context;
};
