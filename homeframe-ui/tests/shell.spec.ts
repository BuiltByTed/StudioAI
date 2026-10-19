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
    if (path.startsWith('/api/tasks/chat/')) body = { task_ids: [] };
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

test('upstream drafts retain attachments and selections through migration and rollback', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('qa:initialized')) {
      sessionStorage.setItem(
        'chat-input',
        JSON.stringify({
          prompt: 'Unsent upstream work',
          files: [{ type: 'file', id: 'fixture-file', name: 'Research.txt' }],
          selectedToolIds: ['research'],
          selectedSkillIds: ['writing'],
          selectedFilterIds: ['format'],
          webSearchEnabled: true,
        }),
      );
      sessionStorage.setItem('qa:initialized', 'yes');
    }
  });
  await page.goto('/');
  const composer = page.getByRole('textbox', { name: 'Message', exact: true });
  await expect(composer).toHaveValue('Unsent upstream work');
  await expect(page.getByRole('button', { name: 'Remove Research.txt' })).toBeVisible();
  await composer.fill('Continued in Homeframe');
  await page.reload();
  await expect(composer).toHaveValue('Continued in Homeframe');
  await expect(page.getByRole('button', { name: 'Remove Research.txt' })).toBeVisible();
  const rollback = await page.evaluate(() => JSON.parse(sessionStorage.getItem('chat-input')!));
  expect(rollback).toMatchObject({
    prompt: 'Continued in Homeframe',
    selectedToolIds: ['research'],
    selectedSkillIds: ['writing'],
    selectedFilterIds: ['format'],
    webSearchEnabled: true,
  });
});

test('recovery remains reachable when the backend is unavailable', async ({ page }) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({ status: 503, json: { detail: 'Offline' } }),
  );
  await page.goto('/__homeframe/recovery');
  await expect(page.getByRole('button', { name: /Check for a repaired version/i })).toBeVisible();
});

test('unsaved note content survives navigation and a reload', async ({ page }) => {
  await page.goto('/notes/new');
  await page.getByLabel('Title', { exact: true }).fill('Unsent note');
  await page.getByLabel('Note', { exact: true }).fill('Keep this work while I browse.');
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await page.goto('/notes/new');
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue(
    'Keep this work while I browse.',
  );
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsent note');
});

test('tool questions are interactive and acknowledge the answer', async ({ page }) => {
  let send: ((payload: string) => void) | undefined;
  let acknowledgement = '';
  await page.routeWebSocket(/\/ws\/socket\.io\//, (socket) => {
    send = (payload) => socket.send(payload);
    socket.send(
      '0' +
        JSON.stringify({
          sid: 'fixture-engine',
          upgrades: [],
          pingInterval: 100000,
          pingTimeout: 60000,
          maxPayload: 1000000,
        }),
    );
    socket.onMessage((message) => {
      const value = String(message);
      if (value.startsWith('40')) socket.send('40' + JSON.stringify({ sid: 'fixture-socket' }));
      if (value.startsWith('43')) acknowledgement = value;
    });
  });
  await page.goto('/');
  await expect(page.locator('.composer-caption')).toContainText('Your workspace');
  send?.(
    '421' +
      JSON.stringify([
        'events',
        {
          chat_id: 'fixture-chat',
          data: {
            type: 'request:user_input',
            data: {
              interaction_id: 'question',
              questions: [
                {
                  id: 'color',
                  question: 'Choose a color',
                  options: [{ label: 'Green', description: 'Sage green' }],
                },
              ],
            },
          },
        },
      ]),
  );
  const panel = page.locator('[data-hf-side-panel]');
  await expect(panel.getByText('Choose a color')).toBeVisible();
  await panel.getByRole('radio').check();
  await panel.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect.poll(() => acknowledgement).toContain('"status":"answered"');
  expect(acknowledgement).toContain('"label":"Green"');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('long-running responses remain stoppable when chat records omit active state', async ({
  page,
}) => {
  let reads = 0;
  await page.route('**/api/v1/chats/active', (route) => {
    reads++;
    return route.fulfill({
      json: {
        id: 'active',
        title: 'Running chat',
        chat: {
          models: ['fixture-model'],
          history: {
            currentId: 'assistant',
            messages: {
              user: {
                id: 'user',
                role: 'user',
                content: 'A slow request',
                parentId: null,
                childrenIds: ['assistant'],
              },
              assistant: {
                id: 'assistant',
                role: 'assistant',
                model: 'fixture-model',
                content: 'Still working',
                parentId: 'user',
                childrenIds: [],
                done: false,
              },
            },
          },
        },
      },
    });
  });
  await page.route('**/api/tasks/chat/active', (route) =>
    route.fulfill({ json: { task_ids: ['server-task'] } }),
  );
  await page.goto('/c/active');
  await expect(page.getByRole('button', { name: 'Stop generating', exact: true })).toBeVisible();
  await expect.poll(() => reads, { timeout: 22000 }).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('button', { name: 'Stop generating', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toHaveCount(0);
});

test('draft feature choices take precedence over model defaults at startup', async ({ page }) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: { default_models: 'fixture-model', features: { enable_web_search: true } },
    }),
  );
  await page.route('**/api/models', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 'fixture-model',
            name: 'Test model',
            info: { meta: { defaultFeatureIds: ['web_search'] } },
          },
        ],
      },
    }),
  );
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'chat-input',
      JSON.stringify({ prompt: 'A saved draft', webSearchEnabled: false }),
    ),
  );
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'A saved draft',
  );
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('an item permission error does not sign out a valid account', async ({ page }) => {
  await page.route('**/api/v1/notes/', (route) =>
    route.fulfill({ status: 401, json: { detail: 'You do not have access to this item.' } }),
  );
  await page.goto('/notes');
  await expect(page.getByRole('alert')).toContainText('do not have access');
  await expect(page.getByRole('link', { name: 'Workspace', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
});

test('expired authentication returns to sign-in while retaining account-scoped drafts', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Keep my draft for reauthentication.');
  await page.route('**/api/v1/auths/', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Session expired' } }),
  );
  await page.route('**/api/v1/notes/', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Session expired' } }),
  );
  await page.getByRole('link', { name: 'Notes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  const draft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('studio:draft:fixture-user:new') ?? 'null'),
  );
  expect(draft.prompt).toBe('Keep my draft for reauthentication.');
});

test('temporary conversation drafts never enter browser storage', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('A saved draft');
  await page.getByRole('link', { name: 'Temporary conversation', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  await expect(input).toHaveValue('');
  await input.fill('Private temporary text');
  const storage = await page.evaluate(() => ({
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  expect(storage.local).not.toContain('Private temporary text');
  expect(storage.session).not.toContain('Private temporary text');
  await page
    .getByRole('link', { name: /New conversation/ })
    .first()
    .click();
  await expect(input).toHaveValue('A saved draft');
});

test('new conversation instructions survive reload without entering temporary storage', async ({
  page,
}) => {
  await page.goto('/');
  const open = async () => {
    await page
      .locator('summary')
      .filter({ hasText: /^Tools$/ })
      .click();
    await page.getByText('Conversation settings', { exact: true }).click();
  };
  await open();
  await page.getByLabel('Conversation instructions', { exact: true }).fill('Keep my instructions.');
  await page.getByRole('button', { name: 'Apply conversation settings' }).click();
  await page.reload();
  await open();
  await expect(page.getByLabel('Conversation instructions', { exact: true })).toHaveValue(
    'Keep my instructions.',
  );
  await page.getByRole('link', { name: 'Temporary conversation', exact: true }).click();
  await expect(page.getByLabel('Conversation instructions', { exact: true })).toHaveValue('');
  await page
    .getByLabel('Conversation instructions', { exact: true })
    .fill('Temporary instructions.');
  await page.getByRole('button', { name: 'Apply conversation settings' }).click();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'Temporary instructions.',
  );
});

test('link retrieval cannot attach content to a different conversation after navigation', async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/retrieval/process/url?*', async (route) => {
    await pending;
    await route
      .fulfill({ json: { type: 'web', name: 'Late page', collection_name: 'fixture-web' } })
      .catch(() => {});
  });
  await page.goto('/');
  await page
    .locator('summary')
    .filter({ hasText: /^Tools$/ })
    .click();
  await page.getByLabel('Web page or video URL').fill('https://example.test/late');
  const request = page.waitForRequest('**/api/v1/retrieval/process/url?*');
  await page.getByRole('button', { name: 'Attach link content' }).click();
  await request;
  await page.getByRole('link', { name: 'Temporary conversation', exact: true }).click();
  release();
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Remove Late page' })).toHaveCount(0);
  await page.reload();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('Late page');
});

test('microphone transcription appends a draft and releases microphone tracks', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let stops = 0;
    Object.defineProperty(window, 'qaTrackStops', { get: () => stops });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => ({ getTracks: () => [{ stop: () => stops++ }] }),
    });
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['fixture audio']) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { value: Recorder });
  });
  await page.route('**/api/v1/audio/transcriptions', async (route) => {
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    await route.fulfill({ json: { text: 'A dictated sentence.' } });
  });
  await page.goto('/');
  await page.getByLabel('Message', { exact: true }).fill('Before.');
  await page.getByRole('button', { name: 'Dictate message', exact: true }).click();
  await page.getByRole('button', { name: 'Finish recording', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
    'Before. A dictated sentence.',
  );
  expect(
    await page.evaluate(() => (window as unknown as { qaTrackStops: number }).qaTrackStops),
  ).toBeGreaterThan(0);
});
