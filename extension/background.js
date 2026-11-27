const DEFAULT_BACKEND_URL = 'http://localhost:3001';
const SYNC_ALARM_NAME = 'applicationtracker-local-sync';

function registerSyncAlarm() {
  if (chrome.alarms) {
    chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 5 });
  }
}

function configureSidePanelBehavior() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
  }
}

configureSidePanelBehavior();

chrome.action?.onClicked?.addListener(async (tab) => {
  if (chrome.sidePanel?.open && tab?.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch {
      // Ignore if sidePanel already open or unsupported
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  registerSyncAlarm();
  configureSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  registerSyncAlarm();
  configureSidePanelBehavior();
});

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== SYNC_ALARM_NAME) return;
    try {
      const result = await chrome.storage.local.get(['localApplications']);
      const localApplications = result.localApplications || [];
      if (localApplications.length > 0) {
        await syncLocalApplications(localApplications);
      }
    } catch (error) {
      console.error('Error during periodic sync:', error);
    }
  });
}

async function getApiConfig() {
  const settings = await chrome.storage.local.get(['apiKey', 'backendUrl']);
  const baseUrl = (settings.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/api/applications`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (settings.apiKey) {
    headers['x-api-key'] = settings.apiKey.trim();
  }
  return { baseUrl, apiUrl, headers, hasApiKey: !!settings.apiKey };
}

async function syncLocalApplications(localApplications) {
  const { apiUrl, headers, hasApiKey } = await getApiConfig();
  if (!hasApiKey) return { synced: 0, remaining: localApplications.length };

  const syncedIds = [];
  for (const app of localApplications) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(app),
      });
      if (response.ok || response.status === 409) {
        syncedIds.push(app.id);
      }
    } catch {
      // Keep unsynced for next pass
    }
  }

  const remainingApplications = localApplications.filter((app) => !syncedIds.includes(app.id));
  if (syncedIds.length > 0) {
    await chrome.storage.local.set({ localApplications: remainingApplications });
  }

  return { synced: syncedIds.length, remaining: remainingApplications.length };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'saveJobData') {
    handleSaveJobData(request.jobData, sendResponse);
    return true;
  }

  if (request.action === 'notifyTabs') {
    notifyJobTrackerTabs(request.jobData)
      .then((notified) => sendResponse({ success: notified }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (request.action === 'syncNow') {
    chrome.storage.local.get(['localApplications'], async (res) => {
      const result = await syncLocalApplications(res.localApplications || []);
      if (result.synced > 0) {
        await notifyJobTrackerTabs({ synced: true });
      }
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'openPopup') {
    if (chrome.sidePanel?.open && _sender?.tab?.windowId) {
      chrome.sidePanel.open({ windowId: _sender.tab.windowId }).catch(() => undefined);
    } else if (chrome.action && chrome.action.openPopup) {
      chrome.action.openPopup().catch(() => undefined);
    }
    sendResponse({ success: true });
    return true;
  }

  return false;
});

async function handleSaveJobData(jobData, sendResponse) {
  try {
    const { apiUrl, headers } = await getApiConfig();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(jobData),
    });

    if (response.ok) {
      const data = await response.json();
      await notifyJobTrackerTabs(data.data || jobData);
      sendResponse({ success: true, data });
      return;
    }

    const errorBody = await response.json().catch(() => ({}));
    sendResponse({
      success: false,
      status: response.status,
      error: errorBody.error || `HTTP ${response.status}`,
    });
  } catch (error) {
    const tabsNotified = await notifyJobTrackerTabs(jobData);
    if (tabsNotified) {
      sendResponse({ success: true, message: 'Delivered to open web workspace' });
    } else {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unable to reach server',
      });
    }
  }
}

async function notifyJobTrackerTabs(jobData) {
  try {
    const tabs = await chrome.tabs.query({});
    let notified = false;

    for (const tab of tabs) {
      if (!tab.url || !tab.id) continue;
      const isAppTab =
        tab.url.includes('localhost:8080') ||
        tab.url.includes('localhost:8081') ||
        tab.url.includes('localhost:5173') ||
        tab.url.includes('127.0.0.1:') ||
        tab.url.includes('vercel.app');

      if (!isAppTab) continue;

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (data) => {
            window.postMessage(
              {
                type: 'JOB_APPLICATION_DATA',
                jobData: data,
              },
              '*'
            );
            window.dispatchEvent(
              new CustomEvent('jobApplicationAdded', {
                detail: { timestamp: Date.now(), jobData: data },
              })
            );
          },
          args: [jobData],
        });
        notified = true;
      } catch {
        // Ignore restricted tabs
      }
    }

    return notified;
  } catch {
    return false;
  }
}
