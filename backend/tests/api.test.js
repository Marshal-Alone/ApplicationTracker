const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'jobtracker_test';

const { app, server } = require('../server');
const { initMongoDB, client, getDb } = require('../config/db');
const {
  escapeRegex,
  sanitizeHttpUrl,
  extractRequirementsFromDescription,
  validateJobData,
} = require('../models/Application');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { setTestInteractionsOverride } = require('../services/geminiService');

describe('ApplicationTracker Backend API & Security', () => {
  let baseUrl = '';
  let wsBaseUrl = '';

  before(async () => {
    await initMongoDB();
    const db = getDb();
    await db.collection('users').deleteMany({});
    await db.collection('applications').deleteMany({});
    await db.collection('interviews').deleteMany({});

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        wsBaseUrl = `ws://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    const db = getDb();
    if (db) {
      await db.collection('users').deleteMany({});
      await db.collection('applications').deleteMany({});
      await db.collection('interviews').deleteMany({});
    }
    await new Promise((resolve) => server.close(resolve));
    await client.close();
  });

  it('escapes regex characters safely and blocks non-http URLs', () => {
    assert.equal(escapeRegex('C++ (Core) [Team]'), 'C\\+\\+ \\(Core\\) \\[Team\\]');
    assert.equal(sanitizeHttpUrl('https://linkedin.com/jobs/view/1'), 'https://linkedin.com/jobs/view/1');
    assert.equal(sanitizeHttpUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeHttpUrl('data:text/html,hi'), '');
  });

  it('preserves newlines and extracts Who You Are / Requirements lines cleanly', () => {
    const sample = `About the role\nBuild great web apps.\n\nWho You Are\n\nBachelor's degree in Computer Science/Engineering or equivalent experience.\n1.5+ years of development experience with contributions to both frontend and backend.\n1. Hands on with React, JavaScript (ES6+), and TypeScript.\n- Comfortable writing SQL and PostgreSQL.\n• Experience with Docker.\n\nBenefits\n401(k), Medical insurance`;
    const reqs = extractRequirementsFromDescription(sample);
    assert.deepEqual(reqs, [
      "Bachelor's degree in Computer Science/Engineering or equivalent experience.",
      '1.5+ years of development experience with contributions to both frontend and backend.',
      'Hands on with React, JavaScript (ES6+), and TypeScript.',
      'Comfortable writing SQL and PostgreSQL.',
      'Experience with Docker.',
    ]);
    const validated = validateJobData({
      company: 'Acme',
      position: 'Full Stack Developer',
      verifiedJob: true,
      tags: ['Hybrid', 'Full-time', 'Hybrid'],
      benefits: '401(k), Vision insurance',
      employeeGrowth: '30%',
      description: sample,
    });
    assert.equal(validated.verifiedJob, true);
    assert.deepEqual(validated.tags, ['Hybrid', 'Full-time']);
    assert.equal(validated.requirements.length, 5);
    assert.ok(validated.description.includes('\n\nWho You Are\n\n'));
  });

  it('enforces sliding-window rate limits with Retry-After header', () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
    let nextCount = 0;
    let statusCode = 200;
    const headers = {};
    const req = { ip: '127.0.0.99', headers: { 'x-test-ratelimit': 'true' } };
    const res = {
      set: (k, v) => { headers[k] = v; },
      status: (c) => {
        statusCode = c;
        return { json: (body) => body };
      },
    };

    limiter(req, res, () => { nextCount += 1; });
    limiter(req, res, () => { nextCount += 1; });
    limiter(req, res, () => { nextCount += 1; });

    assert.equal(nextCount, 2);
    assert.equal(statusCode, 429);
    assert.ok(Number(headers['Retry-After']) >= 1);
  });

  it('enforces auth, security headers, profile/account deletion, regex-safe dedup, multi-tenant isolation, WS privacy, and interviews CRUD + sync', async () => {
    // 1. Check security headers and unauthenticated guard
    const unauthRes = await fetch(`${baseUrl}/api/applications`);
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(unauthRes.headers.get('x-frame-options'), 'DENY');
    assert.equal(unauthRes.headers.get('x-powered-by'), null);

    // 2. Register User A and User B
    const regA = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Candidate', email: 'alice@example.com', password: 'password123' }),
    });
    assert.equal(regA.status, 201);
    const dataA = await regA.json();
    assert.ok(dataA.token);
    assert.ok(dataA.user.apiKey.startsWith('jt_'));
    assert.deepEqual(dataA.user.skills, []);
    assert.equal(dataA.user.experienceYears, 0);

    // Update fresher profile skills/roles/experience cleanly without resetting name
    const profileRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({
        skills: ['React', 'TypeScript', 'SQL', 'React'],
        targetRoles: ['Frontend Engineer'],
        experienceYears: 0,
      }),
    });
    assert.equal(profileRes.status, 200);
    const profileData = await profileRes.json();
    assert.deepEqual(profileData.user.skills, ['React', 'TypeScript', 'SQL']);
    assert.deepEqual(profileData.user.targetRoles, ['Frontend Engineer']);
    assert.equal(profileData.user.name, 'Alice Candidate');

    // Duplicate email returns 409
    const dupReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice Two', email: 'alice@example.com', password: 'password123' }),
    });
    assert.equal(dupReg.status, 409);

    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob Candidate', email: 'bob@example.com', password: 'password123' }),
    });
    assert.equal(regB.status, 201);
    const dataB = await regB.json();

    // 3. Open WebSocket clients for User A and Unauthenticated Guest
    const wsA = new WebSocket(`${wsBaseUrl}?token=${dataA.token}`);
    const wsGuest = new WebSocket(wsBaseUrl);
    const receivedA = [];
    const receivedGuest = [];

    wsA.on('message', (msg) => receivedA.push(JSON.parse(msg.toString())));
    wsGuest.on('message', (msg) => receivedGuest.push(JSON.parse(msg.toString())));

    await new Promise((r) => setTimeout(r, 150));

    // 4. Create application with special regex chars via x-api-key (Chrome Extension flow)
    const createRes = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': dataA.user.apiKey,
      },
      body: JSON.stringify({
        company: 'AT&T (R&D)',
        position: 'C++ Systems Engineer [Senior]',
        salary: '₹2,400,000',
        jobUrl: 'javascript:alert(1)',
        status: 'Applied',
        resumeVersion: 'Resume_SWE_Fresher_v2.pdf',
        referralContact: 'Anita (Alumni, SWE II)',
        followUpDate: '2026-12-04',
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.data.jobUrl, '');
    assert.equal(created.data.resumeVersion, 'Resume_SWE_Fresher_v2.pdf');
    assert.equal(created.data.referralContact, 'Anita (Alumni, SWE II)');
    assert.equal(created.data.followUpDate, '2026-12-04');

    // Duplicate check works with regex chars without throwing 500
    const dupCreate = await fetch(`${baseUrl}/api/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({
        company: 'AT&T (R&D)',
        position: 'C++ Systems Engineer [Senior]',
      }),
    });
    assert.equal(dupCreate.status, 409);

    // Wait briefly for WS notification
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(receivedA.some((m) => m.type === 'NEW_APPLICATION' && m.application.id === created.data.id));
    assert.equal(receivedGuest.some((m) => m.type === 'NEW_APPLICATION'), false);

    // 5. Multi-tenant isolation check (Bob must NOT read or mutate Alice's app)
    const bobListRes = await fetch(`${baseUrl}/api/applications`, {
      headers: { Authorization: `Bearer ${dataB.token}` },
    });
    const bobList = await bobListRes.json();
    assert.equal(bobList.applications.length, 0);

    const bobUpdateRes = await fetch(`${baseUrl}/api/applications/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataB.token}`,
      },
      body: JSON.stringify({ status: 'Offer' }),
    });
    assert.equal(bobUpdateRes.status, 404);

    // Invalid status returns 400
    const badStatus = await fetch(`${baseUrl}/api/applications/${created.data.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({ status: 'HackedStatus' }),
    });
    assert.equal(badStatus.status, 400);

    // 6. Interviews CRUD + Sync + Cascade unlink on Application deletion
    const ivCreate = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({
        applicationId: created.data.id,
        company: 'AT&T (R&D)',
        position: 'C++ Systems Engineer [Senior]',
        date: '2026-12-05',
        time: '14:30',
        type: 'Video Call',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
      }),
    });
    assert.equal(ivCreate.status, 201);
    const ivData = await ivCreate.json();

    const ivSync = await fetch(`${baseUrl}/api/interviews/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({
        frontendInterviews: [
          {
            id: 'iv_local_1',
            company: 'Acme Inc',
            position: 'Platform Engineer',
            date: '2026-12-10',
            time: '11:00',
            type: 'Phone Call',
          },
          {
            // Duplicate of existing interview should be skipped
            company: 'AT&T (R&D)',
            position: 'C++ Systems Engineer [Senior]',
            date: '2026-12-05',
            time: '14:30',
          },
        ],
      }),
    });
    assert.equal(ivSync.status, 200);
    const ivSyncBody = await ivSync.json();
    assert.equal(ivSyncBody.syncedCount, 1);

    // Delete parent application and confirm interview's applicationId is unlinked cleanly
    const delApp = await fetch(`${baseUrl}/api/applications/${created.data.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${dataA.token}` },
    });
    assert.equal(delApp.status, 200);

    const ivAfterDelRes = await fetch(`${baseUrl}/api/interviews`, {
      headers: { Authorization: `Bearer ${dataA.token}` },
    });
    const ivAfterDel = await ivAfterDelRes.json();
    const unlinkedIv = ivAfterDel.interviews.find((i) => i.id === ivData.data.id);
    assert.equal(unlinkedIv.applicationId, '');

    // 7. Profile update & Account deletion cascade
    const profRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataA.token}`,
      },
      body: JSON.stringify({ name: 'Alice Updated' }),
    });
    assert.equal(profRes.status, 200);
    const profData = await profRes.json();
    assert.equal(profData.user.name, 'Alice Updated');

    const delAcctRes = await fetch(`${baseUrl}/api/auth/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${dataA.token}` },
    });
    assert.equal(delAcctRes.status, 200);

    const verifyMeAfterDelete = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${dataA.token}` },
    });
    assert.equal(verifyMeAfterDelete.status, 404);

    // Delete temporary AI verification test records and test Account Deletion
    wsA.close();
    wsGuest.close();
  });

  it('builds AI resume context, blocks guest use of server key, and persists AI job match edits', async () => {
    const aiStatusRes = await fetch(`${baseUrl}/api/ai/status`);
    assert.equal(aiStatusRes.status, 200);
    const aiStatus = await aiStatusRes.json();
    assert.equal(typeof aiStatus.serverConfigured, 'boolean');
    assert.ok(aiStatus.model);

    // Guest without x-gemini-api-key cannot trigger AI endpoints even if server has GEMINI_API_KEY
    const origServerKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'server-secret-test-key';
    try {
      const guestDeny = await fetch(`${baseUrl}/api/ai/resume-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: 'B.Tech CS 2026' }),
      });
      assert.equal(guestDeny.status, 400);
      const guestErr = await guestDeny.json();
      assert.equal(guestErr.code, 'GEMINI_KEY_MISSING');

      const guestDiscoverDeny = await fetch(`${baseUrl}/api/ai/discover-selectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domSkeleton: '<main><h1>Role</h1></main>' }),
      });
      assert.equal(guestDiscoverDeny.status, 400);
      const guestDiscoverErr = await guestDiscoverDeny.json();
      assert.equal(guestDiscoverErr.code, 'GEMINI_KEY_MISSING');
    } finally {
      if (origServerKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origServerKey;
    }

    const regAi = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fresher Dev', email: 'fresher-ai@example.com', password: 'password123' }),
    });
    assert.equal(regAi.status, 201);
    const aiUser = await regAi.json();

    setTestInteractionsOverride(async ({ apiVersion, input, model }) => {
      assert.equal(apiVersion, 'v1beta');
      const joined = typeof input === 'string' ? input : JSON.stringify(input);
      if (joined.includes('Parse the candidate resume completely')) {
        if (Array.isArray(input)) {
          assert.equal(input[0].type, 'document');
          assert.equal(input[0].mime_type, 'application/pdf');
          assert.equal(input[1].type, 'text');
        }
        return {
          rawText: 'Fresher Dev\nB.Tech CSE 2026\nSkills: Java, Spring Boot, React, PostgreSQL\nProject: OrderTracker',
          candidateSummary: '2026 CS graduate with Java backend and React project depth.',
          experienceYears: 0,
          education: ['B.Tech CSE (2026)'],
          technicalSkills: ['Java', 'Spring Boot', 'React', 'PostgreSQL'],
          projects: [
            {
              name: 'OrderTracker',
              stack: ['Java', 'Spring Boot', 'PostgreSQL'],
              impactSummary: 'Built REST inventory API handling 500 req/s cleanly.',
              bullets: ['Designed normalized PostgreSQL schema and REST endpoints.'],
            },
          ],
          internshipsOrExperience: [],
          strengths: ['Full-stack REST project with PostgreSQL'],
          gapsToWatch: ['No automated tests highlighted in project bullets'],
          fullContextPrompt: 'Fresher Dev (0 yrs, B.Tech 2026). Skills: Java, Spring Boot, React, PostgreSQL. Project OrderTracker.',
        };
      }
      if (joined.includes('HTML DOM skeleton')) {
        if (joined.includes('high-demand-sim') && model === 'gemini-4-hydrogen') {
          const err = new Error(
            'gemini-4-hydrogen is currently experiencing high demand, spikes in demand are usually temporary. Please try again later.'
          );
          err.statusCode = 503;
          throw err;
        }
        return {
          selectors: {
            positionSelector: '`main h1.role-title`',
            companySelector: '.company-brand',
            locationSelector: '[data-testid="loc"]',
            salarySelector: '',
            descriptionSelector: 'article.job-body',
            applyUrlSelector: 'a.apply-link',
            requirementsSelector: 'article.job-body ul li',
          },
          fallbackData: {
            company: 'Acme Labs',
            position: 'Founding Engineer',
            location: 'Bengaluru (Hybrid)',
            salary: '',
            applyUrl: 'https://acme.example/apply',
            description: 'Build distributed APIs in Go and React.',
            requirements: ['2+ projects in React/Node', 'PostgreSQL schema design'],
          },
          notes: 'Single-role Next.js career detail view',
        };
      }
      return {
        overallVerdict: 'Good fit with tailoring',
        fitSummary: 'Strong Java + PostgreSQL alignment via OrderTracker; missing Kafka & Docker keywords.',
        experienceCheck: '0 yrs vs 1+ yr target — highlight OrderTracker throughput metric and pursue alumni referral.',
        matchedHighlights: ['OrderTracker uses Java, Spring Boot, and PostgreSQL matching core backend stack'],
        missingKeywords: ['Kafka', 'Docker'],
        resumeEdits: [
          {
            section: 'Project: OrderTracker',
            currentFocus: 'Generic schema mention without API test details',
            suggestedChange: 'Highlight REST API validation and add any JUnit test coverage metrics truthfully.',
            reason: 'Matches JD emphasis on clean REST APIs and unit testing.',
          },
        ],
        prepFocusTopics: ['Spring Boot REST exception handling', 'SQL indexing basics'],
        tailoredOutreachHook: 'I recently built OrderTracker in Java/Spring Boot with PostgreSQL and am excited about your Backend Engineer role.',
      };
    });

    try {
      const resumeRes = await fetch(`${baseUrl}/api/ai/resume-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiUser.token}`,
          'x-gemini-api-key': 'user-test-gemini-key',
        },
        body: JSON.stringify({
          fileName: 'Fresher_Resume.PDF',
          mimeType: '',
          fileDataBase64: Buffer.from('%PDF-1.4 mock binary payload').toString('base64'),
          resumeText: 'Fresher Dev\nB.Tech CSE 2026\nJava Spring Boot React PostgreSQL',
        }),
      });
      assert.equal(resumeRes.status, 200);
      const resumeBody = await resumeRes.json();
      assert.equal(resumeBody.resumeContext.fileName, 'Fresher_Resume.PDF');
      assert.deepEqual(resumeBody.user.skills, ['Java', 'Spring Boot', 'React', 'PostgreSQL']);

      const appRes = await fetch(`${baseUrl}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiUser.token}`,
        },
        body: JSON.stringify({
          company: 'Razorpay',
          position: 'Backend Engineer',
          description: 'Requirements\n1+ years experience\nJava, Spring Boot, PostgreSQL, Kafka, Docker',
        }),
      });
      assert.equal(appRes.status, 201);
      const appBody = await appRes.json();

      const matchRes = await fetch(`${baseUrl}/api/ai/match-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiUser.token}`,
          'x-gemini-api-key': 'user-test-gemini-key',
        },
        body: JSON.stringify({ applicationId: appBody.data.id }),
      });
      assert.equal(matchRes.status, 200);
      const matchBody = await matchRes.json();
      assert.equal(matchBody.aiMatch.overallVerdict, 'Good fit with tailoring');
      assert.equal(matchBody.aiMatch.resumeEdits.length, 1);
      assert.equal(matchBody.application.aiMatch.missingKeywords[0], 'Kafka');

      const getApps = await fetch(`${baseUrl}/api/applications`, {
        headers: { Authorization: `Bearer ${aiUser.token}` },
      });
      const getAppsBody = await getApps.json();
      assert.equal(getAppsBody.applications[0].aiMatch.resumeEdits[0].section, 'Project: OrderTracker');

      // Ensure Speakeasy SDK array error bodies unwrap cleanly instead of exposing raw httpMeta
      const { normalizeGeminiApiError } = require('../services/geminiService');
      const unwrapped = normalizeGeminiApiError({
        statusCode: 400,
        body: JSON.stringify([{ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } }]),
        message: '400 API error occurred: {"httpMeta":{"response":{},"request":{}}}',
      });
      assert.equal(unwrapped.statusCode, 400);
      assert.ok(unwrapped.message.includes('Invalid Gemini API key'));

      // Discover selectors: rejects empty payload
      const emptyDomRes = await fetch(`${baseUrl}/api/ai/discover-selectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': 'user-test-gemini-key',
        },
        body: JSON.stringify({ url: 'https://careers.acme.ai/jobs/1', hostname: 'careers.acme.ai' }),
      });
      assert.equal(emptyDomRes.status, 400);

      // Discover selectors: extracts sanitized selectors + fallbackData cleanly
      const domDiscoverRes = await fetch(`${baseUrl}/api/ai/discover-selectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': 'user-test-gemini-key',
        },
        body: JSON.stringify({
          url: 'https://careers.acme.ai/jobs/1',
          hostname: 'careers.acme.ai',
          title: 'Founding Engineer | Acme Labs',
          domSkeleton: '<main><h1 class="role-title">Founding Engineer</h1></main>',
        }),
      });
      assert.equal(domDiscoverRes.status, 200);
      const domDiscoverBody = await domDiscoverRes.json();
      assert.equal(domDiscoverBody.success, true);
      assert.equal(domDiscoverBody.hostname, 'careers.acme.ai');
      assert.equal(domDiscoverBody.selectors.positionSelector, 'main h1.role-title');
      assert.equal(domDiscoverBody.fallbackData.company, 'Acme Labs');

      // High-demand 503 on gemini-4-hydrogen automatically falls back to gemini-3.5-flash-lite
      const fallbackRes = await fetch(`${baseUrl}/api/ai/discover-selectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': 'user-test-gemini-key',
        },
        body: JSON.stringify({
          url: 'https://high-demand-sim.example/jobs/2',
          hostname: 'high-demand-sim.example',
          domSkeleton: '<main><h1 class="role-title">Backend Engineer</h1></main>',
        }),
      });
      assert.equal(fallbackRes.status, 200);
      const fallbackBody = await fallbackRes.json();
      assert.equal(fallbackBody.model, 'gemini-3.5-flash-lite');
      assert.equal(fallbackBody.selectors.positionSelector, 'main h1.role-title');
    } finally {
      setTestInteractionsOverride(null);
      await fetch(`${baseUrl}/api/auth/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${aiUser.token}` },
      });
    }
  });
});
