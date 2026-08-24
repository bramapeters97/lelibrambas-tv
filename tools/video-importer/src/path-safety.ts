import path from 'node:path';

export function isPathInside(parentPath: string, candidatePath: string): boolean {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

export function assertOutputOutsideSource(sourceRoot: string, outputRoot: string): void {
  if (isPathInside(sourceRoot, outputRoot)) {
    throw new Error(`Refusing to place importer output inside the source archive: ${outputRoot}`);
  }
}

export function assertDistinctFile(sourcePath: string, outputPath: string): void {
  if (
    path.resolve(sourcePath).toLocaleLowerCase() === path.resolve(outputPath).toLocaleLowerCase()
  ) {
    throw new Error(`Refusing to overwrite source media: ${sourcePath}`);
  }
}

export function sanitizeOutputStem(value: string): string {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/gu, ' ')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? ' ' : character))
    .join('')
    .replace(/\s+/gu, ' ')
    .replace(/[. ]+$/gu, '')
    .trim();
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu;
  const safe = cleaned.length === 0 || reserved.test(cleaned) ? 'untitled-video' : cleaned;
  return safe.slice(0, 120);
}
