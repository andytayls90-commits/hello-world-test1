import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySchedule, statusMatchesFilter, renderProject } from '../assets/tracker-core.mjs';

test('schedule classification reports on-time, late, overdue and no-target states', () => {
  const now = new Date('2026-07-11T12:00:00Z');
  assert.equal(classifySchedule({ status: 'READY', target_at: '2026-07-12T12:00:00Z' }, now).state, 'ON_TRACK');
  assert.equal(classifySchedule({ status: 'READY', target_at: '2026-07-10T12:00:00Z' }, now).state, 'OVERDUE');
  assert.equal(classifySchedule({ status: 'COMPLETE', target_at: '2026-07-12T12:00:00Z', completed_at: '2026-07-11T12:00:00Z' }, now).state, 'COMPLETE_ON_TIME');
  assert.equal(classifySchedule({ status: 'COMPLETE', target_at: '2026-07-10T12:00:00Z', completed_at: '2026-07-11T12:00:00Z' }, now).state, 'COMPLETE_LATE');
  assert.equal(classifySchedule({ status: 'PLANNED', target_at: null }, now).state, 'NO_TARGET');
});

test('task status filters use explicit groups', () => {
  assert.equal(statusMatchesFilter('IN_PROGRESS', 'active'), true);
  assert.equal(statusMatchesFilter('READY', 'active'), true);
  assert.equal(statusMatchesFilter('BLOCKED', 'active'), false);
  assert.equal(statusMatchesFilter('UNKNOWN', 'planned'), true);
  assert.equal(statusMatchesFilter('COMPLETE', 'complete'), true);
});

test('project rendering includes target dates, task filters and recent activity', () => {
  const project = {
    schema_version: 1,
    project_id: 'test-project',
    project_name: 'Test Project',
    status: 'IN_PROGRESS',
    evidence: 'PARTIAL',
    updated_at: '2026-07-11T10:00:00+10:00',
    stale_after_hours: 48,
    current_task_id: 'T1',
    next_action: 'Continue',
    milestones: [{ id: 'M1', title: 'Milestone', status: 'IN_PROGRESS', task_ids: ['T1'] }],
    tasks: [{
      id: 'T1', title: 'Task', project: 'Test Project', status: 'IN_PROGRESS', owner: 'Claude',
      started_at: '2026-07-11T09:00:00+10:00', completed_at: null,
      target_at: '2026-07-12T10:00:00+10:00', evidence: 'PLANNED', commit: null,
      summary: 'Public-safe task', blockers: [], next_action: 'Continue',
      updated_at: '2026-07-11T10:00:00+10:00'
    }],
    history: [{ task_id: 'T1', from: 'READY', to: 'IN_PROGRESS', at: '2026-07-11T09:00:00+10:00', evidence: 'PLANNED', commit: null }]
  };
  const html = renderProject(project, new Date('2026-07-11T00:00:00Z'));
  assert.match(html, /Filter tasks/);
  assert.match(html, /data-filter="active"/);
  assert.match(html, /Target/);
  assert.match(html, /Recent activity/);
  assert.match(html, /READY → IN_PROGRESS/);
});
