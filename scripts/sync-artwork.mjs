import { cp, copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceArtwork = resolve(repositoryRoot, 'artwork');
const sourceCatalog = resolve(repositoryRoot, 'data', 'media_catalog.json');

function assertInsideRepository(path, label) {
  const relativePath = relative(repositoryRoot, resolve(path));
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`Refusing unsafe ${label} path: ${path}`);
  }
}

async function detectWebPublicDirectory() {
  const candidates = [
    resolve(repositoryRoot, 'apps', 'tv', 'public'),
    resolve(repositoryRoot, 'public'),
  ];
  const matches = [];
  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isDirectory()) matches.push(candidate);
    } catch {
      // Candidate does not exist.
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one web public directory; found ${matches.length}: ${matches.join(', ') || 'none'}.`,
    );
  }
  return matches[0];
}

export async function syncArtworkAndCatalog() {
  const publicDirectory = await detectWebPublicDirectory();
  const artworkDestination = resolve(publicDirectory, 'artwork');
  const catalogDestination = resolve(publicDirectory, 'data', 'media_catalog.json');
  assertInsideRepository(artworkDestination, 'artwork destination');
  assertInsideRepository(catalogDestination, 'catalogue destination');

  await rm(artworkDestination, { recursive: true, force: true });
  await mkdir(artworkDestination, { recursive: true });
  await cp(sourceArtwork, artworkDestination, { recursive: true, force: true });
  await mkdir(dirname(catalogDestination), { recursive: true });
  await copyFile(sourceCatalog, catalogDestination);

  const copiedFiles = await readdir(artworkDestination, { recursive: true, withFileTypes: true });
  const artworkCount = copiedFiles.filter((entry) => entry.isFile()).length;
  return { publicDirectory, artworkDestination, catalogDestination, artworkCount };
}

function printSyncReport(report) {
  console.log(
    `Synced ${report.artworkCount} artwork files to ${relative(repositoryRoot, report.artworkDestination)}.`,
  );
  console.log(`Synced catalogue to ${relative(repositoryRoot, report.catalogDestination)}.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    printSyncReport(await syncArtworkAndCatalog());
  } catch (error) {
    console.error(`[artwork:sync] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
