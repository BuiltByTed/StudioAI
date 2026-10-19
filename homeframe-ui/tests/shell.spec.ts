import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'fixture-session'));
  await page.routeWebSocket(/\/ws\/socket\.io\//, (socket) => socket.close());
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path === '/api/config')
      body = {
        name: 'Test workspace',
        default_models: 'fixture-model',
        features: { enable_notes: true, enable_folders: true, enable_calendar: true },
      };
    if (path === '/api/v1/auths/')
      body = { id: 'fixture-user', name: 'Sam', email: 'sam@example.test', role: 'admin' };
    if (path === '/api/v1/users/user/settings') body = { ui: {} };
    if (path === '/api/models') body = { data: [{ id: 'fixture-model', name: 'Test model' }] };
    if (path === '/api/v1/models/list') body = { items: [], total: 0 };
    await route.fulfill({ json: body });
  });
});

test('keeps one persistent shell, header and primary scroller across navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What are we making, Sam?' })).toBeVisible();
  await page
    .locator('[data-hf-header]')
    .evaluate((node) => node.setAttribute('data-qa-identity', 'original'));
  for (const label of ['Notes', 'Workspace', 'Folders', 'Calendar']) {
    await page.getByRole('link', { name: label, exact: true }).first().click();
    await expect(page.locator('[data-hf-shell]')).toHaveCount(1);
    await expect(page.locator('[data-hf-scroll-view]')).toHaveCount(1);
    await expect(page.locator('[data-hf-header]')).toHaveAttribute('data-qa-identity', 'original');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const backdrop = await page
      .locator('[data-hf-header]')
      .evaluate((node) => getComputedStyle(node).backdropFilter);
    expect(backdrop).toBe('none');
  }
});

test('mobile sidebar has no close-menu button and dismisses through Escape and navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const sidebar = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /close/i })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sidebar).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await sidebar.getByRole('link', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
  await expect(sidebar).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('editable controls stay at least 16px on mobile and preserve an unsent draft', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await composer.fill('A draft that must survive a page reload.');
  expect(
    await composer.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await page.reload();
  await expect(composer).toHaveValue('A draft that must survive a page reload.');
  expect(await page.evaluate(() => document.body.scrollHeight)).toBeLessThanOrEqual(844);
});

test('request failure remains inside the shell and offers recovery', async ({ page }) => {
  await page.route('**/api/v1/notes/', (route) =>
    route.fulfill({ status: 503, json: { detail: 'Temporarily unavailable' } }),
  );
  await page.goto('/notes');
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('link', { name: 'New conversation', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'What are we making, Sam?' })).toBeVisible();
});
