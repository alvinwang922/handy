import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createLiveClient } from './integrations/live.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const mode = process.env.INTEGRATION_MODE ?? 'demo';
if (!['demo', 'live'].includes(mode)) throw new Error('INTEGRATION_MODE must be demo or live.');
// Live mode delegates diagnosis, outreach and booking to the Next.js backend (npm run dev).
const liveApi = process.env.HANDY_LIVE_API ?? 'http://127.0.0.1:3000';
if (mode === 'live' && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(liveApi)) throw new Error('HANDY_LIVE_API must be a local http origin, e.g. http://127.0.0.1:3000.');
const { server, handy } = createApp({ dataPath: resolve(projectRoot, process.env.DATA_PATH ?? 'data/handy.sqlite'), live: mode === 'live' ? createLiveClient(liveApi) : null });
server.on('error', error => { console.error(`Cannot start Handy: ${error.code}. Check whether port ${port} is already in use.`); handy.close(); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Handy is running at http://127.0.0.1:${port}\n${mode === 'live'
  ? `Live mode: Maple House, Oak Street and Cedar Cottage use the backend at ${liveApi} (real Claude, Keewano and Dial). Added houses and samples stay demo.`
  : 'Demo integrations · data persists in local SQLite.'}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { handy.close(); process.exit(0); }));
