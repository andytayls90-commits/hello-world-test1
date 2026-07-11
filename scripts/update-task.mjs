import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATUS_VALUES, EVIDENCE_VALUES, assertProjectData, assertSummaryData, calculateProgress, shortSha
} from '../assets/tracker-core.mjs';
import { assertPublicSafe } from './validate-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TERMINAL = new Set(['COMPLETE','SUPERSEDED','CANCELLED']);

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeJson(file, value) { await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }

function deriveMilestoneStatus(states) {
  if (states.every((item) => item === 'COMPLETE')) return 'COMPLETE';
  if (states.some((item) => item === 'BLOCKED')) return 'BLOCKED';
  if (states.some((item) => item === 'IN_PROGRESS')) return 'IN_PROGRESS';
  if (states.some((item) => item === 'READY')) return 'READY';
  if (states.every((item) => TERMINAL.has(item))) return 'COMPLETE';
  if (states.some((item) => item === 'UNKNOWN')) return 'UNKNOWN';
  return 'PLANNED';
}

function deriveProjectStatus(tasks) {
  const counted = tasks.filter((task) => !['SUPERSEDED','CANCELLED'].includes(task.status));
  if (counted.some((task) => task.status === 'BLOCKED')) return 'BLOCKED';
  if (counted.some((task) => task.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  if (counted.length > 0 && counted.every((task) => task.status === 'COMPLETE')) return 'COMPLETE';
  if (counted.some((task) => task.status === 'READY')) return 'READY';
  if (counted.some((task) => task.status === 'UNKNOWN')) return 'UNKNOWN';
  return 'PLANNED';
}

function deriveProjectEvidence(tasks) {
  if (tasks.some((task) => task.evidence === 'CONTRADICTED')) return 'CONTRADICTED';
  if (tasks.some((task) => task.status === 'BLOCKED')) return 'BLOCKED';
  if (tasks.every((task) => task.status === 'PLANNED')) return 'PLANNED';
  if (tasks.every((task) => ['VERIFIED LIVE','SELF-VERIFIED LIVE'].includes(task.evidence))) return 'VERIFIED LIVE';
  return 'PARTIAL';
}

function selectCurrentTask(tasks) {
  return tasks.find((task) => task.status === 'BLOCKED')?.id
    ?? tasks.find((task) => task.status === 'IN_PROGRESS')?.id
    ?? tasks.find((task) => task.status === 'READY')?.id
    ?? tasks.find((task) => task.status === 'PLANNED')?.id
    ?? null;
}

export async function updateTask({
  rootDir = ROOT, projectId, taskId, status, owner, evidence, commit,
  summary, nextAction, blockers = [], now = new Date().toISOString()
}) {
  if (!STATUS_VALUES.includes(status)) throw new Error(`invalid status: ${status}`);
  if (!EVIDENCE_VALUES.includes(evidence)) throw new Error(`invalid evidence: ${evidence}`);
  if (!Number.isFinite(Date.parse(now))) throw new Error('now must be ISO-8601');
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
  else if (!TERMINAL.has(status)) task.completed_at = null;

  project.history.push({ task_id: taskId, from: previous, to: status, at: now, evidence, commit: safeSha });
  for (const milestone of project.milestones) {
    const states = milestone.task_ids.map((id) => project.tasks.find((item) => item.id === id)?.status ?? 'UNKNOWN');
    milestone.status = deriveMilestoneStatus(states);
  }
  project.status = deriveProjectStatus(project.tasks);
  project.evidence = deriveProjectEvidence(project.tasks);
  project.current_task_id = selectCurrentTask(project.tasks);
  project.next_action = nextAction;
  project.updated_at = now;

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
    : rollup.projects.every((item) => item.status === 'COMPLETE') ? 'COMPLETE'
    : rollup.projects.some((item) => item.status === 'READY') ? 'READY' : 'PLANNED';
  rollup.evidence = rollup.projects.every((item) => item.evidence === 'VERIFIED LIVE') ? 'VERIFIED LIVE' : 'PARTIAL';

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
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] === undefined) throw new Error(`invalid argument near ${argv[index] ?? 'end'}`);
    values[argv[index].replace(/^--/, '')] = argv[index + 1];
  }
  return values;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    await updateTask({
      projectId: args.project,
      taskId: args.task,
      status: args.status,
      owner: args.owner,
      evidence: args.evidence,
      commit: args.commit === 'null' || args.commit === undefined ? null : args.commit,
      summary: args.summary,
      nextAction: args.next,
      blockers: args.blocker ? [args.blocker] : []
    });
    console.log(`tracker updated: ${args.project}/${args.task} -> ${args.status}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
