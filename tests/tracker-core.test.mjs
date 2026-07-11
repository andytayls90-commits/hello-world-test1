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
  shortSha,
  renderExecutive,
  renderProject
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
  project_name: 'Test',
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
  const result = calculateProgress([task('COMPLETE'), task('IN_PROGRESS'), task('PLANNED'), task('CANCELLED'), task('SUPERSEDED')]);
  assert.deepEqual(result, { complete: 1, total: 3, percent: 33 });
});

test('freshness is fresh at exactly 48 hours and stale after it', () => {
  const updated = '2026-07-09T10:00:00Z';
  assert.equal(classifyFreshness(updated, new Date('2026-07-11T10:00:00Z'), 48).state, 'FRESH');
  assert.equal(classifyFreshness(updated, new Date('2026-07-11T10:00:01Z'), 48).state, 'STALE');
});

test('HTML and SHA helpers are public-safe', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(shortSha('ABCDEF1234567890'), null);
  assert.equal(shortSha('ABCDEF123456'), 'abcdef123456');
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
    projects: [{
      project_id: 'x', project_name: 'X', status: 'READY', evidence: 'PLANNED',
      data_file: 'data/x.json', next_action: 'Continue', updated_at: '2026-07-11T10:00:00+10:00',
      progress: { complete: 0, total: 1, percent: 0 }
    }]
  }), /detail_page/);
});

test('summary validation rejects unsafe public paths and impossible progress', () => {
  const base = {
    schema_version: 1,
    programme_name: 'Re-AgentAI',
    status: 'READY',
    evidence: 'PARTIAL',
    updated_at: '2026-07-11T10:00:00+10:00',
    stale_after_hours: 48,
    projects: [{
      project_id: 'x', project_name: 'X', status: 'READY', evidence: 'PLANNED',
      detail_page: 'x.html', data_file: 'data/x.json', current_task_id: 'X1',
      next_action: 'Continue', updated_at: '2026-07-11T10:00:00+10:00',
      progress: { complete: 0, total: 1, percent: 0 }
    }]
  };
  assert.throws(() => assertSummaryData({ ...base, projects: [{ ...base.projects[0], detail_page: 'javascript:bad.html' }] }), /safe relative/);
  assert.throws(() => assertSummaryData({ ...base, projects: [{ ...base.projects[0], data_file: 'data/..\/private.json' }] }), /safe public/);
  assert.throws(() => assertSummaryData({ ...base, projects: [{ ...base.projects[0], progress: { complete: 2, total: 1, percent: 200 } }] }), /inconsistent/);
});

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

test('project rendering escapes public text', () => {
  const malicious = {
    ...project,
    project_name: 'Test <Project>',
    tasks: [{ ...project.tasks[0], project: 'Test <Project>', summary: '<script>alert(1)</script>' }]
  };
  const html = renderProject(malicious, new Date('2026-07-11T00:00:00Z'));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
