import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
if (process.env.INTEGRATION_MODE && process.env.INTEGRATION_MODE !== 'demo') throw new Error('Only demo integration mode is implemented.');
const { server, handy } = createApp({ dataPath: resolve(projectRoot, process.env.DATA_PATH ?? 'data/handy.sqlite') });
server.on('error', error => { console.error(`Cannot start Handy: ${error.code}. Check whether port ${port} is already in use.`); handy.close(); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Handy is running at http://127.0.0.1:${port}\nDemo integrations · data persists in local SQLite.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { handy.close(); process.exit(0); }));
