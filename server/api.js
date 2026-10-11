import { demoActor } from './repairs.js';
import { AppError, requireCondition } from './validation.js';

// Shared by server/app.js (node:http) and app/api/[...lookb]/route.ts (Next.js).
export const maxBodyBytes = 22 * 1024 * 1024;
const integrations = [
  { name: 'Darwin', mode: 'demo', detail: 'Seeded directory fallback. Capability IDs and revisions retained.' },
  { name: 'Dial', mode: 'demo', detail: 'Scripted calls and transcripts; no provider contacted.' },
  { name: 'Keewano', mode: 'demo', detail: 'Ordered events and metrics in local SQLite; no remote Keewano service.' },
  { name: 'Alike', mode: 'demo', detail: 'Local repair handoff brief; no Alike API connection.' }
];

export function requireJSONType(contentType) {
  requireCondition(contentType?.split(';')[0].trim() === 'application/json', 'Use application/json for API requests.', 415);
}
export function parseJSONBody(raw) {
  let body;
  try { body = JSON.parse(raw); }
  catch { throw new AppError(400, 'Invalid JSON body.'); }
  requireCondition(body && typeof body === 'object' && !Array.isArray(body), 'A JSON object is required.');
  return body;
}
export function errorResponse(error) {
  const status = error instanceof AppError ? error.status : 500;
  if (status === 500) console.error('Handy request failed:', error?.name);
  return { status, body: { error: status === 500 ? 'An unexpected server error occurred.' : error.message } };
}

// readBody is an async thunk so only routes that take a body enforce JSON (415/400/413).
export async function handleApi(handy, { method, path, searchParams, readBody }) {
  const enrich = r => ({ ...r, events: handy.timeline(r.id), handoff: handy.handoff(r.id) });
  const bootstrap = () => ({ repairs: handy.listRepairs().map(enrich), properties: handy.properties(), metrics: handy.metrics(), integrations, actor: demoActor });
  const ok = (status, body) => ({ status, body });
  try {
    if (method === 'GET' && path === '/api/health') return ok(200, { status: 'ok', mode: 'demo', storage: 'sqlite' });
    if (method === 'GET' && path === '/api/bootstrap') return ok(200, bootstrap());
    if (method === 'GET' && path === '/api/properties') return ok(200, { properties: handy.properties() });
    if (method === 'POST' && path === '/api/properties') return ok(201, { property: handy.addProperty(await readBody()) });
    if (method === 'GET' && path === '/api/analytics') return ok(200, { metrics: handy.metrics() });
    if (method === 'GET' && path === '/api/repairs') return ok(200, { repairs: handy.listRepairs().filter(r => (!searchParams.has('property') || r.property === searchParams.get('property')) && (!searchParams.has('status') || r.status === searchParams.get('status'))).map(enrich) });
    if (method === 'POST' && path === '/api/repairs') return ok(201, { repair: enrich(handy.createRepair(await readBody())) });
    if (method === 'POST' && path === '/api/demo/reset') {
      const body = await readBody(); requireCondition(body.confirm === 'RESET DEMO', 'Confirm RESET DEMO before replacing local repairs.');
      handy.resetDemo(); return ok(200, bootstrap());
    }
    const match = path.match(/^\/api\/repairs\/([a-zA-Z0-9-]+)(?:\/(events|handoff|quotes|approve|book|reschedule|complete|reopen))?$/);
    if (match) {
      const [, id, action] = match;
      if (method === 'GET' && !action) return ok(200, { repair: enrich(handy.getRepair(id)) });
      if (method === 'GET' && action === 'events') return ok(200, { events: handy.timeline(id), source: 'demo:keewano-local-sqlite' });
      if (method === 'GET' && action === 'handoff') return ok(200, { handoff: handy.handoff(id) });
      if (method === 'PATCH' && !action) return ok(200, { repair: enrich(handy.updateRepair(id, await readBody())) });
      if (method === 'POST' && ['quotes', 'approve', 'book', 'reschedule', 'complete', 'reopen'].includes(action)) {
        const body = await readBody();
        const repair = action === 'quotes' ? handy.getQuotes(id) : action === 'approve' ? handy.approve(id, body)
          : action === 'book' ? handy.book(id, body) : handy[action](id);
        return ok(200, { repair: enrich(repair) });
      }
      throw new AppError(405, 'Method not allowed.');
    }
    throw new AppError(404, 'API route not found.');
  } catch (error) {
    return errorResponse(error);
  }
}
