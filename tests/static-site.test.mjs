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
