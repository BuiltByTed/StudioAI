import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, symlink, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createFrontendServer } from './server.ts';

const listen = (server: http.Server) =>
  new Promise<number>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)),
  );
const close = (server: http.Server) =>
  new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
test('promotes a static release while API streams and old assets remain available', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'studio-frontend-test-')),
    releases = join(root, 'releases');
  await mkdir(releases);
  for (const name of ['before', 'after']) {
    await mkdir(join(releases, name));
    await mkdir(join(releases, name, 'assets'));
    await writeFile(
      join(releases, name, 'index.html'),
      `<h1>${name}</h1><script>window.fixture=true;</script>`,
    );
    await writeFile(join(releases, name, 'sw.js'), `// ${name}`);
    await writeFile(
      join(releases, name, 'manifest.webmanifest'),
      '{"id":"/","scope":"/","start_url":"/"}',
    );
    await writeFile(
      join(releases, name, 'homeframe-build.json'),
      JSON.stringify({ buildId: name }),
    );
    await writeFile(join(releases, name, 'assets', `${name}-123.js`), `console.log('${name}');`);
  }
  const current = join(root, 'current');
  await symlink(join(releases, 'before'), current);
  let finish = () => {};
  const backend = http.createServer((req, res) => {
    if (req.url === '/api/missing' || req.url === '/api/v1/files/fixture/content') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<html>backend content</html>');
      return;
    }
    if (req.url === '/api/stream?model=fixture') {
      assert.equal(req.headers.authorization, 'Bearer fixture-only');
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Set-Cookie': ['one=1; HttpOnly', 'two=2; HttpOnly'],
      });
      res.write('data: first\n\n');
      finish = () => res.end('data: second\n\n');
      return;
    }
    if (req.url === '/api/upload') {
      const hash = createHash('sha256');
      req.on('data', (chunk) => hash.update(chunk));
      req.on('end', () => res.end(hash.digest('hex')));
      return;
    }
    res.end('backend');
  });
  backend.on('upgrade', (_req, socket) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
    );
    socket.on('data', (bytes) => socket.end(bytes));
  });
  const backendPort = await listen(backend),
    frontend = createFrontendServer({
      current,
      releases,
      upstream: `http://127.0.0.1:${backendPort}`,
    }),
    port = await listen(frontend),
    base = `http://127.0.0.1:${port}`;
  t.after(async () => {
    await close(frontend);
    await close(backend);
    await rm(root, { recursive: true, force: true });
  });
  assert.match(await (await fetch(base + '/')).text(), /before/);
  assert.match(await (await fetch(base + '/__homeframe/recovery')).text(), /before/);
  assert.match(await (await fetch(base + '/__homeframe/doctor-route')).text(), /before/);
  const manifestRevision = createHash('sha256')
    .update('{"id":"/","scope":"/","start_url":"/"}')
    .digest('hex')
    .slice(0, 16);
  assert.equal(
    (await fetch(base + '/manifest.json?v=' + manifestRevision)).headers.get('cache-control'),
    'no-cache',
  );
  const policy = (await fetch(base + '/')).headers.get('content-security-policy')!;
  assert.match(policy, /script-src 'self' 'sha256-/);
  assert.ok(policy.includes(createHash('sha256').update('window.fixture=true;').digest('base64')));
  assert.ok(!policy.includes("'unsafe-eval'"));
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.match(
    await (await fetch(base + '/api/v1/files/fixture/content')).text(),
    /backend content/,
  );
  const stream = await fetch(base + '/api/stream?model=fixture', {
    headers: { Authorization: 'Bearer fixture-only' },
  });
  assert.equal(stream.headers.getSetCookie().length, 2);
  const reader = stream.body!.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: first\n\n');
  await symlink(join(releases, 'after'), join(root, 'next'));
  await rename(join(root, 'next'), current);
  assert.match(
    await (
      await fetch(base + '/workspace/models/qwen3.8', { headers: { Accept: 'text/html' } })
    ).text(),
    /after/,
  );
  finish();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: second\n\n');
  assert.equal((await reader.read()).done, true);
  assert.equal((await fetch(base + '/assets/before-123.js')).status, 200);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.equal((await fetch(base + '/sw.js')).headers.get('cache-control'), 'no-cache');
  assert.equal((await fetch(base + '/ws/socket.io')).status, 200);
  assert.equal(await (await fetch(base + '/_app/old-client.js')).text(), 'backend');
  const data = Buffer.alloc(2 * 1024 * 1024, 42);
  assert.equal(
    await (await fetch(base + '/api/upload', { method: 'POST', body: data })).text(),
    createHash('sha256').update(data).digest('hex'),
  );
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    let reply = '';
    socket.on('connect', () =>
      socket.write(
        'GET /ws/socket.io HTTP/1.1\r\nHost: fixture\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n',
      ),
    );
    socket.on('data', (bytes) => {
      reply += bytes.toString();
      if (reply.includes('\r\n\r\n') && !reply.includes('fixture-frame'))
        socket.write('fixture-frame');
    });
    socket.on('error', reject);
    socket.on('end', () => {
      assert.match(reply, /101 Switching Protocols/);
      assert.match(reply, /fixture-frame/);
      resolve();
    });
  });
});

test('fails closed for missing releases and rejects asset traversal', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'studio-path-test-'));
  await writeFile(join(root, 'index.html'), 'shell');
  const server = createFrontendServer({ current: root, upstream: 'http://127.0.0.1:1' }),
    port = await listen(server);
  t.after(async () => {
    await close(server);
    await rm(root, { recursive: true, force: true });
  });
  for (const path of ['/%2e%2e%2fsecret', '/.env', '/assets/missing.js?v=bad'])
    assert.notEqual((await fetch(`http://127.0.0.1:${port}${path}`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/models`)).status, 502);
});

test('serves the original Svelte UI chunks and retains upstream fallback for old tabs', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'studio-original-test-'));
  await mkdir(join(root, '_app', 'immutable'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<title>Studio AI</title>');
  await writeFile(join(root, '_app', 'immutable', 'current.js'), 'current Svelte chunk');
  await writeFile(join(root, '_app', 'immutable', 'pdf.worker.mjs'), 'export {};');
  await writeFile(join(root, 'fixture.wasm'), Buffer.from([0,97,115,109,1,0,0,0]));
  await writeFile(join(root, 'unknown.asset'), 'exact asset bytes');
  const backend = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(req.url === '/_app/immutable/old.js' ? 'old upstream chunk' : 'unexpected fallback');
  });
  const port = await listen(backend);
  const frontend = createFrontendServer({ current: root, upstream: `http://127.0.0.1:${port}`, originalUI: true });
  const base = `http://127.0.0.1:${await listen(frontend)}`;
  t.after(async () => { await close(frontend); await close(backend); await rm(root, { recursive: true, force: true }); });
  const current = await fetch(base + '/_app/immutable/current.js');
  assert.equal(await current.text(), 'current Svelte chunk');
  assert.match((await fetch(base + '/_app/immutable/pdf.worker.mjs')).headers.get('Content-Type') ?? '', /^text\/javascript/);
  assert.equal((await fetch(base + '/fixture.wasm')).headers.get('Content-Type'), 'application/wasm');
  assert.equal(await (await fetch(base + '/unknown.asset')).text(), 'exact asset bytes');
  assert.equal(await (await fetch(base + '/workspace/models/example.v2', { headers: { Accept: 'text/html' } })).text(), '<title>Studio AI</title>');
  assert.match(current.headers.get('Cache-Control') ?? '', /immutable/);
  assert.equal(await (await fetch(base + '/_app/immutable/old.js')).text(), 'old upstream chunk');
  const document = await fetch(base + '/notes/example');
  assert.equal(await document.text(), '<title>Studio AI</title>');
  // Preserve the original UI's sandboxed previews and Python worker policy.
  // The separate React UI's stricter policy remains the default above.
  assert.equal(document.headers.get('Content-Security-Policy'), null);
});
