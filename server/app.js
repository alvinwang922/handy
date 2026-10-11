import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { createHandy } from './repairs.js';
import { AppError, requireCondition } from './validation.js';
import { handleApi, errorResponse, maxBodyBytes, parseJSONBody, requireJSONType } from './api.js';

const publicRoot = fileURLToPath(new URL('../public', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
async function readJSON(req) {
  requireJSONType(req.headers['content-type']);
  if (Number(req.headers['content-length']) > maxBodyBytes) { req.resume(); throw new AppError(413, 'Request is too large.'); }
  const chunks = []; let bytes = 0, oversized = false;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) oversized = true;
    if (!oversized) chunks.push(chunk);
  }
  requireCondition(!oversized, 'Request is too large.', 413);
  return parseJSONBody(Buffer.concat(chunks).toString('utf8'));
}

export function createApp(options = {}) {
  const handy = createHandy(options);
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const json = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    try {
      const host = req.headers.host ?? '';
      requireCondition(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host), 'Only local hosts are allowed.', 403);
      requireCondition(!req.headers.origin || req.headers.origin === `http://${host}`, 'Foreign origins are not allowed.', 403);
      const url = new URL(req.url, `http://${host}`), path = url.pathname;
      if (path.startsWith('/api/')) {
        const { status, body } = await handleApi(handy, { method: req.method, path, searchParams: url.searchParams, readBody: () => readJSON(req) });
        return json(status, body);
      }
      requireCondition(['GET', 'HEAD'].includes(req.method), 'Method not allowed.', 405);
      let decoded;
      try { decoded = decodeURIComponent(path); } catch { throw new AppError(400, 'Invalid URL.'); }
      const file = resolve(publicRoot, decoded === '/' ? 'index.html' : `.${decoded.endsWith('/') ? decoded + 'index.html' : decoded}`);
      requireCondition(file.startsWith(publicRoot + sep) && !decoded.split('/').some(part => part.startsWith('.')), 'File not found.', 404);
      let content;
      try { content = await readFile(file); } catch { throw new AppError(404, 'File not found.'); }
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (res.headersSent) return res.end();
      const { status, body } = errorResponse(error);
      json(status, body);
    }
  });
  server.requestTimeout = 30000;
  return { server, handy };
}
