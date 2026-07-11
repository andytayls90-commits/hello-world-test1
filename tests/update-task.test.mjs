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
  milestones: [{ id: 'M1', title: 'Execution foundation', status: 'READY', task_ids: ['M1.3','M1-REVIEW'] }],
  tasks: [
    {
      id: 'M1.3', title: 'Account truth and market clock', project: 'Project Wallstreet',
      status: 'READY', owner: 'Unassigned', started_at: null, completed_at: null, target_at: null,
      evidence: 'PLANNED', commit: null, summary: 'Public-safe task', blockers: [],
      next_action: 'Start M1.3', updated_at: '2026-07-11T00:00:00+10:00'
    },
    {
      id: 'M1-REVIEW', title: 'Integrated review', project: 'Project Wallstreet',
      status: 'PLANNED', owner: 'Unassigned', started_at: null, completed_at: null, target_at: null,
      evidence: 'PLANNED', commit: null, summary: 'Review task', blockers: [],
      next_action: 'Wait', updated_at: '2026-07-11T00:00:00+10:00'
    }
  ],
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
    progress: { complete: 0, total: 2, percent: 0 }, next_action: 'Start M1.3',
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

test('completing one task selects the next and keeps project incomplete', async () => {
  const rootDir = await fixture();
  await updateTask({
    rootDir, projectId: 'project-wallstreet', taskId: 'M1.3', status: 'COMPLETE',
    owner: 'Claude', evidence: 'IMPLEMENTED / UNVERIFIED', commit: 'abcdef1',
    summary: 'Completed task', nextAction: 'Start integrated review', blockers: [],
    now: '2026-07-11T13:00:00+10:00'
  });
  const next = JSON.parse(await readFile(path.join(rootDir, 'data/project-wallstreet.json'), 'utf8'));
  assert.equal(next.status, 'PLANNED');
  assert.equal(next.current_task_id, 'M1-REVIEW');
  assert.equal(next.tasks[0].completed_at, '2026-07-11T13:00:00+10:00');
});
