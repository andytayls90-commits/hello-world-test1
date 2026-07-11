export const STATUS_VALUES = Object.freeze([
  'PLANNED','READY','IN_PROGRESS','BLOCKED','COMPLETE','SUPERSEDED','CANCELLED','UNKNOWN'
]);

export const EVIDENCE_VALUES = Object.freeze([
  'VERIFIED LIVE','SELF-VERIFIED LIVE','IMPLEMENTED / UNVERIFIED','PARTIAL',
  'PLANNED','BLOCKED','CONTRADICTED','UNKNOWN'
]);

const STATUS_SET = new Set(STATUS_VALUES);
const EVIDENCE_SET = new Set(EVIDENCE_VALUES);
const COUNTED_PROGRESS = new Set(['PLANNED','READY','IN_PROGRESS','BLOCKED','COMPLETE','UNKNOWN']);
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
  if (value.commit !== null && !SHA_RE.test(value.commit)) {
    throw new TypeError('task.commit must be an abbreviated SHA or null');
  }
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
  if (value.current_task_id !== null && !ids.has(value.current_task_id)) {
    throw new TypeError('current_task_id must reference an existing task or be null');
  }
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
    if (!/^[a-z0-9-]+\.html$/.test(project.detail_page)) throw new TypeError('summary project.detail_page must be a safe relative html path');
    if (!/^data\/[a-z0-9-]+\.json$/.test(project.data_file)) throw new TypeError('summary project.data_file must be a safe public data path');
    requireObject(project.progress, 'summary project.progress');
    for (const field of ['complete','total','percent']) {
      if (!Number.isInteger(project.progress[field]) || project.progress[field] < 0) {
        throw new TypeError(`summary project.progress.${field} must be a non-negative integer`);
      }
    }
    if (project.progress.complete > project.progress.total || project.progress.percent > 100) {
      throw new TypeError('summary project.progress is inconsistent');
    }
  }
  return true;
}

export function calculateProgress(tasks) {
  const included = tasks.filter((task) => COUNTED_PROGRESS.has(task.status));
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

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function badge(value, kind = 'status') {
  return `<span class="badge badge--${slug(value)}" data-kind="${kind}">${escapeHtml(value)}</span>`;
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

function taskCard(task) {
  const blockers = task.blockers.length
    ? `<div class="notice notice--blocked"><strong>Blockers:</strong> ${task.blockers.map(escapeHtml).join('; ')}</div>`
    : '';
  return `<article class="task" data-status="${escapeHtml(task.status)}">
    <div class="task__head"><h3>${escapeHtml(task.id)} · ${escapeHtml(task.title)}</h3>${badge(task.status)}</div>
    <p>${escapeHtml(task.summary)}</p>
    <dl><dt>Owner</dt><dd>${escapeHtml(task.owner)}</dd><dt>Evidence</dt><dd>${badge(task.evidence, 'evidence')}</dd>
    <dt>Commit</dt><dd>${escapeHtml(task.commit ?? 'Not recorded')}</dd><dt>Updated</dt><dd>${escapeHtml(formatDate(task.updated_at))}</dd></dl>
    ${blockers}<p><strong>Next:</strong> ${escapeHtml(task.next_action)}</p>
  </article>`;
}

export function renderExecutive(summary, projects = [], now = new Date()) {
  const cards = summary.projects.map((project) => {
    const matching = projects.find((item) => item.project_id === project.project_id);
    const blockers = matching?.tasks?.filter((task) => task.status === 'BLOCKED').length ?? 0;
    return `<article class="project-card">
      <div class="project-card__head"><h2>${escapeHtml(project.project_name)}</h2>${badge(project.status)}</div>
      <p>${badge(project.evidence, 'evidence')}</p>
      <div class="progress" aria-label="${project.progress.percent}% complete"><span style="width:${project.progress.percent}%"></span></div>
      <p><strong>${project.progress.percent}%</strong> · ${project.progress.complete}/${project.progress.total} counted tasks complete</p>
      <p><strong>Current:</strong> ${escapeHtml(project.current_task_id ?? 'UNKNOWN')}</p>
      <p><strong>Blocked tasks:</strong> ${blockers}</p>
      <p><strong>Next:</strong> ${escapeHtml(project.next_action)}</p>
      <p class="muted">Updated ${escapeHtml(formatDate(project.updated_at))}</p>
      <a class="button" href="${escapeHtml(project.detail_page)}">Open ${escapeHtml(project.project_name)}</a>
    </article>`;
  }).join('');
  return `${freshnessBanner(summary.updated_at, summary.stale_after_hours, now)}
    <section class="hero"><p class="eyebrow">Executive oversight</p><h1>${escapeHtml(summary.programme_name)}</h1>
    <p>${badge(summary.status)} ${badge(summary.evidence, 'evidence')}</p>
    <p class="lede">One public-safe view of delivery, evidence and next decisions across the programme.</p></section>
    <section class="project-grid" aria-label="Projects">${cards}</section>`;
}

export function renderProject(project, now = new Date()) {
  const progress = calculateProgress(project.tasks);
  const milestones = project.milestones.map((milestone) => `
    <section class="milestone">
      <div class="milestone__head"><h2>${escapeHtml(milestone.id)} · ${escapeHtml(milestone.title)}</h2>${badge(milestone.status)}</div>
      <div class="task-list">${milestone.task_ids.map((id) => {
        const task = project.tasks.find((item) => item.id === id);
        return task ? taskCard(task) : `<article class="task task--unknown"><h3>${escapeHtml(id)}</h3>${badge('UNKNOWN')}</article>`;
      }).join('')}</div>
    </section>`).join('');
  return `${freshnessBanner(project.updated_at, project.stale_after_hours, now)}
    <section class="hero"><a href="index.html" class="back-link">← Executive overview</a><p class="eyebrow">Project timeline</p>
    <h1>${escapeHtml(project.project_name)}</h1><p>${badge(project.status)} ${badge(project.evidence, 'evidence')}</p>
    <div class="progress" aria-label="${progress.percent}% complete"><span style="width:${progress.percent}%"></span></div>
    <p>${progress.complete}/${progress.total} counted tasks complete · Updated ${escapeHtml(formatDate(project.updated_at))}</p>
    <p><strong>Next:</strong> ${escapeHtml(project.next_action)}</p></section>${milestones}`;
}
