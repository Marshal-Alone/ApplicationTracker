const DEFAULT_BACKEND_URL = 'http://localhost:3001';
const DEFAULT_WEB_URL = 'http://localhost:8081';

const ICONS = {
  briefcase:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  search:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  alert:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  check:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  save:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
};

document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('content');
  let isLoading = false;
  let capturedMetadata = {};
  let fresherProfile = { skills: [], experienceYears: 0, resumeContext: null };
  let currentAiMatch = null;

  initHeaderActions();
  initSettingsUI();
  updateHeaderKeyBadge();
  updateOfflineQueueBanner();
  refreshFresherProfile().finally(() => {
    autoLoadJobData();
  });

  function refreshFresherProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiKey', 'backendUrl', 'fresherProfile'], async (res) => {
        if (res.fresherProfile && Array.isArray(res.fresherProfile.skills)) {
          fresherProfile = res.fresherProfile;
        }
        const key = (res.apiKey || '').trim();
        const baseUrl = (res.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '');
        if (!key) {
          resolve();
          return;
        }
        try {
          const meRes = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { 'x-api-key': key },
          });
          if (meRes.ok) {
            const payload = await meRes.json();
            if (payload?.user) {
              fresherProfile = {
                skills: Array.isArray(payload.user.skills) ? payload.user.skills : [],
                experienceYears: Number(payload.user.experienceYears) || 0,
                resumeContext: payload.user.resumeContext || null,
              };
              chrome.storage.local.set({ fresherProfile });
            }
          }
        } catch {
          // Offline — keep cached profile
        }
        resolve();
      });
    });
  }

  const SKILL_PATTERNS = [
    ['JavaScript', /\bjavascript\b|\bes6\+?\b/i],
    ['TypeScript', /\btypescript\b/i],
    ['Java', /\bjava(?:\s*(?:8|11|17|21))?\b/i],
    ['Python', /\bpython\b/i],
    ['C++', /(?:^|[\s(/,])c\+\+(?:$|[\s),./])/i],
    ['React', /\breact(?:\.?js)?\b/i],
    ['Next.js', /\bnext\.?js\b/i],
    ['Node.js', /\bnode\.?js\b/i],
    ['Spring Boot', /\bspring\s*boot\b|\bspring\b/i],
    ['SQL', /\bsql\b|\bmysql\b|\bpostgres(?:ql)?\b/i],
    ['Oracle', /\boracle(?:\s*db)?\b/i],
    ['MongoDB', /\bmongo(?:db)?\b/i],
    ['Kafka', /\bkafka\b/i],
    ['Docker', /\bdocker\b|\bkubernetes\b/i],
    ['AWS', /\baws\b|\bgcp\b|\bazure\b/i],
    ['REST APIs', /\brest(?:ful)?\s*apis?\b|\brest\b/i],
    ['GraphQL', /\bgraphql\b/i],
    ['Git', /\bgit\b|\bci\/cd\b/i],
    ['Unit Testing', /\bunit testing\b|\bjunit\b|\bjest\b|\bpytest\b/i],
  ];

  function analyzeCapturedJob(jobData) {
    const reqText = Array.isArray(jobData.requirements) ? jobData.requirements.join('\n') : '';
    const combined = `${jobData.position || ''}\n${reqText}\n${jobData.description || ''}`;
    const userExp = Number(fresherProfile.experienceYears) || 0;
    const userSkills = Array.isArray(fresherProfile.skills) ? fresherProfile.skills : [];
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+.#]/g, '');
    const userSet = new Set(userSkills.map(norm).filter(Boolean));

    const detected = [];
    for (const [label, re] of SKILL_PATTERNS) {
      if (re.test(combined)) detected.push(label);
    }

    const matched = detected.filter((s) => userSet.has(norm(s)));
    const missing = detected.filter((s) => !userSet.has(norm(s)));

    let minYears = null;
    let maxYears = null;
    const expRegex =
      /(?:(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)|(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)|(?:minimum|at least)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?))/gi;
    const found = [];
    let m;
    while ((m = expRegex.exec(combined)) !== null) {
      const a = parseFloat(m[1] || m[3] || m[4]);
      const b = m[2] ? parseFloat(m[2]) : a;
      if (Number.isFinite(a) && a <= 12) found.push({ a, b });
    }
    if (found.length > 0) {
      found.sort((x, y) => x.a - y.a);
      minYears = found[0].a;
      maxYears = found[0].b;
    }

    let expTone = '';
    let expTitle = '';
    let expNote = '';
    if (minYears !== null) {
      const rangeStr = maxYears > minYears ? `${minYears}-${maxYears} yrs` : `${minYears}+ yrs`;
      if (minYears <= userExp + 0.5) {
        expTone = 'ok';
        expTitle = `Fresher compatible (${rangeStr})`;
        expNote = 'Experience requirement fits your profile. Include exact matching keywords.';
      } else if (minYears <= userExp + 2) {
        expTone = 'warn';
        expTitle = `Stretch role (${rangeStr} asked)`;
        expNote = 'Apply with quantified project bullets or an employee referral.';
      } else {
        expTone = 'warn';
        expTitle = `Experienced role (${rangeStr} required)`;
        expNote = 'Cold Easy Apply rarely clears YOE filters — try a referral or target 0-2 yr roles.';
      }
    } else if (/\b(fresher|entry[- ]?level|new grad|intern|trainee|junior)\b/i.test(combined)) {
      expTone = 'ok';
      expTitle = 'Entry-level / fresher signal';
      expNote = 'Tailor your 1-page resume with the stack below before applying.';
    }

    return { detected, matched, missing, hasProfile: userSkills.length > 0, expTone, expTitle, expNote };
  }

  function initHeaderActions() {
    const scanTabBtn = document.getElementById('scanTabBtn');
    const openAppBtn = document.getElementById('openAppBtn');
    const syncQueueBtn = document.getElementById('syncQueueBtn');

    scanTabBtn?.addEventListener('click', () => {
      chrome.storage.local.remove(['pendingJobData'], () => {
        extractFromCurrentPage(false);
      });
    });

    openAppBtn?.addEventListener('click', () => {
      chrome.storage.local.get(['webUrl'], (res) => {
        const target = (res.webUrl || DEFAULT_WEB_URL).trim();
        if (/^https?:\/\//i.test(target)) {
          chrome.tabs.create({ url: target });
        }
      });
    });

    syncQueueBtn?.addEventListener('click', () => {
      syncQueueBtn.textContent = 'Syncing...';
      chrome.runtime.sendMessage({ action: 'syncNow' }, (res) => {
        updateOfflineQueueBanner();
        if (res && res.synced > 0) {
          showStatus(`Synced ${res.synced} queued application(s).`, 'success');
        }
        syncQueueBtn.textContent = 'Sync now';
      });
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes.localApplications) updateOfflineQueueBanner();
      if (changes.apiKey) updateHeaderKeyBadge();
      if (changes.fresherProfile?.newValue) fresherProfile = changes.fresherProfile.newValue;
      if (changes.autoOpenPopup?.newValue && changes.pendingJobData?.newValue) {
        displayJobData(changes.pendingJobData.newValue);
        showStatus('Captured listing details from page Apply click.', 'success');
        chrome.storage.local.remove(['autoOpenPopup']);
      }
    });
  }

  function updateOfflineQueueBanner() {
    chrome.storage.local.get(['localApplications'], (res) => {
      const queue = res.localApplications || [];
      const banner = document.getElementById('queueBanner');
      const text = document.getElementById('queueText');
      if (!banner || !text) return;
      if (queue.length > 0) {
        banner.classList.remove('hidden');
        text.textContent = `${queue.length} queued offline`;
      } else {
        banner.classList.add('hidden');
      }
    });
  }

  function updateHeaderKeyBadge() {
    chrome.storage.local.get(['apiKey'], (res) => {
      const dot = document.getElementById('keyStatusDot');
      const label = document.getElementById('keyStatusText');
      if (!dot || !label) return;
      if (res.apiKey && res.apiKey.trim()) {
        dot.classList.add('ready');
        label.textContent = 'API key ready';
      } else {
        dot.classList.remove('ready');
        label.textContent = 'Local mode';
      }
    });
  }

  function initSettingsUI() {
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingApiKey = document.getElementById('settingApiKey');
    const settingBackendUrl = document.getElementById('settingBackendUrl');
    const settingWebUrl = document.getElementById('settingWebUrl');
    const settingGeminiKey = document.getElementById('settingGeminiKey');
    const selectorCacheInfo = document.getElementById('selectorCacheInfo');
    const clearSelectorCacheBtn = document.getElementById('clearSelectorCacheBtn');
    const testStatusEl = document.getElementById('settingsTestStatus');

    settingsBtn?.addEventListener('click', () => {
      chrome.storage.local.get(['apiKey', 'backendUrl', 'webUrl', 'geminiApiKey', 'domainSelectorCache'], (res) => {
        if (settingApiKey) settingApiKey.value = res.apiKey || '';
        if (settingBackendUrl) settingBackendUrl.value = res.backendUrl || DEFAULT_BACKEND_URL;
        if (settingWebUrl) settingWebUrl.value = res.webUrl || DEFAULT_WEB_URL;
        if (settingGeminiKey) settingGeminiKey.value = res.geminiApiKey || '';
        if (selectorCacheInfo) {
          const count = Object.keys(res.domainSelectorCache || {}).length;
          selectorCacheInfo.textContent = `${count} startup/ATS domain${count === 1 ? '' : 's'} cached`;
        }
        if (testStatusEl) testStatusEl.textContent = '';
        settingsModal?.classList.add('active');
      });
    });

    clearSelectorCacheBtn?.addEventListener('click', () => {
      chrome.storage.local.remove(['domainSelectorCache'], () => {
        if (selectorCacheInfo) selectorCacheInfo.textContent = '0 startup/ATS domains cached';
        if (testStatusEl) {
          testStatusEl.style.color = 'var(--ink-secondary)';
          testStatusEl.textContent = 'Cleared cached domain CSS selectors.';
        }
      });
    });

    closeSettingsBtn?.addEventListener('click', () => {
      settingsModal?.classList.remove('active');
    });

    testConnectionBtn?.addEventListener('click', async () => {
      const apiKey = settingApiKey ? settingApiKey.value.trim() : '';
      const baseUrl = (settingBackendUrl?.value.trim() || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
      if (!testStatusEl) return;

      testStatusEl.style.color = 'var(--ink-muted)';
      testStatusEl.textContent = 'Checking server & key...';

      try {
        const healthRes = await fetch(`${baseUrl}/health`);
        if (!healthRes.ok) {
          testStatusEl.style.color = 'var(--danger)';
          testStatusEl.textContent = `Server returned HTTP ${healthRes.status}.`;
          return;
        }
        if (!apiKey) {
          testStatusEl.style.color = 'var(--warn)';
          testStatusEl.textContent = 'Backend reachable. Add an API key to sync to an account.';
          return;
        }
        const meRes = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { 'x-api-key': apiKey },
        });
        if (meRes.ok) {
          const data = await meRes.json();
          testStatusEl.style.color = 'var(--positive)';
          testStatusEl.textContent = `Connected as ${data.user?.name || data.user?.email || 'authenticated user'}.`;
        } else {
          testStatusEl.style.color = 'var(--danger)';
          testStatusEl.textContent = 'Server healthy, but the API key is invalid or revoked.';
        }
      } catch {
        testStatusEl.style.color = 'var(--danger)';
        testStatusEl.textContent = 'Unable to reach backend server URL.';
      }
    });

    saveSettingsBtn?.addEventListener('click', () => {
      const apiKey = settingApiKey ? settingApiKey.value.trim() : '';
      const backendUrl =
        settingBackendUrl && settingBackendUrl.value.trim()
          ? settingBackendUrl.value.trim().replace(/\/+$/, '')
          : DEFAULT_BACKEND_URL;
      const webUrl =
        settingWebUrl && settingWebUrl.value.trim()
          ? settingWebUrl.value.trim().replace(/\/+$/, '')
          : DEFAULT_WEB_URL;
      const geminiApiKey = settingGeminiKey ? settingGeminiKey.value.trim() : '';

      chrome.storage.local.set({ apiKey, backendUrl, webUrl, geminiApiKey }, () => {
        updateHeaderKeyBadge();
        refreshFresherProfile();
        saveSettingsBtn.textContent = 'Saved';
        setTimeout(() => {
          saveSettingsBtn.textContent = 'Save settings';
          settingsModal?.classList.remove('active');
        }, 550);
      });
    });
  }

  function autoLoadJobData() {
    chrome.storage.local.get(['pendingJobData', 'autoOpenPopup'], (result) => {
      if (chrome.runtime.lastError) {
        showInitialState();
        return;
      }

      if (result.pendingJobData && (result.pendingJobData.company || result.pendingJobData.position)) {
        displayJobData(result.pendingJobData);
        if (result.autoOpenPopup) {
          showStatus('Captured full listing details & requirements.', 'success');
          chrome.storage.local.remove(['autoOpenPopup']);
        }
        return;
      }

      showInitialState();
    });
  }

  function showInitialState() {
    content.innerHTML = `
      <div class="empty-view">
        <div class="empty-icon">${ICONS.briefcase}</div>
        <h3>Ready to capture</h3>
        <p>Open any job posting (including LinkedIn expandable descriptions) to auto-expand requirements and capture all fields.</p>
        <button class="btn btn-primary" id="extractBtn">Extract job details</button>
      </div>
    `;
    document.getElementById('extractBtn')?.addEventListener('click', extractFromCurrentPage);
  }

  function extractFromCurrentPage(force = false) {
    const bypassSiteCheck = force === true;
    if (isLoading) return;
    setLoadingState(true);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs[0]?.url) {
        setLoadingState(false);
        showRetryInterface('Unable to inspect the current tab. Reload the page and retry.');
        return;
      }

      const currentTab = tabs[0];
      if (!/^https?:\/\//i.test(currentTab.url)) {
        setLoadingState(false);
        showRetryInterface('Open a company career page or job listing tab first.');
        return;
      }

      if (!bypassSiteCheck && !isJobSite(currentTab.url)) {
        setLoadingState(false);
        showNoJobSite();
        return;
      }

      chrome.scripting.executeScript(
        { target: { tabId: currentTab.id }, files: ['content.js'] },
        () => {
          if (chrome.runtime.lastError) {
            setLoadingState(false);
            showRetryInterface(
              'Unable to read page contents. Reload the tab and retry.',
              bypassSiteCheck
            );
            return;
          }

          setTimeout(() => {
            chrome.tabs.sendMessage(currentTab.id, { action: 'extractJobData' }, (response) => {
              setLoadingState(false);
              if (
                chrome.runtime.lastError ||
                !response?.jobData ||
                (!response.jobData.company && !response.jobData.position)
              ) {
                showRetryInterface(
                  'Could not detect fields automatically. Enter them manually.',
                  bypassSiteCheck
                );
                return;
              }

              if (!response.jobData.jobUrl) {
                response.jobData.jobUrl = currentTab.url;
              }

              chrome.storage.local.set({ pendingJobData: response.jobData });
              displayJobData(response.jobData);
            });
          }, 250);
        }
      );
    });
  }

  function isJobSite(url) {
    const knownHosts = [
      'linkedin.com/jobs',
      'internshala.com',
      'unstop.com',
      'naukri.com',
      'indeed.com',
      'glassdoor.com',
      'glassdoor.co.in',
      'foundit.in',
      'greenhouse.io',
      'lever.co',
      'myworkdayjobs.com',
      'ashbyhq.com',
      'smartrecruiters.com',
      'workable.com',
      'wellfound.com',
      'workatastartup.com',
      'rippling.com',
      'bamboohr.com',
      'recruitee.com',
      'breezy.hr',
      'icims.com',
      'dover.com',
    ];
    if (knownHosts.some((site) => url.includes(site))) {
      return true;
    }

    try {
      const parsed = new URL(url);
      if (/^(careers|career|jobs|hiring|talent)\./i.test(parsed.hostname)) {
        return true;
      }
      if (/\/(careers?|jobs?|openings?|positions?|roles?|work-with-us|join-us)(\/|$)/i.test(parsed.pathname)) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function setLoadingState(loading, heading = 'Expanding &amp; reading posting', subtitle = 'Capturing title, metadata, full description, and requirements.') {
    isLoading = loading;
    if (loading) {
      content.innerHTML = `
        <div class="empty-view">
          <div class="empty-icon"><div class="spinner"></div></div>
          <h3>${heading}</h3>
          <p>${subtitle}</p>
        </div>
      `;
    }
  }

  function saveDomainSelectorCache(hostname, selectors, notes) {
    const cleanHost = String(hostname || '').toLowerCase().trim();
    if (!cleanHost || !selectors || typeof selectors !== 'object') return Promise.resolve(0);
    const nonEmptyCount = Object.values(selectors).filter((v) => typeof v === 'string' && v.trim()).length;
    if (nonEmptyCount === 0) return Promise.resolve(0);

    return new Promise((resolve) => {
      chrome.storage.local.get(['domainSelectorCache'], (res) => {
        const cache = { ...(res.domainSelectorCache || {}) };
        cache[cleanHost] = {
          selectors,
          notes: String(notes || '').slice(0, 200),
          updatedAt: Date.now(),
        };
        const keys = Object.keys(cache);
        if (keys.length > 80) {
          keys
            .sort((a, b) => (cache[a]?.updatedAt || 0) - (cache[b]?.updatedAt || 0))
            .slice(0, keys.length - 80)
            .forEach((oldest) => delete cache[oldest]);
        }
        chrome.storage.local.set({ domainSelectorCache: cache }, () => resolve(nonEmptyCount));
      });
    });
  }

  function aiDiscoverAndExtract() {
    if (isLoading) return;
    setLoadingState(
      true,
      'Learning page structure with Gemini',
      'Inspecting stripped DOM layout and caching reusable selectors for this domain.'
    );

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs?.[0];
      if (!currentTab?.url || !/^https?:\/\//i.test(currentTab.url)) {
        setLoadingState(false);
        showRetryInterface('Open a live company career page or job posting first.', true);
        return;
      }

      chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['content.js'] }, () => {
        if (chrome.runtime.lastError) {
          setLoadingState(false);
          showRetryInterface('Unable to inspect page DOM. Reload the tab and retry.', true);
          return;
        }

        chrome.tabs.sendMessage(currentTab.id, { action: 'getDomSkeleton' }, (skeleton) => {
          if (chrome.runtime.lastError || !skeleton || skeleton.error) {
            setLoadingState(false);
            showRetryInterface('Could not capture stripped DOM from this tab.', true);
            return;
          }

          chrome.storage.local.get(['apiKey', 'backendUrl', 'geminiApiKey'], async (settings) => {
            const baseUrl = (settings.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '');
            const headers = { 'Content-Type': 'application/json' };
            if (settings.apiKey) headers['x-api-key'] = settings.apiKey.trim();
            if (settings.geminiApiKey) headers['x-gemini-api-key'] = settings.geminiApiKey.trim();

            try {
              const resp = await fetch(`${baseUrl}/api/ai/discover-selectors`, {
                method: 'POST',
                headers,
                body: JSON.stringify(skeleton),
              });
              const json = await resp.json().catch(() => ({}));

              if (!resp.ok || !json.success) {
                setLoadingState(false);
                showRetryInterface(
                  json.error || 'Gemini selector discovery failed. Check API key in Extension settings.',
                  true
                );
                return;
              }

              chrome.tabs.sendMessage(
                currentTab.id,
                {
                  action: 'applyDiscoveredSelectors',
                  selectors: json.selectors,
                  fallbackData: json.fallbackData,
                },
                async (applied) => {
                  setLoadingState(false);
                  if (chrome.runtime.lastError || !applied?.jobData) {
                    const fallbackJob = {
                      ...(json.fallbackData || {}),
                      jobUrl: currentTab.url,
                    };
                    displayJobData(fallbackJob);
                    showStatus('Applied AI fallback values from page text.', 'info');
                    return;
                  }

                  if (!applied.jobData.jobUrl) {
                    applied.jobData.jobUrl = currentTab.url;
                  }

                  const cachedCount = await saveDomainSelectorCache(
                    skeleton.hostname,
                    json.selectors,
                    json.notes
                  );
                  chrome.storage.local.set({ pendingJobData: applied.jobData });
                  displayJobData(applied.jobData);

                  if (cachedCount > 0 && applied.matchedSelectorCount > 0) {
                    showStatus(
                      `Cached ${cachedCount} selectors for ${skeleton.hostname} & extracted role.`,
                      'success'
                    );
                  } else {
                    showStatus('Extracted fields via Gemini AI page analysis.', 'success');
                  }
                }
              );
            } catch {
              setLoadingState(false);
              showRetryInterface('Unable to reach backend /api/ai/discover-selectors endpoint.', true);
            }
          });
        });
      });
    });
  }

  function showNoJobSite() {
    content.innerHTML = `
      <div class="empty-view">
        <div class="empty-icon">${ICONS.search}</div>
        <h3>Open a job listing</h3>
        <p>Visit a job board, ATS portal, or company career page — or use Extract anyway / AI detect on custom startup sites.</p>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
          <button class="btn btn-secondary" id="manualEntryBtn">Manual</button>
          <button class="btn btn-secondary" id="manualExtractBtn">Extract anyway</button>
          <button class="btn btn-primary" id="aiDetectBtn">AI detect</button>
        </div>
      </div>
    `;
    document.getElementById('manualExtractBtn')?.addEventListener('click', () => extractFromCurrentPage(true));
    document.getElementById('aiDetectBtn')?.addEventListener('click', aiDiscoverAndExtract);
    document.getElementById('manualEntryBtn')?.addEventListener('click', openBlankForm);
  }

  function openBlankForm() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      displayJobData({
        company: '',
        position: '',
        location: '',
        salary: '',
        jobUrl: tabs[0]?.url || '',
        description: '',
        requirements: [],
      });
    });
  }

  function showRetryInterface(message, bypassSiteCheck = false) {
    content.innerHTML = `
      <div class="empty-view">
        <div class="empty-icon">${ICONS.alert}</div>
        <h3>Extraction incomplete</h3>
        <p>${escapeHtml(message)}</p>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
          <button class="btn btn-secondary" id="retryBtn">Retry</button>
          <button class="btn btn-secondary" id="retryAiBtn">AI detect</button>
          <button class="btn btn-primary" id="manualAddBtn">Manual</button>
        </div>
      </div>
    `;
    document.getElementById('retryBtn')?.addEventListener('click', () => extractFromCurrentPage(bypassSiteCheck));
    document.getElementById('retryAiBtn')?.addEventListener('click', aiDiscoverAndExtract);
    document.getElementById('manualAddBtn')?.addEventListener('click', openBlankForm);
  }

  function displayJobData(jobData) {
    capturedMetadata = {
      companyUrl: jobData.companyUrl || '',
      companyLogo: jobData.companyLogo || '',
      verifiedJob: Boolean(jobData.verifiedJob),
      requirements: Array.isArray(jobData.requirements) ? jobData.requirements : [],
    };
    currentAiMatch = jobData.aiMatch || null;

    function renderAiResultMarkup(match) {
      if (!match) return '';
      const edits = Array.isArray(match.resumeEdits) ? match.resumeEdits.slice(0, 3) : [];
      const missing = Array.isArray(match.missingKeywords) ? match.missingKeywords.slice(0, 6) : [];
      return `
        <div class="fresher-title">${escapeHtml(match.overallVerdict || 'AI match summary')}</div>
        ${match.fitSummary ? `<div class="fresher-sub">${escapeHtml(match.fitSummary)}</div>` : ''}
        ${
          missing.length > 0
            ? `<div class="fresher-sub"><strong>Missing:</strong> ${escapeHtml(missing.join(', '))}</div>`
            : ''
        }
        ${edits
          .map(
            (e) =>
              `<div class="ai-edit-item"><strong>${escapeHtml(e.section)}:</strong> ${escapeHtml(e.suggestedChange)}</div>`
          )
          .join('')}
      `;
    }

    const aiPanelHtml = fresherProfile.resumeContext
      ? `
      <div class="fresher-panel" id="aiMatchPanel">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span class="fresher-title">AI resume match (${escapeHtml(fresherProfile.resumeContext.fileName || 'Master context')})</span>
          <button type="button" class="ai-inline-btn" id="runAiMatchBtn">${currentAiMatch ? 'Re-analyze' : 'Analyze fit'}</button>
        </div>
        <div id="aiMatchBody">${currentAiMatch ? renderAiResultMarkup(currentAiMatch) : '<div class="fresher-sub">Check full-context fit and suggested resume edits before saving.</div>'}</div>
      </div>`
      : `
      <div class="fresher-panel">
        <div class="fresher-sub">Upload your resume in web app Settings to unlock full-context AI fit &amp; suggested edits here.</div>
      </div>`;

    const insights = analyzeCapturedJob(jobData);
    let insightHtml = '';
    if (insights.expTitle || insights.detected.length > 0) {
      const skillLines = [];
      if (insights.hasProfile) {
        skillLines.push(
          insights.matched.length > 0
            ? `Matched: ${escapeHtml(insights.matched.slice(0, 5).join(', '))}`
            : 'No matching profile skills yet'
        );
        if (insights.missing.length > 0) {
          skillLines.push(`Missing from resume: ${escapeHtml(insights.missing.slice(0, 5).join(', '))}`);
        }
      } else if (insights.detected.length > 0) {
        skillLines.push(
          `Stack detected: ${escapeHtml(insights.detected.slice(0, 6).join(', '))} (add your skills in Settings to see gaps)`
        );
      }

      insightHtml = `
      <div class="fresher-panel ${insights.expTone}">
        ${insights.expTitle ? `<div class="fresher-title">${escapeHtml(insights.expTitle)}</div>` : ''}
        ${insights.expNote ? `<div class="fresher-sub">${escapeHtml(insights.expNote)}</div>` : ''}
        ${skillLines.map((line) => `<div class="fresher-sub">${line}</div>`).join('')}
      </div>`;
    }

    const reqHtml =
      capturedMetadata.requirements.length > 0
        ? `
      <div class="form-group">
        <label>
          <span>Extracted requirements</span>
          <span style="font-size: 11px; color: var(--ink-muted);">${capturedMetadata.requirements.length} items</span>
        </label>
        <div class="req-preview">
          <ul>
            ${capturedMetadata.requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </div>
      </div>`
        : '';

    content.innerHTML = `
      <div class="hint-bar">
        <span>${jobData.usedCachedSelectors ? 'Extracted via domain selector cache.' : 'Review captured fields before saving.'}</span>
        <button type="button" class="ai-inline-btn" id="aiFormDetectBtn" title="Ask Gemini AI to detect selectors for this domain">AI detect</button>
      </div>
      <div class="job-form">
        ${insightHtml}
        ${aiPanelHtml}
        <div class="form-row">
          <div class="form-group">
            <label for="company">Company *</label>
            <input type="text" id="company" value="${escapeHtml(jobData.company || '')}" placeholder="Acme Corp" />
          </div>
          <div class="form-group">
            <label for="position">Position *</label>
            <input type="text" id="position" value="${escapeHtml(jobData.position || '')}" placeholder="Software Engineer" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="location">Location</label>
            <input type="text" id="location" value="${escapeHtml(jobData.location || '')}" placeholder="Remote" />
          </div>
          <div class="form-group">
            <label for="salary">Compensation</label>
            <input type="text" id="salary" value="${escapeHtml(jobData.salary || '')}" placeholder="Salary or stipend" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="statusSelect">Initial stage</label>
            <select id="statusSelect">
              <option value="Applied" selected>Applied</option>
              <option value="Under Review">Under Review</option>
              <option value="Interview Scheduled">Interview Scheduled</option>
            </select>
          </div>
          <div class="form-group">
            <label for="resumeVersion">Resume version</label>
            <input type="text" id="resumeVersion" value="${escapeHtml(jobData.resumeVersion || '')}" placeholder="Resume_SDE_v1.pdf" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="jobUrl">Posting URL</label>
            <input type="text" id="jobUrl" value="${escapeHtml(jobData.jobUrl || '')}" placeholder="https://..." />
          </div>
          <div class="form-group">
            <label for="applyUrl">Apply / ATS URL</label>
            <input type="text" id="applyUrl" value="${escapeHtml(jobData.applyUrl || '')}" placeholder="External ATS link" />
          </div>
        </div>
        ${reqHtml}
        <div class="form-group">
          <label for="description">Full description</label>
          <textarea id="description" placeholder="Role summary and details">${escapeHtml(jobData.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label for="notes">Notes</label>
          <input type="text" id="notes" value="${escapeHtml(jobData.notes || '')}" placeholder="Referral or follow-up reminder" />
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" id="extractNewBtn" style="flex: 1;">Re-extract</button>
        <button class="btn btn-primary" id="saveBtn" style="flex: 1.5;">Save application</button>
      </div>
      <div id="status"></div>
    `;

    document.getElementById('saveBtn')?.addEventListener('click', saveJobData);
    document.getElementById('aiFormDetectBtn')?.addEventListener('click', aiDiscoverAndExtract);
    document.getElementById('extractNewBtn')?.addEventListener('click', () => {
      chrome.storage.local.remove(['pendingJobData']);
      extractFromCurrentPage(true);
    });
    document.getElementById('runAiMatchBtn')?.addEventListener('click', () => {
      const btn = document.getElementById('runAiMatchBtn');
      const body = document.getElementById('aiMatchBody');
      if (!btn || !body || btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'Analyzing...';
      body.innerHTML = '<div class="fresher-sub">Comparing posting against your Master Resume Context...</div>';

      chrome.storage.local.get(['apiKey', 'backendUrl', 'geminiApiKey'], async (settings) => {
        const baseUrl = (settings.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '');
        const headers = { 'Content-Type': 'application/json' };
        if (settings.apiKey) headers['x-api-key'] = settings.apiKey.trim();
        if (settings.geminiApiKey) headers['x-gemini-api-key'] = settings.geminiApiKey.trim();

        try {
          const resp = await fetch(`${baseUrl}/api/ai/match-job`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              company: document.getElementById('company')?.value.trim() || '',
              position: document.getElementById('position')?.value.trim() || '',
              location: document.getElementById('location')?.value.trim() || '',
              salary: document.getElementById('salary')?.value.trim() || '',
              jobUrl: document.getElementById('jobUrl')?.value.trim() || '',
              applyUrl: document.getElementById('applyUrl')?.value.trim() || '',
              requirements: capturedMetadata.requirements || [],
              description: document.getElementById('description')?.value.trim() || '',
              resumeContext: fresherProfile.resumeContext,
            }),
          });
          const json = await resp.json();
          if (resp.ok && json.aiMatch) {
            currentAiMatch = json.aiMatch;
            body.innerHTML = renderAiResultMarkup(currentAiMatch);
            btn.textContent = 'Re-analyze';
          } else {
            body.innerHTML = `<div class="fresher-sub" style="color: var(--danger);">${escapeHtml(json.error || 'Could not run AI match.')}</div>`;
            btn.textContent = 'Analyze fit';
          }
        } catch {
          body.innerHTML = '<div class="fresher-sub" style="color: var(--danger);">Unable to reach AI matching endpoint.</div>';
          btn.textContent = 'Analyze fit';
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function saveJobData() {
    const saveBtn = document.getElementById('saveBtn');
    if (!saveBtn || saveBtn.disabled) return;

    const jobData = {
      company: document.getElementById('company')?.value.trim() || '',
      position: document.getElementById('position')?.value.trim() || '',
      location: document.getElementById('location')?.value.trim() || '',
      salary: document.getElementById('salary')?.value.trim() || '',
      status: document.getElementById('statusSelect')?.value || 'Applied',
      resumeVersion: document.getElementById('resumeVersion')?.value.trim() || '',
      jobUrl: document.getElementById('jobUrl')?.value.trim() || '',
      applyUrl: document.getElementById('applyUrl')?.value.trim() || '',
      description: document.getElementById('description')?.value.trim() || '',
      notes: document.getElementById('notes')?.value.trim() || '',
      appliedDate: new Date().toISOString().split('T')[0],
      ...capturedMetadata,
      ...(currentAiMatch ? { aiMatch: currentAiMatch } : {}),
    };

    if (!jobData.company || !jobData.position) {
      showStatus('Company and Position are required.', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    chrome.storage.local.get(['apiKey', 'backendUrl'], (settings) => {
      const baseUrl = (settings.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '');
      const apiUrl = `${baseUrl}/api/applications`;
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (settings.apiKey) {
        headers['x-api-key'] = settings.apiKey.trim();
      }

      fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(jobData),
      })
        .then(async (response) => {
          if (response.ok) {
            const created = await response.json().catch(() => ({}));
            chrome.storage.local.remove(['pendingJobData']);
            chrome.runtime.sendMessage({
              action: 'notifyTabs',
              jobData: created.data || jobData,
            });
            showSuccessState();
            return;
          }
          if (response.status === 409) throw new Error('DUPLICATE');
          if (response.status === 401) throw new Error('UNAUTHORIZED');
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${response.status}`);
        })
        .catch((error) => {
          if (error.message === 'DUPLICATE') {
            showStatus('This role is already in your tracker.', 'error');
            resetSaveButton();
          } else if (error.message === 'UNAUTHORIZED') {
            showStatus('Set your personal API key in Extension settings.', 'error');
            resetSaveButton();
          } else if (
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError')
          ) {
            saveToLocalStorage(jobData);
          } else {
            showStatus(error.message || 'Could not save application.', 'error');
            resetSaveButton();
          }
        });
    });
  }

  function saveToLocalStorage(jobData) {
    const localApplication = {
      id: `local_${Date.now()}`,
      ...jobData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    chrome.storage.local.get(['localApplications'], (result) => {
      const existing = result.localApplications || [];
      const dup = existing.some(
        (a) =>
          a.company.toLowerCase() === localApplication.company.toLowerCase() &&
          a.position.toLowerCase() === localApplication.position.toLowerCase()
      );
      if (dup) {
        showStatus('Already queued in extension storage.', 'error');
        resetSaveButton();
        return;
      }

      existing.unshift(localApplication);
      chrome.storage.local.set({ localApplications: existing, pendingJobData: null }, () => {
        updateOfflineQueueBanner();
        showLocalStorageSuccessState(existing.length);
      });
    });
  }

  function showSuccessState() {
    content.innerHTML = `
      <div class="empty-view">
        <div class="empty-icon" style="color: var(--positive);">${ICONS.check}</div>
        <h3>Application saved</h3>
        <p>Synced to your ApplicationTracker workspace with full description &amp; requirements.</p>
        <button class="btn btn-primary" id="newExtractBtn">Capture another role</button>
      </div>
    `;
    document.getElementById('newExtractBtn')?.addEventListener('click', extractFromCurrentPage);
  }

  function showLocalStorageSuccessState(queueCount) {
    content.innerHTML = `
      <div class="empty-view">
        <div class="empty-icon">${ICONS.save}</div>
        <h3>Queued offline</h3>
        <p>Server unreachable. ${queueCount} queued role${
      queueCount === 1 ? '' : 's'
    } will sync automatically once connected.</p>
        <button class="btn btn-primary" id="newExtractBtn">Capture another role</button>
      </div>
    `;
    document.getElementById('newExtractBtn')?.addEventListener('click', extractFromCurrentPage);
  }

  function resetSaveButton() {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save application';
    }
  }

  function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    statusDiv.innerHTML = `<div class="status status-${type}">${escapeHtml(message)}</div>`;
    if (type !== 'error') {
      setTimeout(() => {
        statusDiv.innerHTML = '';
      }, 4500);
    }
  }
});
