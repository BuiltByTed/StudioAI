/// <reference lib="dom" />
// Read-only deployment probe. Run against the exact artifact being promoted.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const configured = process.env.STUDIO_TEST_URL;
if (!configured) throw new Error('Set STUDIO_TEST_URL to the deployed application origin.');
const origin = new URL(configured).origin;
const dist = resolve(process.env.STUDIO_TEST_DIST ?? 'dist');
const expected = await readFile(resolve(dist, 'index.html'), 'utf8');
const build = JSON.parse(await readFile(resolve(dist, 'homeframe-build.json'), 'utf8')) as {
  buildId: string;
};
const response = await fetch(origin, { signal: AbortSignal.timeout(15_000) });
assert.equal(response.status, 200);
assert.equal(
  await response.text(),
  expected,
  'A proxy transformed the application HTML. Preserve its bytes with Cache-Control: no-transform.',
);
assert.match(response.headers.get('content-security-policy') ?? '', /sha256-/);
const health = await fetch(`${origin}/__studio_health`);
assert.deepEqual(await health.json(), { status: 'ok', build: build.buildId });
const missing = await fetch(`${origin}/api/studio-deployment-probe-missing`);
assert.equal(missing.status, 404);
assert.match(missing.headers.get('content-type') ?? '', /application\/json/);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Welcome to Studio AI' }).waitFor();
  // A worker can register, fail integrity verification, then become redundant.
  // Registration alone does not prove the deployment is installable.
  await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Worker activation timed out.')), 30_000),
      ),
    ]),
  );
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  assert.deepEqual(errors, []);
  console.log(
    `Verified deployed artifact ${build.buildId}: exact HTML, API boundary, active worker.`,
  );
} finally {
  await browser.close();
}
