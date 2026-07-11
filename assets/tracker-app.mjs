import {
  assertProjectData, assertSummaryData, renderExecutive, renderProject, escapeHtml, statusMatchesFilter
} from './tracker-core.mjs';

export const AUTO_REFRESH_MS = 60_000;

export async function loadJson(url, fetchImpl = fetch) {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetchImpl(`${url}${separator}v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function renderUnknown(root, message) {
  root.innerHTML = `<section class="notice notice--error" role="alert"><h1>Tracker state UNKNOWN</h1><p>${escapeHtml(message)}</p></section>`;
}

export function bindTaskFilters(root) {
  const buttons = [...root.querySelectorAll('[data-filter]')];
  const tasks = [...root.querySelectorAll('.task[data-status]')];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      for (const task of tasks) task.hidden = !statusMatchesFilter(task.dataset.status, filter);
      for (const candidate of buttons) candidate.setAttribute('aria-pressed', String(candidate === button));
    });
  }
  buttons[0]?.setAttribute('aria-pressed', 'true');
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
      bindTaskFilters(root);
      return;
    }
    throw new Error(`unknown page mode: ${page}`);
  } catch (error) {
    renderUnknown(root, error instanceof Error ? error.message : String(error));
  }
}

export function startAutoRefresh(documentRef = document, fetchImpl = fetch, intervalImpl = setInterval) {
  return intervalImpl(() => mountTracker(documentRef, fetchImpl), AUTO_REFRESH_MS);
}

if (typeof document !== 'undefined') {
  mountTracker().finally(() => startAutoRefresh());
}
