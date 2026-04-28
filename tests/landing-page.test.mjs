import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('GitHub Pages landing page', () => {
  it('should ship a static index with the six reference-backed sections', () => {
    assert.equal(existsSync(join(root, 'index.html')), true);
    const html = read('index.html');

    for (const id of ['hero', 'problem', 'workflow', 'state', 'principles', 'cta']) {
      assert.match(html, new RegExp(`<section[^>]+id="${id}"`));
    }

    for (const copy of [
      'Tidy Code That Works',
      'AI coding drifts when the workflow has no memory.',
      'Interview → Plan → Execute → Verify',
      'The agent always knows where it is.',
      'Built for disciplined autonomous work.',
      'Give your agent a harness.',
    ]) {
      assert.match(html, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('should keep the landing page deployable without remote runtime assets', () => {
    const html = read('index.html');
    assert.match(html, /<link rel="stylesheet" href="assets\/landing\.css">/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.doesNotMatch(html, /<script\b/i);
    assert.equal(existsSync(join(root, 'assets', 'landing.css')), true);
  });

  it('should include a GitHub Pages workflow that publishes the static artifact', () => {
    assert.equal(existsSync(join(root, '.github', 'workflows', 'pages.yml')), true);
    const workflow = read('.github/workflows/pages.yml');
    assert.match(workflow, /deploy-pages@v4/);
    assert.match(workflow, /upload-pages-artifact@v3/);
    assert.match(workflow, /path: _site/);
    assert.match(workflow, /npm test/);
  });

  it('should publish every non-anchor landing link into the Pages artifact', () => {
    const html = read('index.html');
    const workflow = read('.github/workflows/pages.yml');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    const localTargets = [...new Set(hrefs.filter((href) => !href.startsWith('#') && !href.startsWith('assets/')))];

    assert.deepEqual(localTargets.sort(), [
      'README.md',
      'docs/architecture.md',
      'docs/conventions.md',
      'docs/workflow.md',
      'src/runtime/contracts.ts',
    ].sort());

    for (const target of localTargets) {
      assert.equal(existsSync(join(root, target)), true, `${target} exists in repository`);
      assert.match(workflow, new RegExp(`cp .*${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${target} is copied to _site`);
    }
  });

});
