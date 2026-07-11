# Re-AgentAI Programme Timeline Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Hello World GitHub Pages app with a public-safe executive programme tracker that opens into Project Wallstreet and Mission Control detail pages and is updated through a validated Phase A command workflow.

**Architecture:** Build a dependency-free static site on the existing `gh-pages` branch. Public JSON files are the only browser data source; shared pure functions validate, calculate and render tracker state, while a small browser module fetches the JSON and mounts the executive or project view. A Node standard-library CLI updates task state and keeps the executive roll-up aligned, preserving the same schema for future Phase B automation.

**Tech Stack:** Static HTML5, CSS, browser ES modules, Node.js 20+ standard library, `node:test`, GitHub Pages, GitHub Actions.

## Global Constraints

- Work in `andytayls90-commits/hello-world-test1` from the current `gh-pages` baseline.
- Before implementation, read `GLOBAL_TIMELINE_RULE.md` and `docs/superpowers/specs/2026-07-11-programme-timeline-tracker-design.md`.
- Use an isolated worktree and branch `tracker/v1-executive-dashboard`.
- Do not call private repositories, internal APIs, private URLs or internal services from browser code.
- Do not add third-party runtime dependencies, frameworks, analytics, fonts or CDNs.
- Keep the existing compiled Vite assets inert for first-release rollback; replace only the page entry points and add tracker files.
- Default staleness threshold is exactly `48` hours.
- Allowed task status values are exactly `PLANNED`, `READY`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE`, `SUPERSEDED`, `CANCELLED`, `UNKNOWN`.
- Allowed evidence values are exactly `VERIFIED LIVE`, `SELF-VERIFIED LIVE`, `IMPLEMENTED / UNVERIFIED`, `PARTIAL`, `PLANNED`, `BLOCKED`, `CONTRADICTED`, `UNKNOWN`.
- Never publish credentials, tokens, account identifiers, balances, positions, orders, internal hosts/IPs/ports, private URLs or paths, raw logs, exploitable security details, or personal information.
- Use public-safe summaries and abbreviated commit SHAs of 7–12 hexadecimal characters only.
- Missing or malformed data must display `UNKNOWN`; stale data must show a visible warning.
- Percent completion is derived only from explicit task states; do not fabricate progress from elapsed time.
- Project Wallstreet remains PAPER; this tracker must not expose or alter execution controls.
- The initial implementation uses the bootstrap exception in `GLOBAL_TIMELINE_RULE.md`; normal tracker-first enforcement begins after initial JSON deployment.

---

## File Structure

```text
hello-world-test1/
├── index.html                         Executive overview shell
├── project-wallstreet.html            Trading project shell
├── mission-control.html               Mission Control project shell
├── package.json                       Node test and validation commands
├── assets/
│   ├── tracker-core.mjs               Pure schema, calculation and render functions
│   ├── tracker-app.mjs                Browser fetch/mount controller
│   └── tracker.css                    Responsive accessible presentation
├── data/
│   ├── programme-summary.json         Executive roll-up
│   ├── project-wallstreet.json        Trading milestones/tasks/history
│   └── mission-control.json           Mission Control milestones/tasks/history
├── scripts/
│   ├── validate-data.mjs              Whole-dataset validation and leak scan
│   └── update-task.mjs                Phase A task transition command
├── tests/
│   ├── tracker-core.test.mjs          Pure unit tests
│   ├── update-task.test.mjs           CLI transition/roll-up tests
│   └── static-site.test.mjs           HTML and private-request boundary tests
└── .github/workflows/tracker.yml      Push/PR validation
```

---

### Task 1: Core schema, validation and progress calculations

**Files:**
- Create: `package.json`
- Create: `assets/tracker-core.mjs`
- Create: `tests/tracker-core.test.mjs`

**Interfaces:**
- Produces: `STATUS_VALUES`, `EVIDENCE_VALUES`, `assertProjectData(value)`, `assertSummaryData(value)`, `calculateProgress(tasks)`, `classifyFreshness(updatedAt, now, staleAfterHours)`, `escapeHtml(value)`, `shortSha(value)`.
- Consumed by: browser app, validation script, update CLI and later render tests.

- [ ] **Step 1: Create the Node test harness**

Create `package.json`:

```json
{
  "name": "reagent-programme-tracker",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "validate": "node scripts/validate-data.mjs"
  }
}
```

- [ ] **Step 2: Write failing core tests**

Create `tests/tracker-core.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS_VALUES,
  EVIDENCE_VALUES,
  assertProjectData,
  assertSummaryData,
  calculateProgress,
  classifyFreshness,
  escapeHtml,
  shortSha
} from '../assets/tracker-core.mjs';

const task = (status) => ({
  id: `T-${status}`,
  title: status,
  project: 'Test',
  status,
  owner: 'Claude',
  started_at: null,
  completed_at: status === 'COMPLETE' ? '2026-07-11T10:00:00+10:00' : null,
  target_at: null,
  evidence: status === 'COMPLETE' ? 'IMPLEMENTED / UNVERIFIED' : 'PLANNED',
  commit: status === 'COMPLETE' ? 'abcdef1' : null,
  summary: 'Public-safe summary',
  blockers: [],
  next_action: status === 'COMPLETE' ? 'Review next task' : 'Continue',
  updated_at: '2026-07-11T10:00:00+10:00'
});

const project = {
  schema_version: 1,
  project_id: 'test-project',
  project_name: 'Test Project',
  status: 'IN_PROGRESS',
  evidence: 'PARTIAL',
  updated_at: '2026-07-11T10:00:00+10:00',
  stale_after_hours: 48,
  current_task_id: 'T-IN_PROGRESS',
  next_action: 'Continue',
  milestones: [{ id: 'M0', title: 'Baseline', status: 'IN_PROGRESS', task_ids: ['T-IN_PROGRESS'] }],
  tasks: [task('IN_PROGRESS')],
  history: []
};

test('published enums remain exact', () => {
  assert.deepEqual(STATUS_VALUES, ['PLANNED','READY','IN_PROGRESS','BLOCKED','COMPLETE','SUPERSEDED','CANCELLED','UNKNOWN']);
  assert.deepEqual(EVIDENCE_VALUES, ['VERIFIED LIVE','SELF-VERIFIED LIVE','IMPLEMENTED / UNVERIFIED','PARTIAL','PLANNED','BLOCKED','CONTRADICTED','UNKNOWN']);
});

test('project validation accepts the canonical shape', () => {
  assert.equal(assertProjectData(project), true);
});

test('project validation rejects an unknown status', () => {
  assert.throws(() => assertProjectData({ ...project, status: 'DONE' }), /status/);
});

test('progress counts COMPLETE only and excludes cancelled or superseded work', () => {
  const result = calculateProgress([
    task('COMPLETE'), task('IN_PROGRESS'), task('PLANNED'), task('CANCELLED'), task('SUPERSEDED')
  ]);
  assert.deepEqual(result, { complete: 1, total: 3, percent: 33 });
});

test('freshness is fresh at exactly 48 hours and stale after it', () => {
  const updated = '2026-07-09T10:00:00Z';
  assert.equal(classifyFreshness(updated, new Date('2026-07-11T10:00:00Z'), 48).state, 'FRESH');
  assert.equal(classifyFreshness(updated, new Date('2026-07-11T10:00:01Z'), 48).state, 'STALE');
});

test('HTML and SHA helpers are public-safe', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(shortSha('ABCDEF1234567890'), 'abcdef123456');
  assert.equal(shortSha('not-a-sha'), null);
});

test('summary validation rejects a project entry without a detail page', () => {
  assert.throws(() => assertSummaryData({
    schema_version: 1,
    programme_name: 'Re-AgentAI',
    status: 'IN_PROGRESS',
    evidence: 'PARTIAL',
    updated_at: '2026-07-11T10:00:00+10:00',
    stale_after_hours: 48,
    projects: [{ project_id: 'x' }]
  }), /detail_page/);
});
```

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
npm test
```

Expected: failure because `assets/tracker-core.mjs` does not exist.

- [ ] **Step 4: Implement the core module**

Create `assets/tracker-core.mjs`:

```js
export const STATUS_VALUES = Object.freeze([
  'PLANNED','READY','IN_PROGRESS','BLOCKED','COMPLETE','SUPERSEDED','CANCELLED','UNKNOWN'
]);

export const EVIDENCE_VALUES = Object.freeze([
  'VERIFIED LIVE','SELF-VERIFIED LIVE','IMPLEMENTED / UNVERIFIED','PARTIAL',
  'PLANNED','BLOCKED','CONTRADICTED','UNKNOWN'
]);

const STATUS_SET = new Set(STATUS_VALUES);
const EVIDENCE_SET = new Set(EVIDENCE_VALUES);
const ACTIVE_PROGRESS = new Set(['PLANNED','READY','IN_PROGRESS','BLOCKED','COMPLETE','UNKNOWN']);
const SHA_RE = /^[0-9a-f]{7,12}$/i;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function requireIsoOrNull(value, name) {
  if (value === null) return;
  requireString(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be ISO-8601 or null`);
}

function validateTask(value, projectName) {
  requireObject(value, 'task');
  for (const field of ['id','title','project','status','owner','evidence','summary','next_action','updated_at']) {
    requireString(value[field], `task.${field}`);
  }
  if (value.project !== projectName) throw new TypeError('task.project must match project_name');
  if (!STATUS_SET.has(value.status)) throw new TypeError('task.status is invalid');
  if (!EVIDENCE_SET.has(value.evidence)) throw new TypeError('task.evidence is invalid');
  if (!Array.isArray(value.blockers) || value.blockers.some((item) => typeof item !== 'string')) {
    throw new TypeError('task.blockers must be an array of strings');
  }
  requireIsoOrNull(value.started_at, 'task.started_at');
  requireIsoOrNull(value.completed_at, 'task.completed_at');
  requireIsoOrNull(value.target_at, 'task.target_at');
  requireIsoOrNull(value.updated_at, 'task.updated_at');
  if (value.commit !== null && !SHA_RE.test(value.commit)) throw new TypeError('task.commit must be an abbreviated SHA or null');
}

export function assertProjectData(value) {
  requireObject(value, 'project');
  if (value.schema_version !== 1) throw new TypeError('schema_version must be 1');
  for (const field of ['project_id','project_name','status','evidence','updated_at','next_action']) {
    requireString(value[field], field);
  }
  if (!STATUS_SET.has(value.status)) throw new TypeError('status is invalid');
  if (!EVIDENCE_SET.has(value.evidence)) throw new TypeError('evidence is invalid');
  if (value.stale_after_hours !== 48) throw new TypeError('stale_after_hours must be 48');
  if (!Array.isArray(value.tasks) || !Array.isArray(value.milestones) || !Array.isArray(value.history)) {
    throw new TypeError('tasks, milestones and history must be arrays');
  }
  value.tasks.forEach((item) => validateTask(item, value.project_name));
  const ids = new Set(value.tasks.map((item) => item.id));
  if (ids.size !== value.tasks.length) throw new TypeError('task ids must be unique');
  for (const milestone of value.milestones) {
    requireObject(milestone, 'milestone');
    requireString(milestone.id, 'milestone.id');
    requireString(milestone.title, 'milestone.title');
    if (!STATUS_SET.has(milestone.status)) throw new TypeError('milestone.status is invalid');
    if (!Array.isArray(milestone.task_ids) || milestone.task_ids.some((id) => !ids.has(id))) {
      throw new TypeError('milestone.task_ids must reference existing tasks');
    }
  }
  requireIsoOrNull(value.updated_at, 'updated_at');
  return true;
}

export function assertSummaryData(value) {
  requireObject(value, 'summary');
  if (value.schema_version !== 1) throw new TypeError('schema_version must be 1');
  for (const field of ['programme_name','status','evidence','updated_at']) requireString(value[field], field);
  if (!STATUS_SET.has(value.status)) throw new TypeError('status is invalid');
  if (!EVIDENCE_SET.has(value.evidence)) throw new TypeError('evidence is invalid');
  if (value.stale_after_hours !== 48) throw new TypeError('stale_after_hours must be 48');
  if (!Array.isArray(value.projects) || value.projects.length === 0) throw new TypeError('projects must be non-empty');
  for (const project of value.projects) {
    requireObject(project, 'summary project');
    for (const field of ['project_id','project_name','status','evidence','detail_page','data_file','next_action','updated_at']) {
      requireString(project[field], `summary project.${field}`);
    }
    if (!STATUS_SET.has(project.status)) throw new TypeError('summary project.status is invalid');
    if (!EVIDENCE_SET.has(project.evidence)) throw new TypeError('summary project.evidence is invalid');
    if (!project.detail_page.endsWith('.html')) throw new TypeError('summary project.detail_page must be html');
    if (!project.data_file.startsWith('data/')) throw new TypeError('summary project.data_file must be public data');
  }
  return true;
}

export function calculateProgress(tasks) {
  const included = tasks.filter((task) => ACTIVE_PROGRESS.has(task.status));
  const complete = included.filter((task) => task.status === 'COMPLETE').length;
  const total = included.length;
  return { complete, total, percent: total === 0 ? 0 : Math.round((complete / total) * 100) };
}

export function classifyFreshness(updatedAt, now = new Date(), staleAfterHours = 48) {
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return { state: 'UNKNOWN', age_hours: null };
  const ageHours = Math.max(0, (now.getTime() - updated.getTime()) / 3_600_000);
  return { state: ageHours > staleAfterHours ? 'STALE' : 'FRESH', age_hours: Math.round(ageHours * 10) / 10 };
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

export function shortSha(value) {
  if (typeof value !== 'string' || !SHA_RE.test(value)) return null;
  return value.toLowerCase().slice(0, 12);
}
```

- [ ] **Step 5: Run core tests**

Run:

```bash
npm test
```

Expected: all tests in `tracker-core.test.mjs` pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add package.json assets/tracker-core.mjs tests/tracker-core.test.mjs
git commit -m "feat(tracker): add public timeline data contract"
```

---

### Task 2: Initial public data, validation and Phase A update command

**Files:**
- Create: `data/programme-summary.json`
- Create: `data/project-wallstreet.json`
- Create: `data/mission-control.json`
- Create: `scripts/validate-data.mjs`
- Create: `scripts/update-task.mjs`
- Create: `tests/update-task.test.mjs`

**Interfaces:**
- Consumes: validation functions from `assets/tracker-core.mjs`.
- Produces: `updateTask({ rootDir, projectId, taskId, status, owner, evidence, commit, summary, nextAction, blockers })` and three validated public data files.

- [ ] **Step 1: Reconcile the initial seed before writing JSON**

Run these read-only checks in the private repositories:

```bash
git -C ~/wallstreet-dashboard fetch origin
git -C ~/wallstreet-dashboard log -1 --oneline origin/master
git -C ~/mission-control fetch origin
git -C ~/mission-control log -1 --oneline origin/master
```

Read the latest committed programme/review files. If Project Wallstreet has advanced beyond M1.2, seed the actual later state rather than reverting it. Mission Control must be seeded `UNKNOWN` unless committed evidence supports a more specific public-safe milestone state.

- [ ] **Step 2: Write failing update-command tests**

Create `tests/update-task.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { updateTask } from '../scripts/update-task.mjs';

const project = {
  schema_version: 1,
  project_id: 'project-wallstreet',
  project_name: 'Project Wallstreet',
  status: 'READY',
  evidence: 'PLANNED',
  updated_at: '2026-07-11T00:00:00+10:00',
  stale_after_hours: 48,
  current_task_id: 'M1.3',
  next_action: 'Start M1.3',
  milestones: [{ id: 'M1', title: 'Execution foundation', status: 'READY', task_ids: ['M1.3'] }],
  tasks: [{
    id: 'M1.3', title: 'Account truth and market clock', project: 'Project Wallstreet',
    status: 'READY', owner: 'Unassigned', started_at: null, completed_at: null, target_at: null,
    evidence: 'PLANNED', commit: null, summary: 'Public-safe task', blockers: [],
    next_action: 'Start M1.3', updated_at: '2026-07-11T00:00:00+10:00'
  }],
  history: []
};

const summary = {
  schema_version: 1,
  programme_name: 'Re-AgentAI',
  status: 'READY',
  evidence: 'PARTIAL',
  updated_at: '2026-07-11T00:00:00+10:00',
  stale_after_hours: 48,
  projects: [{
    project_id: 'project-wallstreet', project_name: 'Project Wallstreet', status: 'READY',
    evidence: 'PLANNED', detail_page: 'project-wallstreet.html',
    data_file: 'data/project-wallstreet.json', current_task_id: 'M1.3',
    progress: { complete: 0, total: 1, percent: 0 }, next_action: 'Start M1.3',
    updated_at: '2026-07-11T00:00:00+10:00'
  }]
};

async function fixture() {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'tracker-'));
  await mkdir(path.join(rootDir, 'data'));
  await writeFile(path.join(rootDir, 'data/project-wallstreet.json'), JSON.stringify(project, null, 2));
  await writeFile(path.join(rootDir, 'data/programme-summary.json'), JSON.stringify(summary, null, 2));
  return rootDir;
}

test('READY to IN_PROGRESS updates project, summary and history', async () => {
  const rootDir = await fixture();
  await updateTask({
    rootDir, projectId: 'project-wallstreet', taskId: 'M1.3', status: 'IN_PROGRESS',
    owner: 'Claude', evidence: 'PLANNED', commit: null,
    summary: 'Implement PAPER preflight truth checks', nextAction: 'Run fail-first tests', blockers: [],
    now: '2026-07-11T12:30:00+10:00'
  });
  const next = JSON.parse(await readFile(path.join(rootDir, 'data/project-wallstreet.json'), 'utf8'));
  const rollup = JSON.parse(await readFile(path.join(rootDir, 'data/programme-summary.json'), 'utf8'));
  assert.equal(next.tasks[0].status, 'IN_PROGRESS');
  assert.equal(next.tasks[0].started_at, '2026-07-11T12:30:00+10:00');
  assert.equal(next.history.at(-1).to, 'IN_PROGRESS');
  assert.equal(rollup.projects[0].status, 'IN_PROGRESS');
});

test('COMPLETE requires evidence and SHA', async () => {
  const rootDir = await fixture();
  await assert.rejects(() => updateTask({
    rootDir, projectId: 'project-wallstreet', taskId: 'M1.3', status: 'COMPLETE',
    owner: 'Claude', evidence: 'PLANNED', commit: null,
    summary: 'Closed', nextAction: 'Review', blockers: [],
    now: '2026-07-11T13:00:00+10:00'
  }), /COMPLETE requires/);
});

test('public leak patterns are rejected', async () => {
  const rootDir = await fixture();
  await assert.rejects(() => updateTask({
    rootDir, projectId: 'project-wallstreet', taskId: 'M1.3', status: 'BLOCKED',
    owner: 'Claude', evidence: 'BLOCKED', commit: null,
    summary: 'Blocked at http://127.0.0.1:8010', nextAction: 'Review', blockers: ['Internal endpoint'],
    now: '2026-07-11T13:00:00+10:00'
  }), /public information boundary/);
});
```

- [ ] **Step 3: Run tests and confirm failure**

```bash
npm test
```

Expected: failure because `scripts/update-task.mjs` does not exist.

- [ ] **Step 4: Implement dataset validation**

Create `scripts/validate-data.mjs`:

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProjectData, assertSummaryData } from '../assets/tracker-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE_PATTERNS = [
  /(?:api[_-]?key|secret|token|password)\s*[:=]/i,
  /\b(?:127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)\b/i,
  /:\d{2,5}\b/,
  /\/home\//i,
  /broker.{0,20}(?:balance|position|order|account)/i
];

export function assertPublicSafe(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const match = PRIVATE_PATTERNS.find((pattern) => pattern.test(text));
  if (match) throw new Error(`public information boundary violation: ${match}`);
  return true;
}

export async function validateAll(rootDir = ROOT) {
  const summary = JSON.parse(await readFile(path.join(rootDir, 'data/programme-summary.json'), 'utf8'));
  assertSummaryData(summary);
  assertPublicSafe(summary);
  const projects = [];
  for (const item of summary.projects) {
    const project = JSON.parse(await readFile(path.join(rootDir, item.data_file), 'utf8'));
    assertProjectData(project);
    assertPublicSafe(project);
    if (project.project_id !== item.project_id) throw new Error(`project id mismatch: ${item.project_id}`);
    projects.push(project);
  }
  return { summary, projects };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateAll().then(({ projects }) => {
    console.log(`tracker data valid: ${projects.length} projects`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 5: Implement the Phase A transition command**

Create `scripts/update-task.mjs`:

```js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATUS_VALUES, EVIDENCE_VALUES, assertProjectData, assertSummaryData, calculateProgress, shortSha
} from '../assets/tracker-core.mjs';
import { assertPublicSafe } from './validate-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function updateTask({
  rootDir = ROOT, projectId, taskId, status, owner, evidence, commit,
  summary, nextAction, blockers = [], now = new Date().toISOString()
}) {
  if (!STATUS_VALUES.includes(status)) throw new Error(`invalid status: ${status}`);
  if (!EVIDENCE_VALUES.includes(evidence)) throw new Error(`invalid evidence: ${evidence}`);
  const safeSha = commit === null ? null : shortSha(commit);
  if (commit !== null && !safeSha) throw new Error('commit must be a 7-12 character hexadecimal SHA');
  if (status === 'COMPLETE' && (['PLANNED','BLOCKED','UNKNOWN'].includes(evidence) || safeSha === null)) {
    throw new Error('COMPLETE requires non-provisional evidence and an abbreviated commit SHA');
  }
  assertPublicSafe({ owner, summary, nextAction, blockers });

  const projectFile = path.join(rootDir, `data/${projectId}.json`);
  const summaryFile = path.join(rootDir, 'data/programme-summary.json');
  const project = await readJson(projectFile);
  const rollup = await readJson(summaryFile);
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`task not found: ${taskId}`);
  const previous = task.status;

  Object.assign(task, {
    status, owner, evidence, commit: safeSha, summary, blockers, next_action: nextAction, updated_at: now
  });
  if (status === 'IN_PROGRESS' && task.started_at === null) task.started_at = now;
  if (status === 'COMPLETE') task.completed_at = now;
  if (status !== 'COMPLETE') task.completed_at = null;

  project.history.push({ task_id: taskId, from: previous, to: status, at: now, evidence, commit: safeSha });
  project.current_task_id = ['IN_PROGRESS','BLOCKED'].includes(status) ? taskId : project.current_task_id;
  project.status = status;
  project.evidence = evidence;
  project.next_action = nextAction;
  project.updated_at = now;
  const milestone = project.milestones.find((item) => item.task_ids.includes(taskId));
  if (milestone) {
    const states = milestone.task_ids.map((id) => project.tasks.find((item) => item.id === id)?.status ?? 'UNKNOWN');
    milestone.status = states.every((item) => item === 'COMPLETE') ? 'COMPLETE'
      : states.some((item) => item === 'BLOCKED') ? 'BLOCKED'
      : states.some((item) => item === 'IN_PROGRESS') ? 'IN_PROGRESS'
      : states.some((item) => item === 'READY') ? 'READY' : 'PLANNED';
  }

  const card = rollup.projects.find((item) => item.project_id === projectId);
  if (!card) throw new Error(`summary project not found: ${projectId}`);
  Object.assign(card, {
    status: project.status,
    evidence: project.evidence,
    current_task_id: project.current_task_id,
    progress: calculateProgress(project.tasks),
    next_action: project.next_action,
    updated_at: now
  });
  rollup.updated_at = now;
  rollup.status = rollup.projects.some((item) => item.status === 'BLOCKED') ? 'BLOCKED'
    : rollup.projects.some((item) => item.status === 'IN_PROGRESS') ? 'IN_PROGRESS'
    : rollup.projects.every((item) => item.status === 'COMPLETE') ? 'COMPLETE' : 'READY';
  rollup.evidence = rollup.projects.every((item) => item.evidence === 'VERIFIED LIVE')
    ? 'VERIFIED LIVE' : 'PARTIAL';

  assertProjectData(project);
  assertSummaryData(rollup);
  assertPublicSafe(project);
  assertPublicSafe(rollup);
  await writeJson(projectFile, project);
  await writeJson(summaryFile, rollup);
  return { project, summary: rollup };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) values[argv[index].replace(/^--/, '')] = argv[index + 1];
  return values;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  updateTask({
    projectId: args.project,
    taskId: args.task,
    status: args.status,
    owner: args.owner,
    evidence: args.evidence,
    commit: args.commit === 'null' || args.commit === undefined ? null : args.commit,
    summary: args.summary,
    nextAction: args.next,
    blockers: args.blocker ? [args.blocker] : []
  }).then(() => console.log(`tracker updated: ${args.project}/${args.task} -> ${args.status}`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
```

- [ ] **Step 6: Create the initial JSON files**

Create `data/project-wallstreet.json` using the current reconciled state. At minimum it must include M0–M7 plus M1.1, M1.2, M1.3 and M1 integrated review as explicit tasks. Use these public-safe states unless later committed evidence exists at execution time:

```json
{
  "schema_version": 1,
  "project_id": "project-wallstreet",
  "project_name": "Project Wallstreet",
  "status": "READY",
  "evidence": "PARTIAL",
  "updated_at": "2026-07-11T00:00:00+10:00",
  "stale_after_hours": 48,
  "current_task_id": "M1.3",
  "next_action": "Begin M1.3 account-truth and market-clock preflight packet",
  "milestones": [
    { "id": "M0", "title": "Baseline and freeze", "status": "COMPLETE", "task_ids": ["M0"] },
    { "id": "M1", "title": "Execution foundation", "status": "READY", "task_ids": ["M1.1","M1.2","M1.3","M1-REVIEW"] },
    { "id": "M2", "title": "Live equities", "status": "PLANNED", "task_ids": ["M2"] },
    { "id": "M3", "title": "Operational stability", "status": "PLANNED", "task_ids": ["M3"] },
    { "id": "M4", "title": "Autonomous equities", "status": "PLANNED", "task_ids": ["M4"] },
    { "id": "M5", "title": "Options", "status": "PLANNED", "task_ids": ["M5"] },
    { "id": "M6", "title": "Scaling and portfolio", "status": "PLANNED", "task_ids": ["M6"] },
    { "id": "M7", "title": "Full operations", "status": "PLANNED", "task_ids": ["M7"] }
  ],
  "tasks": [],
  "history": []
}
```

Populate `tasks` with complete canonical task objects. Use the known public-safe abbreviated SHAs for completed packets: M0 `9a96613`, M1.1 `b6bcae4`, M1.2 `4525b11`. Mark M1.3 `READY`, M1-REVIEW and M2–M7 `PLANNED`. Replace the example `updated_at` with the actual Australia/Sydney implementation timestamp.

Create `data/mission-control.json` with one baseline milestone and one task:

```json
{
  "schema_version": 1,
  "project_id": "mission-control",
  "project_name": "Mission Control",
  "status": "READY",
  "evidence": "UNKNOWN",
  "updated_at": "2026-07-11T00:00:00+10:00",
  "stale_after_hours": 48,
  "current_task_id": "MC-BASELINE",
  "next_action": "Reconcile committed Mission Control milestones into the public-safe tracker",
  "milestones": [
    { "id": "MC0", "title": "Public programme baseline", "status": "READY", "task_ids": ["MC-BASELINE"] }
  ],
  "tasks": [{
    "id": "MC-BASELINE",
    "title": "Establish public Mission Control timeline",
    "project": "Mission Control",
    "status": "READY",
    "owner": "Unassigned",
    "started_at": null,
    "completed_at": null,
    "target_at": null,
    "evidence": "UNKNOWN",
    "commit": null,
    "summary": "Reconcile committed Mission Control work into a public-safe milestone baseline.",
    "blockers": [],
    "next_action": "Review committed Mission Control programme evidence",
    "updated_at": "2026-07-11T00:00:00+10:00"
  }],
  "history": []
}
```

Replace the example timestamp with the same actual implementation timestamp.

Create `data/programme-summary.json` with cards for both projects, exact detail pages/data files and progress calculated from the project task arrays.

- [ ] **Step 7: Run tests and dataset validation**

```bash
npm test
npm run validate
```

Expected:

```text
tracker data valid: 2 projects
```

- [ ] **Step 8: Exercise the transition command in a temporary fixture only**

```bash
npm test -- --test-name-pattern="READY to IN_PROGRESS"
```

Expected: PASS. Do not change the real M1.3 state unless the private repository confirms it has actually started.

- [ ] **Step 9: Commit Task 2**

```bash
git add data scripts tests/update-task.test.mjs
git commit -m "feat(tracker): add validated public programme data workflow"
```

---

### Task 3: Pure rendering functions and browser controller

**Files:**
- Modify: `assets/tracker-core.mjs`
- Create: `assets/tracker-app.mjs`
- Modify: `tests/tracker-core.test.mjs`

**Interfaces:**
- Produces: `renderExecutive(summary, projects, now)`, `renderProject(project, now)`, `loadJson(url, fetchImpl)`, `mountTracker(document, fetchImpl)`.

- [ ] **Step 1: Add failing renderer tests**

Append to `tests/tracker-core.test.mjs`:

```js
import { renderExecutive, renderProject } from '../assets/tracker-core.mjs';

test('executive rendering shows project navigation and stale state', () => {
  const summary = {
    schema_version: 1, programme_name: 'Re-AgentAI', status: 'IN_PROGRESS', evidence: 'PARTIAL',
    updated_at: '2026-07-01T00:00:00Z', stale_after_hours: 48,
    projects: [{
      project_id: 'project-wallstreet', project_name: 'Project Wallstreet', status: 'IN_PROGRESS',
      evidence: 'PARTIAL', detail_page: 'project-wallstreet.html',
      data_file: 'data/project-wallstreet.json', current_task_id: 'M1.3',
      progress: { complete: 3, total: 11, percent: 27 }, next_action: 'Continue M1.3',
      updated_at: '2026-07-01T00:00:00Z'
    }]
  };
  const html = renderExecutive(summary, [], new Date('2026-07-11T00:00:00Z'));
  assert.match(html, /Project Wallstreet/);
  assert.match(html, /project-wallstreet\.html/);
  assert.match(html, /STALE/);
  assert.match(html, /27%/);
});

test('project rendering escapes public text and exposes UNKNOWN source state', () => {
  const malformedSafeProject = {
    ...project,
    project_name: 'Test <Project>',
    tasks: [{ ...project.tasks[0], project: 'Test <Project>', summary: '<script>alert(1)</script>' }]
  };
  const html = renderProject(malformedSafeProject, new Date('2026-07-11T00:00:00Z'));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm test
```

Expected: failure because the renderer exports do not exist.

- [ ] **Step 3: Add renderer implementations**

Append focused rendering functions to `assets/tracker-core.mjs`. Use semantic HTML and escaped values. The required structure is:

```js
function badge(value, kind = 'status') {
  return `<span class="badge badge--${escapeHtml(String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'))}" data-kind="${kind}">${escapeHtml(value)}</span>`;
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney'
  }).format(date);
}

function freshnessBanner(updatedAt, staleAfterHours, now) {
  const freshness = classifyFreshness(updatedAt, now, staleAfterHours);
  if (freshness.state === 'FRESH') return '';
  return `<div class="notice notice--warning" role="status">${badge(freshness.state)} Data age: ${freshness.age_hours ?? 'unknown'} hours.</div>`;
}

export function renderExecutive(summary, projects = [], now = new Date()) {
  const cards = summary.projects.map((project) => `
    <article class="project-card">
      <div class="project-card__head"><h2>${escapeHtml(project.project_name)}</h2>${badge(project.status)}</div>
      <p>${badge(project.evidence, 'evidence')}</p>
      <div class="progress" aria-label="${project.progress.percent}% complete">
        <span style="width:${project.progress.percent}%"></span>
      </div>
      <p><strong>${project.progress.percent}%</strong> · ${project.progress.complete}/${project.progress.total} counted tasks complete</p>
      <p><strong>Current:</strong> ${escapeHtml(project.current_task_id ?? 'UNKNOWN')}</p>
      <p><strong>Next:</strong> ${escapeHtml(project.next_action)}</p>
      <p class="muted">Updated ${escapeHtml(formatDate(project.updated_at))}</p>
      <a class="button" href="${escapeHtml(project.detail_page)}">Open ${escapeHtml(project.project_name)}</a>
    </article>`).join('');
  return `${freshnessBanner(summary.updated_at, summary.stale_after_hours, now)}
    <section class="hero"><p class="eyebrow">Executive oversight</p><h1>${escapeHtml(summary.programme_name)}</h1>
    <p>${badge(summary.status)} ${badge(summary.evidence, 'evidence')}</p></section>
    <section class="project-grid" aria-label="Projects">${cards}</section>`;
}

export function renderProject(project, now = new Date()) {
  const progress = calculateProgress(project.tasks);
  const milestones = project.milestones.map((milestone) => `
    <section class="milestone">
      <div class="milestone__head"><h2>${escapeHtml(milestone.id)} · ${escapeHtml(milestone.title)}</h2>${badge(milestone.status)}</div>
      <div class="task-list">${milestone.task_ids.map((id) => {
        const task = project.tasks.find((item) => item.id === id);
        if (!task) return `<article class="task task--unknown"><h3>${escapeHtml(id)}</h3>${badge('UNKNOWN')}</article>`;
        return `<article class="task">
          <div class="task__head"><h3>${escapeHtml(task.id)} · ${escapeHtml(task.title)}</h3>${badge(task.status)}</div>
          <p>${escapeHtml(task.summary)}</p>
          <dl><dt>Owner</dt><dd>${escapeHtml(task.owner)}</dd><dt>Evidence</dt><dd>${badge(task.evidence, 'evidence')}</dd>
          <dt>Commit</dt><dd>${escapeHtml(task.commit ?? 'Not recorded')}</dd><dt>Updated</dt><dd>${escapeHtml(formatDate(task.updated_at))}</dd></dl>
          ${task.blockers.length ? `<div class="notice notice--blocked"><strong>Blockers:</strong> ${task.blockers.map(escapeHtml).join('; ')}</div>` : ''}
          <p><strong>Next:</strong> ${escapeHtml(task.next_action)}</p>
        </article>`;
      }).join('')}</div>
    </section>`).join('');
  return `${freshnessBanner(project.updated_at, project.stale_after_hours, now)}
    <section class="hero"><a href="index.html" class="back-link">← Executive overview</a><p class="eyebrow">Project timeline</p>
    <h1>${escapeHtml(project.project_name)}</h1><p>${badge(project.status)} ${badge(project.evidence, 'evidence')}</p>
    <div class="progress" aria-label="${progress.percent}% complete"><span style="width:${progress.percent}%"></span></div>
    <p>${progress.complete}/${progress.total} counted tasks complete · Updated ${escapeHtml(formatDate(project.updated_at))}</p></section>${milestones}`;
}
```

- [ ] **Step 4: Create browser fetch/mount controller**

Create `assets/tracker-app.mjs`:

```js
import { assertProjectData, assertSummaryData, renderExecutive, renderProject, escapeHtml } from './tracker-core.mjs';

export async function loadJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(`${url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function renderUnknown(root, message) {
  root.innerHTML = `<section class="notice notice--error" role="alert"><h1>Tracker state UNKNOWN</h1><p>${escapeHtml(message)}</p></section>`;
}

export async function mountTracker(documentRef = document, fetchImpl = fetch) {
  const root = documentRef.querySelector('#tracker-root');
  if (!root) throw new Error('tracker root missing');
  const page = documentRef.body.dataset.page;
  try {
    if (page === 'executive') {
      const summary = await loadJson('data/programme-summary.json', fetchImpl);
      assertSummaryData(summary);
      const projects = await Promise.all(summary.projects.map(async (item) => {
        const value = await loadJson(item.data_file, fetchImpl);
        assertProjectData(value);
        return value;
      }));
      root.innerHTML = renderExecutive(summary, projects);
      return;
    }
    if (page === 'project') {
      const source = documentRef.body.dataset.source;
      if (!source?.startsWith('data/')) throw new Error('public data source missing');
      const project = await loadJson(source, fetchImpl);
      assertProjectData(project);
      root.innerHTML = renderProject(project);
      return;
    }
    throw new Error(`unknown page mode: ${page}`);
  } catch (error) {
    renderUnknown(root, error.message);
  }
}

if (typeof document !== 'undefined') mountTracker();
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: renderer and existing tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add assets tests/tracker-core.test.mjs
git commit -m "feat(tracker): add executive and project renderers"
```

---

### Task 4: Accessible responsive pages and presentation

**Files:**
- Replace: `index.html`
- Create: `project-wallstreet.html`
- Create: `mission-control.html`
- Create: `assets/tracker.css`
- Create: `tests/static-site.test.mjs`

**Interfaces:**
- Consumes: `assets/tracker-app.mjs` and public JSON files.
- Produces: three public GitHub Pages entry points.

- [ ] **Step 1: Write failing static-site tests**

Create `tests/static-site.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = ['index.html', 'project-wallstreet.html', 'mission-control.html'];

test('all pages use the shared public tracker assets', async () => {
  for (const page of pages) {
    const html = await readFile(page, 'utf8');
    assert.match(html, /assets\/tracker\.css/);
    assert.match(html, /assets\/tracker-app\.mjs/);
    assert.match(html, /id="tracker-root"/);
    assert.match(html, /<meta name="viewport"/);
  }
});

test('project pages point only to public JSON files', async () => {
  const wallstreet = await readFile('project-wallstreet.html', 'utf8');
  const mission = await readFile('mission-control.html', 'utf8');
  assert.match(wallstreet, /data-source="data\/project-wallstreet\.json"/);
  assert.match(mission, /data-source="data\/mission-control\.json"/);
});

test('site source has no private runtime request targets', async () => {
  for (const file of [...pages, 'assets/tracker-app.mjs']) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|api\.github\.com\/repos\/andytayls90-commits\/(?:Project-wallstreet|mission-control)/i);
  }
});
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npm test
```

Expected: failures because the new pages and CSS do not yet exist and `index.html` still references the old Vite bundle.

- [ ] **Step 3: Replace the executive entry page**

Replace `index.html` with:

```html
<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Public-safe Re-AgentAI programme timeline and milestone tracker.">
  <title>Re-AgentAI Programme Tracker</title>
  <link rel="stylesheet" href="assets/tracker.css">
</head>
<body data-page="executive">
  <header class="site-header"><a href="index.html" class="brand">RE-AGENTAI</a><span>Programme Tracker</span></header>
  <main id="tracker-root" class="shell" aria-live="polite"><p class="loading">Loading programme state…</p></main>
  <footer class="site-footer">Public-safe oversight data only · No broker or private operational data</footer>
  <script type="module" src="assets/tracker-app.mjs"></script>
</body>
</html>
```

- [ ] **Step 4: Create the two project entry pages**

Create `project-wallstreet.html` with the same head/header/footer and:

```html
<body data-page="project" data-source="data/project-wallstreet.json">
```

Create `mission-control.html` with:

```html
<body data-page="project" data-source="data/mission-control.json">
```

Both pages must use `id="tracker-root"`, `assets/tracker.css` and `assets/tracker-app.mjs` exactly as the executive page does.

- [ ] **Step 5: Add responsive accessible styling**

Create `assets/tracker.css`:

```css
:root{color-scheme:dark;--bg:#071019;--panel:#101c28;--panel2:#152536;--text:#edf5fb;--muted:#9eb1c1;--line:#294158;--accent:#62d5ff;--good:#71e6a2;--warn:#ffc857;--bad:#ff7b86;--unknown:#a8b3bd;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#10283a 0,var(--bg) 42%);color:var(--text);min-height:100vh}a{color:inherit}.site-header,.site-footer{display:flex;justify-content:space-between;gap:1rem;padding:1rem clamp(1rem,4vw,3rem);border-color:var(--line);background:rgba(7,16,25,.88);backdrop-filter:blur(12px)}.site-header{position:sticky;top:0;z-index:10;border-bottom:1px solid var(--line)}.site-footer{border-top:1px solid var(--line);color:var(--muted);margin-top:3rem}.brand{font-weight:800;letter-spacing:.12em;text-decoration:none}.shell{width:min(1180px,calc(100% - 2rem));margin:0 auto;padding:clamp(2rem,5vw,4rem) 0}.hero,.project-card,.milestone,.notice{border:1px solid var(--line);background:linear-gradient(145deg,rgba(21,37,54,.96),rgba(12,25,36,.96));border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.hero{padding:clamp(1.5rem,4vw,3rem);margin-bottom:1.5rem}.hero h1{font-size:clamp(2rem,6vw,4.5rem);line-height:1;margin:.3rem 0 1rem}.eyebrow{color:var(--accent);font-weight:750;letter-spacing:.14em;text-transform:uppercase}.project-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.project-card,.milestone{padding:1.25rem}.project-card__head,.milestone__head,.task__head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.project-card h2,.milestone h2,.task h3{margin:.2rem 0}.button{display:inline-flex;padding:.75rem 1rem;border:1px solid var(--accent);border-radius:10px;text-decoration:none;font-weight:700}.button:hover,.button:focus-visible{background:var(--accent);color:#041019}.progress{height:10px;background:#061018;border:1px solid var(--line);border-radius:999px;overflow:hidden}.progress span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--good))}.badge{display:inline-flex;align-items:center;border:1px solid currentColor;border-radius:999px;padding:.2rem .55rem;font-size:.72rem;font-weight:800;letter-spacing:.04em}.badge--complete,.badge--verified-live,.badge--self-verified-live{color:var(--good)}.badge--in-progress,.badge--ready,.badge--partial{color:var(--accent)}.badge--blocked,.badge--contradicted{color:var(--bad)}.badge--planned{color:var(--warn)}.badge--unknown,.badge--stale{color:var(--unknown)}.milestone{margin:1rem 0}.task-list{display:grid;gap:.8rem;margin-top:1rem}.task{padding:1rem;border:1px solid var(--line);border-radius:12px;background:rgba(5,14,22,.5)}dl{display:grid;grid-template-columns:max-content 1fr;gap:.3rem .8rem}dt{color:var(--muted)}dd{margin:0}.notice{padding:1rem;margin-bottom:1rem}.notice--warning{border-color:var(--warn)}.notice--error,.notice--blocked{border-color:var(--bad)}.muted,.loading{color:var(--muted)}.back-link{display:inline-block;margin-bottom:1rem}@media(max-width:620px){.site-header{align-items:flex-start;flex-direction:column}.project-card__head,.milestone__head,.task__head{align-items:flex-start;flex-direction:column}dl{grid-template-columns:1fr}.shell{width:min(100% - 1rem,1180px)}}@media(prefers-reduced-motion:no-preference){.project-card,.task{transition:transform .18s ease,border-color .18s ease}.project-card:hover{transform:translateY(-2px);border-color:var(--accent)}}
```

- [ ] **Step 6: Run tests and validation**

```bash
npm test
npm run validate
```

Expected: all tests pass and both project data files validate.

- [ ] **Step 7: Run a local static server and inspect all pages**

```bash
python3 -m http.server 4173
```

In another terminal:

```bash
curl -fsS http://127.0.0.1:4173/index.html | grep -F 'tracker-root'
curl -fsS http://127.0.0.1:4173/project-wallstreet.html | grep -F 'data/project-wallstreet.json'
curl -fsS http://127.0.0.1:4173/mission-control.html | grep -F 'data/mission-control.json'
curl -fsS http://127.0.0.1:4173/data/programme-summary.json >/dev/null
```

Expected: all commands exit `0`. Use a browser at desktop and mobile widths to verify visible status, navigation, stale warning behaviour and keyboard focus.

- [ ] **Step 8: Commit Task 4**

```bash
git add index.html project-wallstreet.html mission-control.html assets/tracker.css tests/static-site.test.mjs
git commit -m "feat(tracker): replace hello world with executive programme dashboard"
```

---

### Task 5: Continuous validation and update runbook

**Files:**
- Create: `.github/workflows/tracker.yml`
- Create: `README.md`
- Modify: `GLOBAL_TIMELINE_RULE.md`

**Interfaces:**
- Produces: CI enforcement and exact operator/agent update commands.

- [ ] **Step 1: Create GitHub Actions validation**

Create `.github/workflows/tracker.yml`:

```yaml
name: tracker
on:
  push:
    branches: [gh-pages]
  pull_request:
    branches: [gh-pages]
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm test
      - run: npm run validate
```

- [ ] **Step 2: Add the update runbook**

Create `README.md` with these exact commands:

```markdown
# Re-AgentAI Programme Tracker

Public-safe executive and project timeline for Project Wallstreet and Mission Control.

## Review before work

1. Read `GLOBAL_TIMELINE_RULE.md`.
2. Review `index.html` and the relevant project page.
3. Reconcile the public state with the private repository, committed milestone evidence and canonical backlog.

## Mark a task in progress

```bash
node scripts/update-task.mjs \
  --project project-wallstreet \
  --task M1.3 \
  --status IN_PROGRESS \
  --owner Claude \
  --evidence PLANNED \
  --commit null \
  --summary "Implement public-safe PAPER preflight truth checks" \
  --next "Run fail-first tests"
```

## Mark a task complete

```bash
node scripts/update-task.mjs \
  --project project-wallstreet \
  --task M1.3 \
  --status COMPLETE \
  --owner Claude \
  --evidence "SELF-VERIFIED LIVE" \
  --commit abcdef1 \
  --summary "Pre-submit account and market truth checks deployed and verified in PAPER" \
  --next "Run the integrated M1 review"
```

## Validate before commit

```bash
npm test
npm run validate
```

Never place private runtime, broker, credential, account, security or incident details in public JSON.
```

- [ ] **Step 3: Add the concrete command to the global rule**

Append to `GLOBAL_TIMELINE_RULE.md`:

```markdown
## Phase A update command

Use `node scripts/update-task.mjs` for every task transition, then run:

```bash
npm test
npm run validate
```

Commit the relevant project JSON and `data/programme-summary.json` together. Review the rendered Pages result before beginning the next task.
```

- [ ] **Step 4: Run the complete local verification**

```bash
npm test
npm run validate
git grep -nEi '(api[_-]?key|secret|token|password)[[:space:]]*[:=]|127\.0\.0\.1|localhost|192\.168\.|/home/' -- data assets index.html project-wallstreet.html mission-control.html || true
```

Expected: tests pass, validation reports two projects, and grep returns no published secret/private-runtime content. `localhost` is permitted only inside README local-development commands, not public pages, assets or data.

- [ ] **Step 5: Commit Task 5**

```bash
git add .github/workflows/tracker.yml README.md GLOBAL_TIMELINE_RULE.md
git commit -m "ci(tracker): enforce timeline validation and update workflow"
```

---

### Task 6: Deployment, live verification and governance activation

**Files:**
- Modify: `data/programme-summary.json`
- Modify: `data/project-wallstreet.json` or `data/mission-control.json` only if implementation itself is represented as a tracker task
- Create: `docs/verification/2026-07-11-programme-tracker-live-verification.md`

**Interfaces:**
- Produces: deployed GitHub Pages evidence and active normal tracker-first governance.

- [ ] **Step 1: Run final pre-push checks**

```bash
npm test
npm run validate
git status --short
git log --oneline --decorate -6
```

Expected: tests and validation pass; only intended verification/tracker state changes remain.

- [ ] **Step 2: Push the implementation branch**

```bash
git push -u origin tracker/v1-executive-dashboard
```

Review the diff against `origin/gh-pages`:

```bash
git diff --stat origin/gh-pages...HEAD
git diff --check origin/gh-pages...HEAD
```

Expected: no whitespace errors and no private repository/runtime data.

- [ ] **Step 3: Merge without rewriting history**

From the primary checkout:

```bash
git checkout gh-pages
git pull --ff-only origin gh-pages
git merge --no-ff tracker/v1-executive-dashboard -m "Merge Re-AgentAI programme timeline tracker"
git push origin gh-pages
```

Do not force-push, rebase or overwrite unrelated Pages work.

- [ ] **Step 4: Verify the deployed Pages site**

After GitHub Pages deployment completes, verify:

```bash
curl -fsS https://andytayls90-commits.github.io/hello-world-test1/ | grep -F 'Re-AgentAI Programme Tracker'
curl -fsS https://andytayls90-commits.github.io/hello-world-test1/data/programme-summary.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.programme_name!=="Re-AgentAI")process.exit(1)})'
curl -fsS https://andytayls90-commits.github.io/hello-world-test1/project-wallstreet.html | grep -F 'data/project-wallstreet.json'
curl -fsS https://andytayls90-commits.github.io/hello-world-test1/mission-control.html | grep -F 'data/mission-control.json'
```

Expected: every command exits `0`.

- [ ] **Step 5: Record live verification**

Create `docs/verification/2026-07-11-programme-tracker-live-verification.md` containing:

```markdown
# Programme Tracker Live Verification

- Repository: `andytayls90-commits/hello-world-test1`
- Branch: `gh-pages`
- Deployed commit: `<12-character SHA recorded at execution>`
- Executive page: SELF-VERIFIED LIVE
- Project Wallstreet page: SELF-VERIFIED LIVE
- Mission Control page: SELF-VERIFIED LIVE
- JSON validation: PASS
- Node tests: PASS
- Public information boundary scan: PASS
- Private browser requests: NONE
- Staleness handling: VERIFIED with test and rendered stale fixture
- Rollback: revert the merge commit or restore the pre-merge `gh-pages` SHA
- Unresolved risk: Phase A depends on agents following the committed transition rule until Phase B automation is implemented
```

Replace the execution SHA field with the actual deployed abbreviated commit before commit.

- [ ] **Step 6: Activate normal timeline governance**

Review the live executive page and both project pages. Confirm the initial tracker state matches private committed evidence. From this point forward the bootstrap exception is exhausted: every Project Wallstreet and Mission Control task must use the tracker transition workflow before work, during material changes and at close.

- [ ] **Step 7: Commit and push verification evidence**

```bash
git add docs/verification/2026-07-11-programme-tracker-live-verification.md data
git commit -m "docs(tracker): record live programme tracker verification"
git push origin gh-pages
```

- [ ] **Step 8: Final report**

Report:

```text
Repository: andytayls90-commits/hello-world-test1
Branch: gh-pages
Merge SHA: <actual SHA>
Scope: executive overview + Project Wallstreet + Mission Control project pages
Tests: <actual counts>
Validation: PASS/FAIL
Live Pages: SELF-VERIFIED LIVE or BLOCKED
Public information scan: PASS/FAIL
Rollback: <actual pre-merge SHA and revert command>
Unresolved risks: Phase A manual update compliance; Phase B automation not yet implemented
Worktree: clean/dirty
```

---

## Plan Self-Review

- **Spec coverage:** Executive overview, separate project pages, public JSON contract, Phase A updates, Phase B-compatible schema, staleness, malformed-data UNKNOWN state, mobile layout, public boundary, global rule integration, tests and rollback are all assigned to concrete tasks.
- **Placeholder scan:** The plan contains no implementation `TODO` or `TBD`. Runtime-dependent SHA/timestamp fields have explicit commands and replacement rules at execution time.
- **Type consistency:** Project IDs, filenames, status/evidence enums, task fields and exported function names are consistent across core, CLI, tests and pages.
- **Scope:** One static tracker system with one validated update mechanism. Private-repository automation remains explicitly outside this implementation and does not alter the schema.