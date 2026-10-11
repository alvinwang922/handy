import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { createHandy, demoActor } from './repairs.js';
import { AppError, requireCondition } from './validation.js';

const publicRoot = fileURLToPath(new URL('../public', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const integrations = [
  { name: 'Darwin', mode: 'demo', detail: 'Seeded directory fallback. Capability IDs and revisions retained.' },
  { name: 'Dial', mode: 'demo', detail: 'Scripted calls and transcripts; no provider contacted.' },
  { name: 'Keewano', mode: 'demo', detail: 'Ordered events and metrics in local SQLite; no remote Keewano service.' },
  { name: 'Alike', mode: 'demo', detail: 'Local repair handoff brief; no Alike API connection.' }
];
const maxBodyBytes = 22 * 1024 * 1024;
async function readJSON(req) {
  requireCondition(req.headers['content-type']?.split(';')[0].trim() === 'application/json', 'Use application/json for API requests.', 415);
  if (Number(req.headers['content-length']) > maxBodyBytes) { req.resume(); throw new AppError(413, 'Request is too large.'); }
  const chunks = []; let bytes = 0, oversized = false;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) oversized = true;
    if (!oversized) chunks.push(chunk);
  }
  requireCondition(!oversized, 'Request is too large.', 413);
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError(400, 'Invalid JSON body.'); }
  requireCondition(body && typeof body === 'object' && !Array.isArray(body), 'A JSON object is required.');
  return body;
}

export function createApp(options = {}) {
  const handy = createHandy(options);
  const enrich = r => ({ ...r, events: handy.timeline(r.id), handoff: handy.handoff(r.id) });
  const bootstrap = () => ({ repairs: handy.listRepairs().map(enrich), properties: handy.properties(), metrics: handy.metrics(), integrations, actor: demoActor });
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
      if (req.method === 'GET' && path === '/api/health') return json(200, { status: 'ok', mode: 'demo', storage: 'sqlite' });
      if (req.method === 'GET' && path === '/api/bootstrap') return json(200, bootstrap());
      if (req.method === 'GET' && path === '/api/properties') return json(200, { properties: handy.properties() });
      if (req.method === 'POST' && path === '/api/properties') return json(201, { property: handy.addProperty(await readJSON(req)) });
      if (req.method === 'GET' && path === '/api/analytics') return json(200, { metrics: handy.metrics() });
      if (req.method === 'GET' && path === '/api/repairs') return json(200, { repairs: handy.listRepairs().filter(r => (!url.searchParams.has('property') || r.property === url.searchParams.get('property')) && (!url.searchParams.has('status') || r.status === url.searchParams.get('status'))).map(enrich) });
      if (req.method === 'POST' && path === '/api/repairs') return json(201, { repair: enrich(handy.createRepair(await readJSON(req))) });
      if (req.method === 'POST' && path === '/api/demo/reset') {
        const body = await readJSON(req); requireCondition(body.confirm === 'RESET DEMO', 'Confirm RESET DEMO before replacing local repairs.');
        handy.resetDemo(); return json(200, bootstrap());
      }
      const match = path.match(/^\/api\/repairs\/([a-zA-Z0-9-]+)(?:\/(events|handoff|quotes|approve|book|reschedule|complete|reopen))?$/);
      if (match) {
        const [, id, action] = match;
        if (req.method === 'GET' && !action) return json(200, { repair: enrich(handy.getRepair(id)) });
        if (req.method === 'GET' && action === 'events') return json(200, { events: handy.timeline(id), source: 'demo:keewano-local-sqlite' });
        if (req.method === 'GET' && action === 'handoff') return json(200, { handoff: handy.handoff(id) });
        if (req.method === 'PATCH' && !action) return json(200, { repair: enrich(handy.updateRepair(id, await readJSON(req))) });
        if (req.method === 'POST' && ['quotes', 'approve', 'book', 'reschedule', 'complete', 'reopen'].includes(action)) {
          const body = await readJSON(req);
          const repair = action === 'quotes' ? handy.getQuotes(id) : action === 'approve' ? handy.approve(id, body)
            : action === 'book' ? handy.book(id, body) : handy[action](id);
          return json(200, { repair: enrich(repair) });
        }
        throw new AppError(405, 'Method not allowed.');
      }
      if (path.startsWith('/api/')) throw new AppError(404, 'API route not found.');
      requireCondition(['GET', 'HEAD'].includes(req.method), 'Method not allowed.', 405);
      let decoded;
      try { decoded = decodeURIComponent(path); } catch { throw new AppError(400, 'Invalid URL.'); }
      if (decoded === '/') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
      const file = resolve(publicRoot, `.${decoded.endsWith('/') ? decoded + 'index.html' : decoded}`);
      requireCondition(file.startsWith(publicRoot + sep) && !decoded.split('/').some(part => part.startsWith('.')), 'File not found.', 404);
      let content;
      try { content = await readFile(file); } catch { throw new AppError(404, 'File not found.'); }
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (res.headersSent) return res.end();
      const status = error instanceof AppError ? error.status : 500;
      json(status, { error: status === 500 ? 'An unexpected server error occurred.' : error.message });
      if (status === 500) console.error('Handy request failed:', error.name);
    }
  });
  server.requestTimeout = 30000;
  return { server, handy };
}
