import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tvDist = resolve(desktopDirectory, '../tv/dist');
const indexPath = resolve(tvDist, 'index.html');

await access(indexPath);
const html = await readFile(indexPath, 'utf8');
const localAssets = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)(?:[?#][^"]*)?"/g)]
  .map((match) => match[1])
  .filter(Boolean);

if (localAssets.length === 0) {
  throw new Error('The TV build index does not reference any bundled assets.');
}

await Promise.all(localAssets.map((asset) => access(resolve(tvDist, asset))));
console.log(`[desktop-build] Verified TV renderer: ${localAssets.length} bundled asset(s).`);
