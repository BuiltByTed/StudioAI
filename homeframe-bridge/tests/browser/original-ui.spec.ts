import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.STUDIO_TEST_STORAGE, 'Requires authorized staging storage state. Never uses production credentials from source.');
  await page.goto('/');
  await expect(page.locator('#chat-input')).toBeVisible();
});

test('keeps the original composer, model picker and sidebar controls', async ({ page }) => {
  await expect(page).toHaveTitle('Studio AI');
  await expect(page.locator('[data-hf-shell]')).toHaveCount(1);
  await expect(page.locator('[data-hf-scroll-view]')).toHaveCount(1);
  await expect(page.locator('#chat-input')).toBeEditable();
  await expect(page.locator('#model-selector-model-button')).toBeVisible();
  await page.locator('#chat-input').fill('A draft that should survive opening the menu');
  await page.locator('#sidebar-toggle-button').click();
  await expect(page.locator('#sidebar-webui-name')).toHaveText('Studio AI');
  await expect(page.locator('[data-hf-sidebar]').getByRole('button', { name: /close (sidebar|menu|navigation)/i })).toHaveCount(0);
  await expect(page.locator('[data-hf-mobile-sidebar-dismiss]')).toHaveCount(0);
  await expect(page.locator('#chat-input')).toHaveText('A draft that should survive opening the menu');
});

test('preserves shell identity and geometry across original routes and history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const shell = await page.locator('[data-hf-shell]').elementHandle();
  const header = await page.locator('[data-hf-header]').elementHandle();
  for (const route of ['/notes', '/workspace/models', '/playground', '/automations', '/calendar']) {
    // Real same-origin anchors exercise SvelteKit's existing navigation handler.
    await page.evaluate(path => {
      const link = document.createElement('a'); link.href = path;
      document.body.append(link); link.click(); link.remove();
    }, route);
    await expect(page).toHaveURL(new RegExp(route.replaceAll('/', '\\/') + '$'));
    await expect(page.locator('[data-hf-scroll-view]')).toHaveCount(1);
    expect(await shell!.evaluate(node => node === document.querySelector('[data-hf-shell]'))).toBe(true);
    expect(await header!.evaluate(node => node === document.querySelector('[data-hf-header]'))).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const surface = await page.locator('[data-hf-header]').evaluate(node => {
      const style = getComputedStyle(node);
      return { filter: style.backdropFilter, background: style.backgroundColor };
    });
    expect(surface.filter).toBe('none');
    expect(surface.background).not.toMatch(/transparent|rgba\([^)]*,\s*0\)/);
  }
  await page.goBack(); await expect(page).toHaveURL(/\/automations$/);
  await page.goForward(); await expect(page).toHaveURL(/\/calendar$/);
  expect(errors).toEqual([]);
});

test('opens and dismisses the original settings in the framework portal', async ({ page }) => {
  await page.locator('#sidebar-toggle-button').click();
  await page.locator('button[aria-label="User menu"]').click();
  await page.getByText('Settings', { exact: true }).last().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(node => !!node.closest('.studio-frame-portal'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
