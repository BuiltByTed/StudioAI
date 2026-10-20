import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

if (!process.env.STUDIO_TEST_URL) throw new Error('Set STUDIO_TEST_URL to the candidate origin.');
const origin = new URL(process.env.STUDIO_TEST_URL).origin;
const dist = resolve(process.env.STUDIO_TEST_DIST ?? 'dist');
const expected = await readFile(resolve(dist, 'index.html'), 'utf8');
const build = JSON.parse(await readFile(resolve(dist, 'homeframe-build.json'), 'utf8'));
const response = await fetch(origin, { signal: AbortSignal.timeout(15000) });
assert.equal(response.status, 200);
assert.equal(await response.text(), expected, 'Proxy/CDN changed the Homeframe document bytes.');
assert.deepEqual(await (await fetch(`${origin}/__studio_health`)).json(), { status: 'ok', build: build.buildId });
const missing = await fetch(`${origin}/api/studio-deployment-probe-missing`);
assert.equal(missing.status, 404);
assert.match(missing.headers.get('content-type') ?? '', /application\/json/);
const browser = await chromium.launch();
try {
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const started = Date.now();
  await page.goto(origin);
  await page.locator('#email').waitFor({ timeout: 30000 });
  await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Worker activation timed out.')), 120000)),
  ]));
  const installMs = Date.now() - started;
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.locator('#email').waitFor();
  assert.equal(await page.locator('[data-hf-shell]').count(), 1);
  assert.equal(await page.evaluate(() => scrollY), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ build: build.buildId, exactHTML: true, apiBoundary: true, activeWorker: true, freshInstallMs: installMs }));
} finally { await browser.close(); }
