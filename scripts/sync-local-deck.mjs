import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(repo, 'apps/deck');
const target = resolve(repo, 'apps/companion/internal/localserver/web');

await rm(target, { recursive:true, force:true });
await mkdir(target, { recursive:true });
for (const name of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js']) {
  await cp(resolve(source, name), resolve(target, name));
}
await cp(resolve(source, 'js'), resolve(target, 'js'), { recursive:true });
await cp(resolve(source, 'assets'), resolve(target, 'assets'), { recursive:true });
console.log('Local Deck sincronizado com apps/deck.');
