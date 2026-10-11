import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = resolve(root, 'dist');
await rm(dist, { recursive:true, force:true });
await mkdir(dist, { recursive:true });
await cp(resolve(root, 'public'), dist, { recursive:true });
await writeFile(resolve(dist, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=/app/owner.html#/">
<title>Handy presentation demo</title></head><body>
<p>Opening <a href="/app/owner.html#/">Handy’s presentation demo</a>…</p>
<script>location.replace('/app/owner.html#/');</script></body></html>\n`);
console.log('Built static presentation demo in dist/');
