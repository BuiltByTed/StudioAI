// Node 24+; no runtime dependencies. Static releases are immutable directories.
// Switch `current` atomically to promote a build without touching backend streams.
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import https from 'node:https';
import { createReadStream } from 'node:fs';
import { readFile, realpath, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Duplex } from 'node:stream';

interface Options {
  current: string;
  releases?: string;
  upstream: string;
}
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};
const passthrough = [
  '/api',
  '/openai',
  '/ollama',
  '/ws',
  '/oauth',
  '/static',
  '/cache',
  '/pyodide',
  '/_app',
  '/health',
  '/.well-known',
];
const legacyAssets = new Set([
  '/user.png',
  '/favicon.png',
  '/favicon.ico',
  '/logo.png',
  '/install-opencode-studio.sh',
]);
const isBackend = (path: string) =>
  passthrough.some((prefix) => path === prefix || path.startsWith(prefix + '/')) ||
  legacyAssets.has(path);
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
function documentPolicy(html: string, python = false) {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/i.test(match[1]!))
    .map((match) => `'sha256-${createHash('sha256').update(match[2]!).digest('base64')}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}${python ? " 'unsafe-eval' 'wasm-unsafe-eval' http: https: blob:" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: ws: wss:" + (python ? ' http: data: blob:' : ''),
    "media-src 'self' blob: data: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(python ? ['sandbox allow-scripts'] : []),
  ].join('; ');
}
function error(res: ServerResponse, status: number, message: string) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ detail: message }));
}

export function createFrontendServer(options: Options) {
  const upstream = new URL(options.upstream);
  if (!['http:', 'https:'].includes(upstream.protocol))
    throw new Error('The upstream must use HTTP or HTTPS.');
  const transport = upstream.protocol === 'https:' ? https : http;
  const requestOptions = (req: IncomingMessage) => ({
    protocol: upstream.protocol,
    hostname: upstream.hostname,
    port: upstream.port || undefined,
    method: req.method,
    path: req.url,
    headers: { ...req.headers },
    timeout: 0,
  });
  const proxy = (req: IncomingMessage, res: ServerResponse) => {
    const outgoing = transport.request(requestOptions(req), (incoming) => {
      const path = new URL(req.url ?? '/', 'http://frontend.invalid').pathname;
      if (
        path.startsWith('/api/') &&
        !/^\/api\/v1\/files\/[^/]+\/content$/.test(path) &&
        !incoming.headers['content-disposition'] &&
        incoming.headers['content-type']?.includes('text/html')
      ) {
        // The upstream SPA also catches unknown /api routes. Preserve real HTML
        // file downloads, but never return an application shell as an API result.
        incoming.resume();
        error(res, 404, 'This API endpoint is unavailable.');
        return;
      }
      res.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(res);
      incoming.on('error', () => res.destroy());
    });
    outgoing.on('error', () => error(res, 502, 'The AI backend is temporarily unavailable.'));
    req.on('aborted', () => outgoing.destroy());
    res.on('close', () => {
      if (!res.writableEnded) outgoing.destroy();
    });
    req.pipe(outgoing);
  };
  async function fileFor(path: string, revision: string | null) {
    const current = await realpath(options.current);
    const roots = [current];
    if (options.releases) {
      for (const entry of await readdir(options.releases, { withFileTypes: true }))
        if (entry.isDirectory()) {
          const folder = resolve(options.releases, entry.name);
          if (folder !== current) roots.push(folder);
        }
    }
    let fallback: { file: string; size: number; etag: string; csp?: string } | undefined;
    for (const root of roots) {
      const file = join(root, path);
      let info;
      try {
        info = await stat(file);
      } catch {
        continue;
      }
      if (!info.isFile()) continue;
      const content = await readFile(file);
      const checksum = digest(content);
      const result = {
        file,
        size: info.size,
        etag: checksum,
        ...(path === 'index.html' || path === 'python-sandbox.html'
          ? { csp: documentPolicy(content.toString(), path === 'python-sandbox.html') }
          : {}),
      };
      fallback ??= result;
      const manifest =
        path === 'manifest.webmanifest'
          ? digest(JSON.stringify(JSON.parse(content.toString())))
          : '';
      if (!revision || checksum.startsWith(revision) || manifest.startsWith(revision))
        return result;
    }
    // A requested content revision must never be served different bytes.
    return revision ? undefined : fallback;
  }
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://frontend.invalid');
    if (isBackend(url.pathname)) {
      proxy(req, res);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method ?? '')) {
      error(res, 405, 'Method not allowed.');
      return;
    }
    if (url.pathname === '/__studio_health') {
      const build = JSON.parse(
        await readFile(join(options.current, 'homeframe-build.json'), 'utf8'),
      );
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'ok', build: build.buildId ?? build.id ?? null }));
      return;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      error(res, 400, 'Invalid path.');
      return;
    }
    if (
      decoded.includes('\0') ||
      decoded.includes('\\') ||
      decoded.split('/').some((part) => part === '..' || part.startsWith('.'))
    ) {
      error(res, 400, 'Invalid path.');
      return;
    }
    let path = decoded.replace(/^\/+/, '');
    if (path === 'manifest.json') path = 'manifest.webmanifest';
    const document =
      path === '' ||
      path === 'index.html' ||
      (!types[extname(path)] && !path.startsWith('assets/') && !path.startsWith('generated/'));
    if (document) path = 'index.html';
    const asset = await fileFor(path, document ? null : url.searchParams.get('v'));
    if (!asset) {
      error(res, 404, 'This resource is unavailable.');
      return;
    }
    const immutable =
      path !== 'manifest.webmanifest' && (/^assets\//.test(path) || !!url.searchParams.get('v'));
    const headers: Record<string, string | number> = {
      'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Content-Length': asset.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      ETag: `"${asset.etag}"`,
    };
    if (asset.csp) headers['Content-Security-Policy'] = asset.csp;
    if (path === 'sw.js') {
      headers['Cache-Control'] = 'no-cache';
      headers['Service-Worker-Allowed'] = '/';
    }
    if (req.headers['if-none-match'] === headers.ETag) {
      delete headers['Content-Length'];
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = createReadStream(asset.file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
    res.on('close', () => stream.destroy());
  }
  const server = http.createServer(
    (req, res) =>
      void handle(req, res).catch(() => error(res, 503, 'The frontend release is unavailable.')),
  );
  server.requestTimeout = 0;
  server.on('upgrade', (req, client: Duplex, head) => {
    const url = new URL(req.url ?? '/', 'http://frontend.invalid');
    if (!isBackend(url.pathname)) {
      client.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    const outgoing = transport.request(requestOptions(req));
    outgoing.on('upgrade', (response, remote, upstreamHead) => {
      client.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
      for (let i = 0; i < response.rawHeaders.length; i += 2)
        client.write(`${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}\r\n`);
      client.write('\r\n');
      if (upstreamHead.length) client.write(upstreamHead);
      if (head.length) remote.write(head);
      remote.pipe(client);
      client.pipe(remote);
      remote.on('error', () => client.destroy());
      client.on('error', () => remote.destroy());
      client.on('close', () => remote.destroy());
      remote.on('close', () => client.destroy());
    });
    outgoing.on('response', (response) => {
      client.end(`HTTP/1.1 ${response.statusCode ?? 502} Bad Gateway\r\nConnection: close\r\n\r\n`);
      response.resume();
    });
    outgoing.on('error', () => client.destroy());
    outgoing.end();
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const current = process.env.STUDIO_FRONTEND_CURRENT,
    upstream = process.env.STUDIO_UPSTREAM;
  if (!current || !upstream) throw new Error('Set STUDIO_FRONTEND_CURRENT and STUDIO_UPSTREAM.');
  const server = createFrontendServer({
    current,
    upstream,
    ...(process.env.STUDIO_FRONTEND_RELEASES
      ? { releases: process.env.STUDIO_FRONTEND_RELEASES }
      : {}),
  });
  server.listen(Number(process.env.PORT ?? 18082), process.env.HOST ?? '127.0.0.1', () =>
    console.log('Studio AI frontend is listening.'),
  );
  process.on('SIGTERM', () => {
    server.close();
    server.closeIdleConnections();
  });
}
