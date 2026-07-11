import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProjectData, assertSummaryData, calculateProgress } from '../assets/tracker-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE_PATTERNS = [
  /(?:api[_-]?key|secret|password)\s*[:=]/i,
  /\b(?:127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)\b/i,
  /https?:\/\/(?!andytayls90-commits\.github\.io)/i,
  /\/home\//i,
  /(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{8,}/i
];
const DENIED_KEYS = new Set([
  'api_key','secret','token','password','account_id','account_number','balance','positions','orders',
  'hostname','ip_address','private_url','internal_url','raw_log','credentials'
]);

function walkKeys(value) {
  if (Array.isArray(value)) return value.forEach(walkKeys);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (DENIED_KEYS.has(key.toLowerCase())) throw new Error(`public information boundary violation: denied key ${key}`);
    walkKeys(child);
  }
}

export function assertPublicSafe(value) {
  walkKeys(value);
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
    const expected = calculateProgress(project.tasks);
    if (JSON.stringify(expected) !== JSON.stringify(item.progress)) {
      throw new Error(`progress mismatch: ${item.project_id}`);
    }
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
