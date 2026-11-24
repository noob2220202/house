#!/usr/bin/env node
// Static /media/* server for the e2e stack — stands in for nginx (production serves UPLOAD_DIR at
// /media/*; the API itself never serves files). The Next apps rewrite /media/* here (MEDIA_ORIGIN).
// Usage: E2E_MEDIA_ROOT=… E2E_MEDIA_PORT=4101 node scripts/e2e/media-server.mjs
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.env.E2E_MEDIA_ROOT ?? '.tmp/e2e/uploads');
const port = Number(process.env.E2E_MEDIA_PORT ?? 4101);
const TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://media.local');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  if (!url.pathname.startsWith('/media/') || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404).end();
    return;
  }
  const rel = decodeURIComponent(url.pathname.slice('/media/'.length));
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-store',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`media server on :${port} serving ${root}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
