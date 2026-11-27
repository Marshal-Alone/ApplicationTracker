// Content script to extract job details across job boards
if (typeof window.jobTrackerLoaded === 'undefined') {
  window.jobTrackerLoaded = true;

  let isExtracting = false;

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'extractJobData') {
      if (isExtracting) {
        sendResponse({ error: 'Already extracting data' });
        return false;
      }

      isExtracting = true;
      showExtractionLoader();

      extractJobData()
        .then((jobData) => {
          hideExtractionLoader();
          isExtracting = false;
          chrome.storage.local.set({ pendingJobData: jobData }, () => {
            sendResponse({ jobData });
          });
        })
        .catch((error) => {
          console.error('Extraction error:', error);
          hideExtractionLoader();
          isExtracting = false;
          sendResponse({ error: 'Extraction failed' });
        });

      return true;
    }

    if (request.action === 'getDomSkeleton') {
      try {
        const skeletonPayload = buildDomSkeletonPayload();
        sendResponse(skeletonPayload);
      } catch (err) {
        console.error('DOM skeleton error:', err);
        sendResponse({ error: 'Failed to read page DOM structure' });
      }
      return false;
    }

    if (request.action === 'applyDiscoveredSelectors') {
      (async () => {
        const baseline = await extractJobData();
        const fromSelectors = extractUsingSelectors(request.selectors || {});
        const fromFallback = cleanFallbackJobData(request.fallbackData || {});
        const merged = mergeJobFields(baseline, fromFallback, fromSelectors);
        merged.jobUrl = merged.jobUrl || window.location.href;
        merged.extractedAt = new Date().toISOString();
        if (merged.description && (!Array.isArray(merged.requirements) || merged.requirements.length === 0)) {
          merged.requirements = extractRequirementsFromText(merged.description);
        }
        chrome.storage.local.set({ pendingJobData: merged }, () => {
          sendResponse({
            jobData: merged,
            matchedSelectorCount: fromSelectors.__matchedCount || 0,
          });
        });
      })().catch((err) => {
        console.error('Apply selectors error:', err);
        sendResponse({ error: 'Failed to apply discovered selectors' });
      });
      return true;
    }

    return false;
  });

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showExtractionLoader() {
    if (document.getElementById('jobtracker-extraction-loader')) return;
    const loader = document.createElement('div');
    loader.id = 'jobtracker-extraction-loader';
    loader.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #171717;
      color: #fafafa;
      border: 1px solid rgba(255,255,255,0.14);
      padding: 10px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    loader.innerHTML = `
      <div style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.28); border-radius: 50%; border-top-color: #ffffff; animation: jtSpin 0.9s linear infinite;"></div>
      Expanding &amp; capturing job details...
    `;

    if (!document.querySelector('#jobtracker-spinner-style')) {
      const style = document.createElement('style');
      style.id = 'jobtracker-spinner-style';
      style.textContent = '@keyframes jtSpin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }

    document.body.appendChild(loader);
  }

  function hideExtractionLoader() {
    const loader = document.getElementById('jobtracker-extraction-loader');
    if (loader) loader.remove();
  }

  function cleanDescriptionText(text) {
    if (!text) return '';
    return String(text)
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const REQ_HEADING_RE =
    /^(who you are|requirements|required skills|qualifications|minimum qualifications|preferred qualifications|what you['’]?ll bring|what we['’]?re looking for|your background|must haves?|technical skills|skills)\s*:?$/i;

  const SECTION_STOP_RE =
    /^(responsibilities|what you['’]?ll do|about us|about the team|about the role|benefits|perks|compensation|salary|equal opportunity|our mission|why join)\s*:?$/i;

  function extractRequirementsFromText(description) {
    if (!description) return [];
    const lines = String(description)
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const out = [];
    const seen = new Set();
    let capturing = false;

    for (const rawLine of lines) {
      const heading = rawLine.replace(/^[•·▪▫◦‣⁃\-*]\s*/, '').trim();
      if (REQ_HEADING_RE.test(heading)) {
        capturing = true;
        continue;
      }
      if (capturing && SECTION_STOP_RE.test(heading)) {
        capturing = false;
        continue;
      }
      if (capturing) {
        const cleanItem = rawLine.replace(/^(?:[•·▪▫◦‣⁃*]+\s*|-\s+|\d{1,2}[.)]\s+)/, '').trim();
        if (cleanItem.length >= 8 && cleanItem.length <= 360 && !seen.has(cleanItem.toLowerCase())) {
          seen.add(cleanItem.toLowerCase());
          out.push(cleanItem);
          if (out.length >= 25) break;
        }
      }
    }

    return out;
  }

  async function expandTruncatedLinkedInDescription(container) {
    try {
      const scope = container || document;
      const moreBtn = scope.querySelector('button[data-testid="expandable-text-button"]');
      if (!moreBtn) return;

      const btnText = (moreBtn.textContent || '').trim();
      if (/less/i.test(btnText)) return;

      const textBox = scope.querySelector('[data-testid="expandable-text-box"]');
      const beforeLen = textBox ? (textBox.innerText || textBox.textContent || '').length : 0;

      moreBtn.click();

      // Wait briefly until expanded text renders in DOM
      for (let i = 0; i < 10; i += 1) {
        await delay(75);
        const currentBox = scope.querySelector('[data-testid="expandable-text-box"]');
        const afterLen = currentBox ? (currentBox.innerText || currentBox.textContent || '').length : 0;
        const afterBtn = scope.querySelector('button[data-testid="expandable-text-button"]');
        const collapsedStill = afterBtn && /more/i.test(afterBtn.textContent || '');
        if (afterLen > beforeLen && !collapsedStill) {
          break;
        }
      }
    } catch (err) {
      console.warn('Could not auto-expand LinkedIn description:', err);
    }
  }

  function toAbsoluteHttpUrl(rawUrl) {
    if (!rawUrl) return '';
    try {
      const resolved = new URL(rawUrl, window.location.origin).href;
      return /^https?:\/\//i.test(resolved) ? resolved : '';
    } catch {
      return '';
    }
  }

  function cleanLinkedInJobUrl(rawUrl) {
    const abs = toAbsoluteHttpUrl(rawUrl);
    if (!abs) return '';
    try {
      const parsed = new URL(abs);
      if (parsed.hostname.includes('linkedin.com')) {
        const viewMatch = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
        if (viewMatch) {
          return `https://www.linkedin.com/jobs/view/${viewMatch[1]}/`;
        }
        const currentJobId = parsed.searchParams.get('currentJobId');
        if (currentJobId && /^\d+$/.test(currentJobId)) {
          return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
        }
      }
      return abs;
    } catch {
      return abs;
    }
  }

  function resolveLinkedInExternalApplyUrl(rawUrl) {
    const abs = toAbsoluteHttpUrl(rawUrl);
    if (!abs) return '';
    try {
      const parsed = new URL(abs);
      if (parsed.hostname.includes('linkedin.com')) {
        const redirTarget = parsed.searchParams.get('url');
        if (redirTarget) {
          const decoded = toAbsoluteHttpUrl(redirTarget);
          if (decoded && !decoded.includes('linkedin.com/jobs')) {
            return decoded;
          }
        }
        return '';
      }
      return abs;
    } catch {
      return '';
    }
  }

  function extractLinkedInCompany(container, titleEl) {
    const cleanCandidate = (txt) =>
      String(txt || '')
        .replace(/\s+/g, ' ')
        .trim();

    const directSelectors = [
      'p > a[href*="/company/"]',
      'a[href*="/company/"] p a',
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '.sub-nav-cta__optional-url',
      '.company-name',
    ];

    for (const sel of directSelectors) {
      const el = container.querySelector(sel) || document.querySelector(sel);
      const name = cleanCandidate(el?.textContent);
      if (name && name.length <= 100) {
        const anchor = el.closest ? el.closest('a[href]') : null;
        return {
          company: name,
          companyUrl: toAbsoluteHttpUrl(anchor?.href || el?.getAttribute?.('href')),
        };
      }
    }

    const companyAnchors = Array.from(container.querySelectorAll('a[href*="/company/"]'));
    for (const a of companyAnchors) {
      const name = cleanCandidate(a.textContent);
      if (name && name.length <= 100 && !/^(follow|apply|save|show all)$/i.test(name)) {
        return {
          company: name,
          companyUrl: toAbsoluteHttpUrl(a.getAttribute('href') || a.href),
        };
      }
    }

    // Fallback: LinkedIn embeds company name right inside logo alt="Company logo for Citi"
    const logoImg =
      container.querySelector('img[alt^="Company logo for" i]') ||
      document.querySelector('img[alt^="Company logo for" i]');
    if (logoImg?.alt) {
      const fromAlt = cleanCandidate(
        logoImg.alt.replace(/^Company logo for\s+/i, '').replace(/[.,\s]+$/, '')
      );
      if (fromAlt && fromAlt.length <= 100) {
        const logoAnchor = logoImg.closest('a[href*="/company/"]') || companyAnchors[0];
        return {
          company: fromAlt,
          companyUrl: toAbsoluteHttpUrl(logoAnchor?.href || logoAnchor?.getAttribute?.('href')),
        };
      }
    }

    // Fallback: sibling block right before the job title
    if (titleEl) {
      let node = titleEl.closest('div') || titleEl.parentElement;
      for (let step = 0; step < 3 && node; step += 1) {
        const prev = node.previousElementSibling;
        const txt = cleanCandidate(prev?.textContent);
        if (txt && txt.length >= 2 && txt.length <= 70 && !/verified/i.test(txt)) {
          return {
            company: txt,
            companyUrl: toAbsoluteHttpUrl(companyAnchors[0]?.href),
          };
        }
        node = node.parentElement;
      }
    }

    return { company: '', companyUrl: '' };
  }

  function extractLinkedInLocation(container, titleEl, position, company) {
    let metaRow = null;
    try {
      metaRow = container.querySelector('div:has(> div > p > a[href*="/jobs/view/"]) ~ p');
    } catch {
      // Ignore if :has is unsupported
    }

    if (metaRow) {
      const metaSpans = Array.from(metaRow.querySelectorAll(':scope > span'))
        .map((el) => (el.textContent || '').trim())
        .filter((txt) => txt && txt !== '·');
      if (metaSpans[0] && !/promoted by|responses managed/i.test(metaSpans[0])) {
        return metaSpans[0];
      }
      const parts = (metaRow.textContent || '')
        .split('·')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts[0] && !/promoted by|responses managed/i.test(parts[0])) {
        return parts[0];
      }
    }

    // Split-pane / header block traversal around title element
    let headerScope = titleEl?.parentElement || container;
    for (let depth = 0; depth < 4 && headerScope && headerScope !== container; depth += 1) {
      const text = headerScope.innerText || headerScope.textContent || '';
      if (text.includes('·') || /ago|applicants/i.test(text)) {
        break;
      }
      headerScope = headerScope.parentElement;
    }

    const candidates = Array.from(
      (headerScope || container).querySelectorAll(
        'p, .tvm__text, .job-details-jobs-unified-top-card__primary-description-container div, .job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, span'
      )
    );
    for (const el of candidates) {
      if (el.closest('[data-testid="expandable-text-box"]')) continue;
      const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 160) continue;
      if (/^(promoted by|responses managed|reposted|apply|save|hybrid|remote|full-time|part-time)/i.test(raw)) {
        continue;
      }
      if (raw === position || raw === company) continue;
      if (raw.includes('·')) {
        const parts = raw.split('·').map((p) => p.trim()).filter(Boolean);
        if (parts[0] && !/promoted by|responses managed|ago|applicant/i.test(parts[0])) {
          return parts[0];
        }
      }
    }

    const legacyLocSelectors = [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.sub-nav-cta__meta-text',
      '.topcard__flavor--bullet',
      '.main-job-card__location',
      '[data-test-id="job-location"]',
    ];
    for (const sel of legacyLocSelectors) {
      const el = container.querySelector(sel) || document.querySelector(sel);
      const txt = el?.textContent?.trim();
      if (txt && txt.length <= 120) return txt;
    }

    return '';
  }

  async function extractJobData() {
    const url = window.location.href;
    let jobData = {
      jobUrl: url,
      extractedAt: new Date().toISOString(),
    };

    if (url.includes('linkedin.com/jobs')) {
      jobData = await extractLinkedInData();
    } else if (url.includes('internshala.com')) {
      jobData = extractInternshalaData();
    } else if (url.includes('unstop.com')) {
      jobData = extractUnstopData();
    } else if (url.includes('indeed.com')) {
      jobData = extractIndeedData();
    } else if (url.includes('naukri.com')) {
      jobData = extractNaukriData();
    } else if (url.includes('glassdoor.')) {
      jobData = extractGlassdoorData();
    } else {
      jobData = extractGenericData();
      const cachedSelectors = await getCachedSelectorsForHost(window.location.hostname);
      if (cachedSelectors) {
        const fromCached = extractUsingSelectors(cachedSelectors);
        if (fromCached.__matchedCount > 0) {
          delete fromCached.__matchedCount;
          jobData = mergeJobFields(jobData, fromCached);
          jobData.usedCachedSelectors = true;
        }
      }
    }

    if (!jobData.jobUrl) {
      jobData.jobUrl = url;
    }
    jobData.extractedAt = new Date().toISOString();

    if (!jobData.company || !jobData.position || !jobData.description) {
      const fallback = aggressiveExtraction();
      jobData = {
        ...fallback,
        ...Object.fromEntries(
          Object.entries(jobData).filter(([, val]) =>
            Array.isArray(val) ? val.length > 0 : Boolean(val)
          )
        ),
      };
    }

    if (jobData.description) {
      jobData.description = cleanDescriptionText(jobData.description);
      if (!Array.isArray(jobData.requirements) || jobData.requirements.length === 0) {
        jobData.requirements = extractRequirementsFromText(jobData.description);
      }
    } else {
      jobData.requirements = jobData.requirements || [];
    }

    return jobData;
  }

  async function extractLinkedInData() {
    const jobData = {};
    try {
      const container = document.querySelector('div[data-testid="lazy-column"]') || document;

      // 1. Expand truncated job description ("... more") before reading text
      await expandTruncatedLinkedInDescription(container);

      // 2. Job Title & Canonical Job URL
      const titleLink =
        container.querySelector('a[href*="/jobs/view/"]') ||
        document.querySelector('a[href*="/jobs/view/"]');
      if (titleLink) {
        const titleText = titleLink.textContent?.replace(/\s+/g, ' ').trim();
        if (titleText) jobData.position = titleText;
        const canonical = cleanLinkedInJobUrl(titleLink.getAttribute('href') || titleLink.href);
        if (canonical) jobData.jobUrl = canonical;
      }

      let resolvedTitleEl = titleLink;
      if (!jobData.position) {
        const legacyTitleSelectors = [
          '.job-details-jobs-unified-top-card__job-title h1',
          '.jobs-unified-top-card__job-title h1',
          '.top-card-layout__title',
          '.sub-nav-cta__header',
          '.topcard__title',
          '[data-test-id="job-title"]',
          'h1',
        ];
        for (const sel of legacyTitleSelectors) {
          const el = container.querySelector(sel) || document.querySelector(sel);
          if (el?.textContent?.trim()) {
            jobData.position = el.textContent.replace(/\s+/g, ' ').trim();
            resolvedTitleEl = el;
            break;
          }
        }
      }

      if (!jobData.jobUrl) {
        jobData.jobUrl = cleanLinkedInJobUrl(window.location.href);
      }

      // 3. Verified Job Badge
      jobData.verifiedJob = Boolean(container.querySelector('span[aria-label="Verified job"]'));

      // 4. Company Name, Company URL, and Company Logo
      const { company, companyUrl } = extractLinkedInCompany(container, resolvedTitleEl);
      if (company) jobData.company = company;
      if (companyUrl) jobData.companyUrl = companyUrl;

      const logoImg =
        container.querySelector('img[alt^="Company logo for" i]') ||
        document.querySelector('img[alt^="Company logo for" i]');
      if (logoImg?.src) {
        jobData.companyLogo = toAbsoluteHttpUrl(logoImg.src);
      }

      // 5. Location (works across split search pane and direct job view)
      const locText = extractLinkedInLocation(
        container,
        resolvedTitleEl,
        jobData.position,
        jobData.company
      );
      if (locText) jobData.location = locText;

      // 6. Compensation (exclude "Try Premium for ₹0" / zero noise)
      const tagNodes = container.querySelectorAll('a[href*="showHowYouFit"] span > span');
      tagNodes.forEach((node) => {
        const txt = node.textContent?.trim();
        if (
          txt &&
          !jobData.salary &&
          !/premium|₹\s*0\b|\$\s*0\b/i.test(txt) &&
          /[₹$€£¥]\s*[1-9]|[1-9]\d*\s*(?:k|lakh|crore)\b/i.test(txt)
        ) {
          jobData.salary = txt;
        }
      });

      if (!jobData.salary) {
        const salSelectors = [
          '.main-job-card__salary-info',
          '.jobs-unified-top-card__job-insight',
          '.job-details-jobs-unified-top-card__job-insight',
          '.salary',
        ];
        for (const sel of salSelectors) {
          const el = container.querySelector(sel) || document.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (
            text &&
            !/premium|for\s*[₹$€£¥]?\s*0\b/i.test(text) &&
            /[₹$€£¥]\s*[1-9]|[1-9]\d*\s*(?:lakh|crore|k|thousand|million)/i.test(text)
          ) {
            jobData.salary = text;
            break;
          }
        }
      }

      // 7. External Apply URL (decode LinkedIn /redir/redirect?url=...; ignore Easy Apply / duplicate LinkedIn URL)
      const applyAnchor =
        container.querySelector('a[aria-label*="Apply"], a[data-jobtracker-listener="true"]') ||
        document.querySelector('a[aria-label*="Apply"]');
      if (applyAnchor) {
        const externalApply = resolveLinkedInExternalApplyUrl(
          applyAnchor.getAttribute('href') || applyAnchor.href
        );
        if (externalApply && externalApply !== jobData.jobUrl) {
          jobData.applyUrl = externalApply;
        }
      }

      // 9. Job Description (.innerText preserves line breaks after expanding "... more")
      const expandableBox =
        container.querySelector('[data-testid="expandable-text-box"]') ||
        document.querySelector('[data-testid="expandable-text-box"]');
      if (expandableBox) {
        const inlineMoreBtn = expandableBox.querySelector('[data-testid="expandable-text-button"]');
        let prevDisplay = '';
        if (inlineMoreBtn) {
          prevDisplay = inlineMoreBtn.style.display;
          inlineMoreBtn.style.display = 'none';
        }
        let raw = '';
        try {
          raw = (expandableBox.innerText || '').trim();
        } finally {
          if (inlineMoreBtn) {
            inlineMoreBtn.style.display = prevDisplay;
          }
        }
        if (!raw) {
          const clone = expandableBox.cloneNode(true);
          clone.querySelector('[data-testid="expandable-text-button"]')?.remove();
          raw = (clone.innerText || clone.textContent || '').trim();
        }
        if (raw) {
          raw = raw.replace(/(?:\.\.\.|…)\s*more\s*$/i, '').trim();
          jobData.description = cleanDescriptionText(raw);
        }
      }

      if (!jobData.description) {
        const legacyDescSelectors = [
          '.description__text--rich',
          '.show-more-less-html__markup',
          '.jobs-description-content__text',
          '[data-test-id="job-description"]',
          '.job-description',
        ];
        for (const sel of legacyDescSelectors) {
          const el = container.querySelector(sel) || document.querySelector(sel);
          const txt = el?.innerText || el?.textContent || '';
          if (txt.trim()) {
            jobData.description = cleanDescriptionText(txt);
            break;
          }
        }
      }

      // 10. Benefits & Employee Growth
      const benefitsEl = container.querySelector('hr[role="presentation"] + p + p');
      if (benefitsEl?.textContent?.trim()) {
        jobData.benefits = benefitsEl.textContent.trim();
      }

      const growthEl = container.querySelector('[id^="JobDetails_PremiumCompanyInsights_"] svg + p');
      if (growthEl?.textContent?.trim()) {
        jobData.employeeGrowth = growthEl.textContent.trim();
      }

      // 11. Structured Requirements from expanded text
      if (jobData.description) {
        jobData.requirements = extractRequirementsFromText(jobData.description);
      }
    } catch (error) {
      console.error('Error extracting LinkedIn data:', error);
    }

    return jobData;
  }

  function extractInternshalaData() {
    const jobData = {};
    try {
      const companySelectors = ['.heading_4_5 a', '.company-name', '.company_name', 'h4.heading_4_5 a'];
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          jobData.company = el.textContent.trim();
          break;
        }
      }
      const titleSelectors = ['.heading_4_5.profile', 'div.heading_4_5.profile', '.profile', 'h1.heading_4_5'];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          jobData.position = el.textContent.trim();
          break;
        }
      }
      const locEl =
        document.querySelector('#location_names a') ||
        document.querySelector('.location_names a, .location a');
      if (locEl?.textContent?.trim()) jobData.location = locEl.textContent.trim();

      const salEl = document.querySelector('span.stipend, .stipend, .salary');
      if (salEl?.textContent?.trim()) jobData.salary = salEl.textContent.trim();

      const descEl = document.querySelector('.text-container, .description, .detail_text');
      if (descEl) jobData.description = cleanDescriptionText(descEl.innerText || descEl.textContent);
    } catch (err) {
      console.error('Internshala extraction error:', err);
    }
    return jobData;
  }

  function extractUnstopData() {
    const jobData = {};
    try {
      const titleEl = document.querySelector(
        'span[apptranslate="tataCrucible.title"], span[skiptranslate="true"], h1'
      );
      if (titleEl?.textContent?.trim()) jobData.position = titleEl.textContent.trim();

      const orgEl = document.querySelector('.org_name, .company-name, .blue_un-hover, a[href*="company"]');
      if (orgEl?.textContent?.trim()) jobData.company = orgEl.textContent.trim();

      const descEl = document.querySelector(
        '.un_editor_text_live[skiptranslate="true"], .about_game .un_editor_text_live, .un_editor_text_live'
      );
      if (descEl) jobData.description = cleanDescriptionText(descEl.innerText || descEl.textContent);

      const pEls = document.querySelectorAll('.items .cptn p, .ng-star-inserted p');
      for (const el of pEls) {
        const text = el.textContent?.trim() || '';
        if (/INR\s*\d+|₹\s*\d+|Stipend|per month/i.test(text)) {
          jobData.salary = text;
          break;
        }
      }
    } catch (err) {
      console.error('Unstop extraction error:', err);
    }
    return jobData;
  }

  function extractIndeedData() {
    const jobData = {};
    try {
      const titleEl = document.querySelector(
        'h2[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, [data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title, main h1, h1'
      );
      if (titleEl) {
        const clone = titleEl.cloneNode(true);
        clone.querySelectorAll('.icl-u-srOnly, .visually-hidden, [class*="srOnly"]').forEach((n) => n.remove());
        const rawTitle = (clone.textContent || '')
          .replace(/\s*-\s*job post\s*$/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (rawTitle) jobData.position = rawTitle;
      }

      const companyEl = document.querySelector(
        '[data-testid="inlineHeader-companyName"] a, [data-testid="inlineHeader-companyName"] span, [data-testid="inlineHeader-companyName"], [data-company-name="true"] a, [data-company-name="true"], .jobsearch-CompanyInfoContainer a, [data-testid="company-name"]'
      );
      if (companyEl?.textContent) {
        const cleanComp = companyEl.textContent
          .replace(/\s+\d(?:\.\d)?\s*★?$/, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanComp) jobData.company = cleanComp;
      }

      const locEl = document.querySelector(
        '[data-testid="inlineHeader-companyLocation"] div, [data-testid="inlineHeader-companyLocation"], [data-testid="job-location"], #jobLocationText'
      );
      if (locEl?.textContent?.trim()) {
        jobData.location = locEl.textContent.replace(/\s+/g, ' ').trim();
      }

      const salSelectors = [
        '#salaryInfoAndJobType span',
        '#salaryInfoAndJobType',
        '[data-testid="attribute_snippet_testid"]',
        '[aria-label="Pay"] span',
        '#jobDetailsSection [aria-label="Salary"] span',
      ];
      for (const sel of salSelectors) {
        const el = document.querySelector(sel);
        const txt = el?.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (txt && /[₹$€£\d]/.test(txt) && !/full-time|part-time|internship|fresher/i.test(txt)) {
          jobData.salary = txt;
          break;
        }
      }

      const descEl = document.querySelector(
        '#jobDescriptionText, .jobsearch-jobDescriptionText, [data-testid="jobsearch-JobComponent-description"]'
      );
      if (descEl) {
        jobData.description = cleanDescriptionText(descEl.innerText || descEl.textContent);
      }

      const applyLinkEl = document.querySelector(
        '#applyButtonLinkContainer a[href], a[data-testid*="apply" i][href], a[aria-label*="Apply" i][href]'
      );
      if (applyLinkEl) {
        const absApply = toAbsoluteHttpUrl(applyLinkEl.getAttribute('href') || applyLinkEl.href);
        if (absApply && absApply !== window.location.href) {
          jobData.applyUrl = absApply;
        }
      }

      const parsedUrl = new URL(window.location.href);
      const vjk = parsedUrl.searchParams.get('vjk') || parsedUrl.searchParams.get('jk');
      if (vjk) {
        jobData.jobUrl = `${parsedUrl.origin}/viewjob?jk=${encodeURIComponent(vjk)}`;
      }
    } catch (err) {
      console.error('Indeed extraction error:', err);
    }
    return jobData;
  }

  function extractNaukriData() {
    const jobData = {};
    const titleEl = document.querySelector('h1.styles_jd-header-title__rZwM1, .jd-header-title, h1');
    const companyEl = document.querySelector('.styles_jd-header-comp-name__MvqAI a, .jd-header-comp-name a, .comp-name');
    const locEl = document.querySelector('.styles_jhc__loc___Du2H, .location a, .locWdth');
    const salEl = document.querySelector('.styles_jhc__salary__jdfEC span, .salary span');
    const descEl = document.querySelector('.styles_JDC__dang-inner-html__h0K4t, .dang-inner-html');
    if (titleEl) jobData.position = titleEl.textContent.trim();
    if (companyEl) jobData.company = companyEl.textContent.trim();
    if (locEl) jobData.location = locEl.textContent.trim();
    if (salEl && !/not disclosed/i.test(salEl.textContent)) jobData.salary = salEl.textContent.trim();
    if (descEl) jobData.description = cleanDescriptionText(descEl.innerText || descEl.textContent);
    return jobData;
  }

  function extractGlassdoorData() {
    const jobData = {};
    const titleEl = document.querySelector('[data-test="job-title"], h1');
    const companyEl = document.querySelector('[data-test="employer-name"], .EmployerProfile_employerName__Xemli');
    const locEl = document.querySelector('[data-test="location"], .JobDetails_location__mSg5h');
    const salEl = document.querySelector('[data-test="detailSalary"]');
    const descEl = document.querySelector('.JobDetails_jobDescription__uW_fK, [data-test="jobDescription"]');
    if (titleEl) jobData.position = titleEl.textContent.trim();
    if (companyEl) jobData.company = companyEl.textContent.trim();
    if (locEl) jobData.location = locEl.textContent.trim();
    if (salEl) jobData.salary = salEl.textContent.trim();
    if (descEl) jobData.description = cleanDescriptionText(descEl.innerText || descEl.textContent);
    return jobData;
  }

  function firstMatchText(selectors, root = document, maxLen = 220) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        const text = (el?.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && text.length <= maxLen) return text;
      } catch {
        // Ignore invalid selector
      }
    }
    return '';
  }

  function stripHtmlToText(rawHtml) {
    if (!rawHtml) return '';
    try {
      const doc = new DOMParser().parseFromString(String(rawHtml), 'text/html');
      return cleanDescriptionText(doc.body?.innerText || doc.body?.textContent || '');
    } catch {
      return cleanDescriptionText(String(rawHtml).replace(/<[^>]+>/g, ' '));
    }
  }

  function getMetaContent(attrName, attrValue) {
    const el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    return el?.getAttribute('content')?.replace(/\s+/g, ' ').trim() || '';
  }

  function inferCompanyFromHost(hostname) {
    const cleanHost = String(hostname || '').toLowerCase().replace(/^www\./, '');
    const parts = cleanHost.split('.').filter(Boolean);
    const genericHosts =
      /(notion\.site|notion\.so|webflow\.io|framer\.website|framer\.site|substack\.com|medium\.com|github\.io|vercel\.app|netlify\.app|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|myworkdayjobs\.com|smartrecruiters\.com|bamboohr\.com|recruitee\.com|breezy\.hr|rippling\.com|wellfound\.com|workatastartup\.com|typeform\.com|airtable\.com)$/i;
    if (!parts.length || genericHosts.test(cleanHost)) return '';

    const genericSubdomains = new Set(['careers', 'career', 'jobs', 'job', 'apply', 'hiring', 'talent', 'join', 'work']);
    const candidate = genericSubdomains.has(parts[0]) && parts.length >= 2 ? parts[1] : parts[0];
    if (!candidate || candidate.length < 2) return '';
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  function findJobPostingNode(node) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findJobPostingNode(item);
        if (found) return found;
      }
      return null;
    }
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some((t) => String(t || '').toLowerCase() === 'jobposting')) {
      return node;
    }
    if (Array.isArray(node['@graph'])) {
      return findJobPostingNode(node['@graph']);
    }
    return null;
  }

  function formatJsonLdLocation(locNode) {
    if (!locNode) return '';
    if (typeof locNode === 'string') return locNode.trim();
    if (Array.isArray(locNode)) {
      return locNode.map(formatJsonLdLocation).filter(Boolean).slice(0, 2).join(' / ');
    }
    const addr = locNode.address || locNode;
    const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
      .map((p) => (typeof p === 'object' ? p?.name : p))
      .map((p) => String(p || '').trim())
      .filter(Boolean);
    return parts.join(', ');
  }

  function formatJsonLdSalary(salaryNode) {
    if (!salaryNode) return '';
    if (typeof salaryNode === 'string' || typeof salaryNode === 'number') return String(salaryNode).trim();
    const val = salaryNode.value || salaryNode;
    const cur = salaryNode.currency || val?.currency || '';
    if (val?.minValue && val?.maxValue) {
      return `${cur} ${val.minValue} - ${val.maxValue}${val.unitText ? ` / ${val.unitText}` : ''}`.trim();
    }
    if (val?.value) {
      return `${cur} ${val.value}${val.unitText ? ` / ${val.unitText}` : ''}`.trim();
    }
    return '';
  }

  function extractJsonLdJobPosting() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent || '{}');
        const posting = findJobPostingNode(parsed);
        if (!posting) continue;

        const out = {};
        if (posting.title) out.position = String(posting.title).replace(/\s+/g, ' ').trim();
        const org = posting.hiringOrganization;
        if (org?.name) out.company = String(org.name).replace(/\s+/g, ' ').trim();
        if (org?.sameAs) out.companyUrl = toAbsoluteHttpUrl(org.sameAs);
        const logoUrl = typeof org?.logo === 'string' ? org.logo : org?.logo?.url;
        if (logoUrl) out.companyLogo = toAbsoluteHttpUrl(logoUrl);

        const loc = formatJsonLdLocation(posting.jobLocation);
        const isRemote = String(posting.jobLocationType || '').toUpperCase() === 'TELECOMMUTE';
        if (loc || isRemote) {
          out.location = isRemote && !loc ? 'Remote' : isRemote ? `${loc} (Remote)` : loc;
        }
        const salary = formatJsonLdSalary(posting.baseSalary);
        if (salary) out.salary = salary;
        if (posting.description) out.description = stripHtmlToText(posting.description);
        if (posting.url) out.jobUrl = toAbsoluteHttpUrl(posting.url);
        return out;
      } catch {
        // Skip invalid JSON-LD script blocks
      }
    }
    return {};
  }

  const ATS_SELECTOR_PRESETS = [
    {
      match: (host) => host.includes('greenhouse.io'),
      position: ['#header .app-title', '.job__title h1', '.app-title', 'h1'],
      company: ['.company-name', '.company-title', '.logo-container img[alt]'],
      location: ['.location', '.job__location'],
      description: ['#content', '.job__description', '.job-post-container', '#main'],
      applyUrl: ['#apply_button', 'a[href*="#app"]'],
    },
    {
      match: (host) => host.includes('lever.co'),
      position: ['.posting-headline h2', '.posting-headline h1', 'h1'],
      company: [],
      location: ['.posting-categories .location', '.posting-categories .workplaceTypes'],
      description: ['[data-qa="job-description"]', '.section-wrapper.page-full-width .content', '.content'],
      applyUrl: ['.postings-btn[href*="/apply"]', 'a.postings-btn'],
    },
    {
      match: (host) => host.includes('ashbyhq.com'),
      position: ['h1[class*="title"]', 'h1'],
      company: ['[class*="company"]', '[class*="header"] a'],
      location: ['[class*="location"]'],
      description: ['[class*="description"]', 'main'],
      applyUrl: ['a[href*="/application"]', 'button[data-testid*="apply"]'],
    },
    {
      match: (host) => host.includes('myworkdayjobs.com'),
      position: ['[data-automation-id="jobPostingHeader"]', 'h2[data-automation-id="jobPostingTitle"]', 'h1'],
      company: ['[data-automation-id="company"]', '.css-company'],
      location: ['[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]'],
      description: ['[data-automation-id="jobPostingDescription"]'],
      applyUrl: ['a[data-automation-id="adventureButton"]'],
    },
    {
      match: (host) => host.includes('smartrecruiters.com'),
      position: ['h1.job-title', 'h1[itemprop="title"]', 'h1'],
      company: ['[itemprop="hiringOrganization"]', '.company-name', 'h2.header-company-name'],
      location: ['[itemprop="jobLocation"]', '.job-details .location'],
      description: ['[itemprop="description"]', '.job-sections', 'main'],
      applyUrl: ['a#st-apply', 'a[data-test="apply-button"]'],
    },
    {
      match: (host) => host.includes('workable.com'),
      position: ['[data-ui="job-title"]', 'h1'],
      company: ['[data-ui="company-name"]'],
      location: ['[data-ui="job-location"]', '[data-ui="job-workplace"]'],
      description: ['[data-ui="job-description"]', 'section[data-ui="job-description"]', 'main'],
      applyUrl: ['a[data-ui="apply-button"]'],
    },
    {
      match: (host) =>
        /(wellfound\.com|workatastartup\.com|rippling\.com|bamboohr\.com|recruitee\.com|breezy\.hr)/i.test(host),
      position: ['[data-test*="job-title"]', 'h1', 'h2'],
      company: ['[data-test*="company-name"]', '.company-name', '[class*="company-name"]', 'header a'],
      location: ['[data-test*="location"]', '[class*="location"]'],
      description: ['[data-test*="description"]', '.job-description', '.description', 'main', 'article'],
      applyUrl: ['a[href*="apply"]', 'a[data-test*="apply"]'],
    },
  ];

  function extractAtsPresetData(host) {
    const preset = ATS_SELECTOR_PRESETS.find((p) => p.match(host));
    if (!preset) return {};
    const jobData = {};
    jobData.position = firstMatchText(preset.position);
    jobData.company = firstMatchText(preset.company);
    jobData.location = firstMatchText(preset.location);
    for (const sel of preset.description) {
      const el = document.querySelector(sel);
      const txt = el?.innerText || el?.textContent || '';
      if (txt && txt.trim().length > 80) {
        jobData.description = cleanDescriptionText(txt);
        break;
      }
    }
    if (preset.applyUrl?.length) {
      for (const sel of preset.applyUrl) {
        const el = document.querySelector(sel);
        const abs = toAbsoluteHttpUrl(el?.getAttribute?.('href') || el?.href);
        if (abs && abs !== window.location.href) {
          jobData.applyUrl = abs;
          break;
        }
      }
    }
    return jobData;
  }

  function extractCleanContainerDescription(rootEl) {
    if (!rootEl) return '';
    const clone = rootEl.cloneNode(true);
    clone
      .querySelectorAll('nav, header, footer, aside, script, style, noscript, svg, [role="navigation"]')
      .forEach((node) => node.remove());
    return cleanDescriptionText(clone.innerText || clone.textContent || '');
  }

  function inferStartupDescription() {
    const explicit = [
      '.job-description',
      '#job-description',
      '#jobDescription',
      '[itemprop="description"]',
      '[data-testid*="description"]',
      '[data-qa*="description"]',
      '.posting-description',
      '.career-description',
    ];
    for (const sel of explicit) {
      const el = document.querySelector(sel);
      const txt = cleanDescriptionText(el?.innerText || el?.textContent || '');
      if (txt.length > 80) return txt;
    }

    const candidates = Array.from(
      document.querySelectorAll('main, article, [role="main"], .notion-page-content, section, div.container')
    );
    const jobSignalRe =
      /\b(requirements|responsibilities|qualifications|what you['’]?ll do|who you are|about the role|experience|skills|apply)\b/i;

    let bestText = '';
    let bestScore = -1;
    for (const el of candidates) {
      const cleaned = extractCleanContainerDescription(el);
      if (cleaned.length < 120 || cleaned.length > 25000) continue;
      const matches = (cleaned.match(new RegExp(jobSignalRe.source, 'gi')) || []).length;
      const score = matches * 400 + Math.min(cleaned.length, 6000);
      if (score > bestScore) {
        bestScore = score;
        bestText = cleaned;
      }
    }

    if (bestText) return bestText;
    return extractCleanContainerDescription(document.body).slice(0, 12000);
  }

  function inferCompanyAndTitleFallback(current) {
    const out = { ...current };
    const titleRaw = (document.title || '').replace(/\s+/g, ' ').trim();
    const ogTitle = getMetaContent('property', 'og:title');
    const ogSite = getMetaContent('property', 'og:site_name') || getMetaContent('name', 'application-name');

    if (!out.position) {
      const h1 = firstMatchText(
        [
          '[data-testid="job-title"]',
          '[itemprop="title"]',
          '.job-title',
          '.posting-title',
          'main h1',
          'article h1',
          'h1',
        ],
        document,
        140
      );
      if (h1 && !/^(careers|jobs|join us|open roles|hiring)$/i.test(h1)) {
        out.position = h1;
      } else if (ogTitle) {
        out.position = ogTitle.split(/\s[|\-–—]\s/)[0].trim().slice(0, 140);
      } else if (titleRaw) {
        out.position = titleRaw.split(/\s[|\-–—]\s/)[0].trim().slice(0, 140);
      }
    }

    if (!out.company) {
      const domCompany = firstMatchText(
        [
          '[itemprop="hiringOrganization"]',
          '.company-name',
          '.employer',
          '[data-testid="company-name"]',
          'header [class*="logo"]',
          'nav a[href="/"]',
        ],
        document,
        80
      );
      const validDomCompany =
        domCompany && !/^(home|careers|jobs|about|apply|menu)$/i.test(domCompany) ? domCompany : '';

      let titleSuffix = '';
      const parts = titleRaw.split(/\s[|\-–—]\s/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        if (!/^(careers?|jobs?|apply|hiring|job board)$/i.test(last) && last.length <= 60) {
          titleSuffix = last;
        }
      } else {
        const atMatch = titleRaw.match(/\bat\s+([A-Za-z0-9&.,'\-\s]{2,50})$/i);
        if (atMatch?.[1]) titleSuffix = atMatch[1].trim();
      }

      const validOgSite =
        ogSite && !/^(greenhouse|lever|ashby|workable|notion|webflow|workday|jobs)$/i.test(ogSite)
          ? ogSite
          : '';

      out.company =
        validDomCompany || validOgSite || titleSuffix || inferCompanyFromHost(window.location.hostname);
    }

    return out;
  }

  function extractGenericData() {
    const host = (window.location.hostname || '').toLowerCase();
    const fromJsonLd = extractJsonLdJobPosting();
    const fromAts = extractAtsPresetData(host);

    const basicDom = {
      position: firstMatchText(['[data-testid="job-title"]', '[itemprop="title"]', '.job-title', 'main h1', 'h1'], document, 140),
      company: firstMatchText(['[itemprop="hiringOrganization"]', '.company-name', '.employer', '[data-testid="company-name"]'], document, 80),
      location: firstMatchText(['[itemprop="jobLocation"]', '.location', '.job-location', '[data-testid*="location"]'], document, 120),
      description: '',
    };

    const merged = {
      ...basicDom,
      ...Object.fromEntries(Object.entries(fromAts).filter(([, v]) => Boolean(v))),
      ...Object.fromEntries(Object.entries(fromJsonLd).filter(([, v]) => Boolean(v))),
    };

    if (!merged.description) {
      merged.description = inferStartupDescription();
    }

    if (!merged.location) {
      const topScope = document.querySelector('main, header, article') || document.body;
      const locCandidate = Array.from((topScope || document).querySelectorAll('span, p, div, li'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .find(
          (t) =>
            t.length >= 4 &&
            t.length <= 80 &&
            /^(remote|hybrid|on-?site|bangalore|bengaluru|hyderabad|pune|mumbai|delhi|noida|gurgaon|chennai|san francisco|new york|london|berlin)\b/i.test(
              t
            )
        );
      if (locCandidate) merged.location = locCandidate;
    }

    return inferCompanyAndTitleFallback(merged);
  }

  function aggressiveExtraction() {
    const base = { jobUrl: window.location.href };
    const inferred = inferCompanyAndTitleFallback(base);
    if (!inferred.description) {
      const desc = inferStartupDescription();
      if (desc) inferred.description = desc;
    }
    return inferred;
  }

  function mergeJobFields(...layers) {
    const out = {};
    for (const layer of layers) {
      if (!layer || typeof layer !== 'object') continue;
      for (const [key, val] of Object.entries(layer)) {
        if (key.startsWith('__')) continue;
        if (Array.isArray(val)) {
          if (val.length > 0) out[key] = val;
        } else if (typeof val === 'string') {
          if (val.trim()) out[key] = val.trim();
        } else if (val !== undefined && val !== null && val !== false) {
          out[key] = val;
        }
      }
    }
    return out;
  }

  function cleanFallbackJobData(raw) {
    if (!raw || typeof raw !== 'object') return {};
    return {
      company: String(raw.company || '').trim(),
      position: String(raw.position || '').trim(),
      location: String(raw.location || '').trim(),
      salary: String(raw.salary || '').trim(),
      applyUrl: toAbsoluteHttpUrl(raw.applyUrl),
      description: cleanDescriptionText(raw.description || ''),
      requirements: Array.isArray(raw.requirements)
        ? raw.requirements.map((r) => String(r || '').trim()).filter(Boolean).slice(0, 25)
        : [],
    };
  }

  function getCachedSelectorsForHost(hostname) {
    const cleanHost = String(hostname || '').toLowerCase().trim();
    if (!cleanHost) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['domainSelectorCache'], (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const cache = res?.domainSelectorCache || {};
          const entry = cache[cleanHost];
          resolve(entry?.selectors || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function readSelectorValue(selector, mode = 'text') {
    const cleanSel = String(selector || '').trim();
    if (!cleanSel) return '';
    try {
      const el = document.querySelector(cleanSel);
      if (!el) return '';
      if (mode === 'url') {
        const href = el.getAttribute('href') || el.href || '';
        return toAbsoluteHttpUrl(href);
      }
      if (mode === 'multiline') {
        return cleanDescriptionText(el.innerText || el.textContent || '');
      }
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt && el.tagName === 'IMG' && el.alt) {
        return el.alt.replace(/\blogo\b/i, '').replace(/\s+/g, ' ').trim();
      }
      return txt;
    } catch {
      return '';
    }
  }

  function extractUsingSelectors(selectors) {
    if (!selectors || typeof selectors !== 'object') return { __matchedCount: 0 };
    const result = {};
    let matchedCount = 0;

    const assignIfPresent = (field, val) => {
      if (val && typeof val === 'string' && val.trim()) {
        result[field] = val.trim();
        matchedCount += 1;
      }
    };

    assignIfPresent('position', readSelectorValue(selectors.positionSelector, 'text'));
    assignIfPresent('company', readSelectorValue(selectors.companySelector, 'text'));
    assignIfPresent('location', readSelectorValue(selectors.locationSelector, 'text'));
    assignIfPresent('salary', readSelectorValue(selectors.salarySelector, 'text'));
    assignIfPresent('description', readSelectorValue(selectors.descriptionSelector, 'multiline'));

    const applyHref = readSelectorValue(selectors.applyUrlSelector, 'url');
    if (applyHref && applyHref !== window.location.href) {
      result.applyUrl = applyHref;
      matchedCount += 1;
    }

    if (selectors.requirementsSelector) {
      try {
        const nodes = Array.from(document.querySelectorAll(selectors.requirementsSelector));
        const reqs = [];
        const seen = new Set();
        for (const node of nodes) {
          const lines = (node.innerText || node.textContent || '')
            .split('\n')
            .map((l) => l.replace(/^(?:[•·▪▫◦‣⁃*]+\s*|-\s+|\d{1,2}[.)]\s+)/, '').trim())
            .filter((l) => l.length >= 6 && l.length <= 360);
          for (const line of lines) {
            const key = line.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              reqs.push(line);
              if (reqs.length >= 25) break;
            }
          }
          if (reqs.length >= 25) break;
        }
        if (reqs.length > 0) {
          result.requirements = reqs;
          matchedCount += 1;
        }
      } catch {
        // Ignore invalid requirementsSelector
      }
    }

    result.__matchedCount = matchedCount;
    return result;
  }

  function buildDomSkeletonPayload() {
    const MAX_SKELETON_CHARS = 20000;
    const chunks = [];
    let totalChars = 0;

    const appendChunk = (str) => {
      if (!str || totalChars >= MAX_SKELETON_CHARS) return false;
      const slice = str.slice(0, MAX_SKELETON_CHARS - totalChars);
      chunks.push(slice);
      totalChars += slice.length;
      return totalChars < MAX_SKELETON_CHARS;
    };

    const clone = document.body ? document.body.cloneNode(true) : null;
    if (clone) {
      clone
        .querySelectorAll(
          'script, style, noscript, svg, iframe, canvas, video, audio, nav, footer, #jobtracker-extraction-loader, [aria-hidden="true"]'
        )
        .forEach((n) => n.remove());
    }

    const PRIORITY_ATTRS = ['id', 'role', 'itemprop', 'data-testid', 'data-qa', 'data-ui', 'data-automation-id', 'aria-label'];
    const VOID_TAGS = new Set(['BR', 'HR', 'IMG', 'INPUT', 'META', 'LINK']);

    function formatAttrs(el) {
      const attrs = [];
      for (const name of PRIORITY_ATTRS) {
        const val = el.getAttribute?.(name);
        if (val && val.length <= 80) {
          attrs.push(`${name}="${val.replace(/"/g, "'")}"`);
        }
      }
      if (typeof el.className === 'string' && el.className.trim()) {
        const tokens = el.className
          .trim()
          .split(/\s+/)
          .filter(
            (t) =>
              t &&
              t.length <= 32 &&
              !/^(css|sc)-[a-z0-9]{4,}$/i.test(t) &&
              !/__[a-zA-Z0-9]{5,}$/.test(t) &&
              !/\[.+\]/.test(t)
          )
          .slice(0, 4);
        if (tokens.length > 0) {
          attrs.push(`class="${tokens.join(' ')}"`);
        }
      }
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (href && !href.startsWith('javascript:')) {
          attrs.push(`href="${href.slice(0, 90).replace(/"/g, "'")}"`);
        }
      } else if (el.tagName === 'IMG') {
        const alt = el.getAttribute('alt') || '';
        if (alt) attrs.push(`alt="${alt.slice(0, 60).replace(/"/g, "'")}"`);
      }
      return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
    }

    function walk(node, depth = 0) {
      if (!node || totalChars >= MAX_SKELETON_CHARS || depth > 14) return;
      if (node.nodeType === 3) {
        const txt = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt) {
          appendChunk(txt.length > 180 ? `${txt.slice(0, 177)}...` : txt);
        }
        return;
      }
      if (node.nodeType !== 1) return;

      const tag = node.tagName.toLowerCase();
      if (node.style?.display === 'none' || node.hidden) return;
      const attrStr = formatAttrs(node);

      if (VOID_TAGS.has(node.tagName)) {
        if (attrStr) appendChunk(`<${tag}${attrStr}/>`);
        return;
      }

      const childNodes = Array.from(node.childNodes || []);
      const hasOnlySingleWrapper =
        childNodes.length === 1 &&
        childNodes[0].nodeType === 1 &&
        !attrStr &&
        (tag === 'div' || tag === 'span');

      if (hasOnlySingleWrapper) {
        walk(childNodes[0], depth + 1);
        return;
      }

      if (!appendChunk(`<${tag}${attrStr}>`)) return;
      for (const child of childNodes) {
        if (totalChars >= MAX_SKELETON_CHARS) break;
        walk(child, depth + 1);
      }
      appendChunk(`</${tag}>`);
    }

    if (clone) {
      walk(clone, 0);
    }

    const visibleTextExcerpt = extractCleanContainerDescription(document.body).slice(0, 8000);

    return {
      url: window.location.href,
      hostname: (window.location.hostname || '').toLowerCase(),
      title: (document.title || '').replace(/\s+/g, ' ').trim(),
      domSkeleton: chunks.join(''),
      visibleTextExcerpt,
    };
  }

  function handleApplyTrigger() {
    if (isExtracting) return;
    setTimeout(async () => {
      isExtracting = true;
      showExtractionLoader();
      try {
        const jobData = await extractJobData();
        hideExtractionLoader();
        isExtracting = false;
        chrome.storage.local.set({ pendingJobData: jobData, autoOpenPopup: true }, () => {
          showNotification('Job details & requirements captured to ApplicationTracker');
          chrome.runtime.sendMessage({ action: 'saveJobData', jobData });
        });
      } catch {
        hideExtractionLoader();
        isExtracting = false;
      }
    }, 300);
  }

  function setupAutoApplyDetection() {
    const applySelectors = [
      'a[aria-label*="Apply"]',
      'button[aria-label*="Apply"]',
      '.top_apply_now_cta',
      '.apply-btn',
      '[data-apply="true"]',
      '.top-card-layout__cta--primary',
      'button[data-tracking-control-name*="apply"]',
    ];

    applySelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el.hasAttribute('data-jobtracker-listener')) {
          el.setAttribute('data-jobtracker-listener', 'true');
          el.addEventListener('click', handleApplyTrigger);
        }
      });
    });

    document.querySelectorAll('button, a, [role="button"]').forEach((el) => {
      if (el.hasAttribute('data-jobtracker-listener')) return;
      const text = (el.textContent || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      if (
        (/\bapply\b/.test(text) || /\bsubmit application\b/.test(text) || /\bapply\b/.test(aria)) &&
        !text.includes('applied')
      ) {
        el.setAttribute('data-jobtracker-listener', 'true');
        el.addEventListener('click', handleApplyTrigger);
      }
    });
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #171717;
      color: #fafafa;
      border: 1px solid rgba(255,255,255,0.14);
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      max-width: 320px;
      line-height: 1.4;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
  }

  setupAutoApplyDetection();

  const observer = new MutationObserver(() => {
    clearTimeout(window.jobTrackerSetupTimeout);
    window.jobTrackerSetupTimeout = setTimeout(setupAutoApplyDetection, 500);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
