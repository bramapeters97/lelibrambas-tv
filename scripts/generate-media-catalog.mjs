import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import XLSX from 'xlsx';

export const REQUIRED_COLUMNS = [
  'id',
  'title',
  'year',
  'description',
  'category',
  'poster_url',
  'stream_video_id',
];

export const FALLBACK_POSTER = 'artwork/generic_cinema_2.png';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, '..');
const defaultWorkbookPath = resolve(repositoryRoot, 'media_catalog_populated.xlsx');
const defaultArtworkDirectory = resolve(repositoryRoot, 'artwork');
const defaultOutputPath = resolve(repositoryRoot, 'data', 'media_catalog.json');

function cleanString(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function failRow(rowNumber, field, value, reason) {
  throw new Error(
    `Spreadsheet row ${rowNumber}: invalid ${field} value ${JSON.stringify(value)} (${reason}).`,
  );
}

function normalizeCategory(value, rowNumber, normalizations) {
  const category = cleanString(value);
  if (!category) failRow(rowNumber, 'category', value, 'value must not be empty');
  if (category.toUpperCase() === 'OTHER') {
    normalizations.push({ rowNumber, from: category, to: 'OTHERS' });
    return 'OTHERS';
  }
  return category;
}

async function walkPngFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkPngFiles(absolutePath, baseDirectory)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.png') {
      files.push({
        absolutePath,
        relativePath: relative(baseDirectory, absolutePath).split(sep).join('/'),
        basename: entry.name,
      });
    }
  }
  return files;
}

function localPosterCandidate(value) {
  let candidate = cleanString(value).replaceAll('\\', '/').split(/[?#]/, 1)[0]?.trim() ?? '';
  candidate = candidate.replace(/^[a-z]:\//i, '').replace(/^\/+/, '');
  const segments = candidate.split('/').filter((segment) => segment && segment !== '.');
  const artworkIndex = segments.findLastIndex((segment) => segment.toLowerCase() === 'artwork');
  if (artworkIndex >= 0) segments.splice(0, artworkIndex + 1);
  while (segments[0] === '..' || segments[0]?.toLowerCase() === 'root') segments.shift();
  return segments.join('/');
}

function chooseUniqueMatch(matches, candidate, kind) {
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous poster ${JSON.stringify(candidate)}: ${kind} matches ${matches
        .map((match) => match.relativePath)
        .join(', ')}.`,
    );
  }
  return matches[0] ?? null;
}

export function resolveLocalPoster(value, artworkFiles) {
  const raw = cleanString(value);
  if (/^https:\/\//i.test(raw)) {
    return { posterUrl: raw, resolution: 'remote' };
  }

  const candidate = localPosterCandidate(raw);
  if (candidate) {
    const exactPath = artworkFiles.find((file) => file.relativePath === candidate);
    if (exactPath) {
      return {
        posterUrl: `artwork/${exactPath.relativePath}`,
        resolution: exactPath.relativePath === basename(FALLBACK_POSTER) ? 'fallback' : 'local',
      };
    }

    const caseInsensitivePath = chooseUniqueMatch(
      artworkFiles.filter((file) => file.relativePath.toLowerCase() === candidate.toLowerCase()),
      candidate,
      'case-insensitive path',
    );
    if (caseInsensitivePath) {
      return {
        posterUrl: `artwork/${caseInsensitivePath.relativePath}`,
        resolution:
          caseInsensitivePath.relativePath === basename(FALLBACK_POSTER) ? 'fallback' : 'local',
      };
    }

    const candidateBasename = basename(candidate);
    const exactBasename = chooseUniqueMatch(
      artworkFiles.filter((file) => file.basename === candidateBasename),
      candidate,
      'basename',
    );
    if (exactBasename) {
      return {
        posterUrl: `artwork/${exactBasename.relativePath}`,
        resolution: exactBasename.relativePath === basename(FALLBACK_POSTER) ? 'fallback' : 'local',
      };
    }

    const caseInsensitiveBasename = chooseUniqueMatch(
      artworkFiles.filter(
        (file) => file.basename.toLowerCase() === candidateBasename.toLowerCase(),
      ),
      candidate,
      'case-insensitive basename',
    );
    if (caseInsensitiveBasename) {
      return {
        posterUrl: `artwork/${caseInsensitiveBasename.relativePath}`,
        resolution:
          caseInsensitiveBasename.relativePath === basename(FALLBACK_POSTER) ? 'fallback' : 'local',
      };
    }
  }

  return { posterUrl: FALLBACK_POSTER, resolution: 'fallback' };
}

export function classifyPlaybackUrl(value) {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.endsWith('.m3u8')) return { format: 'hls', compatible: true, warning: null };
    if (pathname.endsWith('.mp4')) return { format: 'mp4', compatible: true, warning: null };

    const hostname = parsed.hostname.toLowerCase();
    const isCloudflareStream =
      hostname === 'videodelivery.net' ||
      hostname.endsWith('.videodelivery.net') ||
      hostname.endsWith('.cloudflarestream.com');
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const tail = pathSegments.at(-1)?.toLowerCase();
    if (isCloudflareStream && (tail === 'watch' || tail === 'iframe')) {
      const warning =
        parsed.protocol === 'https:'
          ? null
          : `uses ${parsed.protocol} and must be upgraded to HTTPS before secure browser or native playback`;
      return { format: 'cloudflare-embed', compatible: true, warning };
    }
    return {
      format: 'unrecognized',
      compatible: false,
      warning: 'is not a recognized direct HLS, MP4, or Cloudflare Stream embed URL',
    };
  } catch {
    return { format: 'unrecognized', compatible: false, warning: 'is not a valid URL' };
  }
}

function readWorksheetRows(workbookPath) {
  const workbook = XLSX.readFile(workbookPath, { cellDates: false, raw: true });
  const firstWorksheetName = workbook.SheetNames[0];
  if (!firstWorksheetName) throw new Error('The workbook does not contain a worksheet.');
  const worksheet = workbook.Sheets[firstWorksheetName];
  if (!worksheet) throw new Error(`Could not read first worksheet ${firstWorksheetName}.`);
  return {
    worksheetName: firstWorksheetName,
    rows: XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    }),
  };
}

export async function generateMediaCatalog({
  workbookPath = defaultWorkbookPath,
  artworkDirectory = defaultArtworkDirectory,
  outputPath = defaultOutputPath,
  write = true,
} = {}) {
  const fallbackPath = resolve(artworkDirectory, basename(FALLBACK_POSTER));
  try {
    const fallbackStat = await stat(fallbackPath);
    if (!fallbackStat.isFile()) throw new Error('not a file');
  } catch {
    throw new Error(`Required fallback artwork is missing: ${fallbackPath}`);
  }

  const artworkFiles = await walkPngFiles(artworkDirectory);
  const { worksheetName, rows } = readWorksheetRows(workbookPath);
  const headerIndex = rows.findIndex((row) => row.some((value) => cleanString(value)));
  if (headerIndex < 0) throw new Error('The first worksheet is empty.');

  const headerRow = rows[headerIndex];
  const columns = new Map();
  for (const [index, value] of headerRow.entries()) {
    const header = cleanString(value).toLowerCase();
    if (!header) continue;
    if (columns.has(header)) {
      throw new Error(
        `Spreadsheet row ${headerIndex + 1}: duplicate column header ${JSON.stringify(value)}.`,
      );
    }
    columns.set(header, index);
  }
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !columns.has(column));
  if (missingColumns.length) {
    throw new Error(`Missing required worksheet columns: ${missingColumns.join(', ')}.`);
  }

  const ids = new Map();
  const records = [];
  const fallbackRecords = [];
  const categoryNormalizations = [];
  const playbackCounts = { hls: 0, mp4: 0, 'cloudflare-embed': 0, unrecognized: 0 };
  const playbackWarnings = [];
  let postersResolved = 0;
  let remotePosters = 0;

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.every((value) => !cleanString(value))) continue;
    const rowNumber = index + 1;
    const valueFor = (column) => row[columns.get(column)];

    const rawId = valueFor('id');
    const id = typeof rawId === 'number' ? rawId : Number(cleanString(rawId));
    if (!Number.isInteger(id)) failRow(rowNumber, 'id', rawId, 'expected an integer');
    if (ids.has(id)) {
      failRow(rowNumber, 'id', rawId, `duplicate of spreadsheet row ${ids.get(id)}`);
    }
    ids.set(id, rowNumber);

    const title = cleanString(valueFor('title'));
    if (!title) failRow(rowNumber, 'title', valueFor('title'), 'value must not be empty');

    const rawYear = valueFor('year');
    const yearText = cleanString(rawYear);
    const year = yearText ? (typeof rawYear === 'number' ? rawYear : Number(yearText)) : null;
    if (year !== null && !Number.isInteger(year)) {
      failRow(rowNumber, 'year', rawYear, 'expected an integer or an empty cell');
    }

    const category = normalizeCategory(valueFor('category'), rowNumber, categoryNormalizations);
    const streamVideoId = cleanString(valueFor('stream_video_id'));
    if (!streamVideoId) {
      failRow(rowNumber, 'stream_video_id', valueFor('stream_video_id'), 'value must not be empty');
    }

    const poster = resolveLocalPoster(valueFor('poster_url'), artworkFiles);
    if (poster.resolution === 'local') postersResolved += 1;
    if (poster.resolution === 'remote') remotePosters += 1;
    if (poster.resolution === 'fallback') fallbackRecords.push({ id, title });

    const playback = classifyPlaybackUrl(streamVideoId);
    playbackCounts[playback.format] += 1;
    if (playback.warning)
      playbackWarnings.push({ id, title, url: streamVideoId, warning: playback.warning });

    records.push({
      id,
      title,
      year,
      description: cleanString(valueFor('description')),
      category,
      poster_url: poster.posterUrl,
      stream_video_id: streamVideoId,
    });
  }

  records.sort((left, right) => left.id - right.id);
  fallbackRecords.sort((left, right) => left.id - right.id);
  const categoryCounts = Object.fromEntries(
    records.reduce((counts, record) => {
      counts.set(record.category, (counts.get(record.category) ?? 0) + 1);
      return counts;
    }, new Map()),
  );
  if (Object.keys(categoryCounts).length !== 4) {
    throw new Error(
      `Expected exactly four distinct categories after normalization; found ${Object.keys(categoryCounts).length}: ${Object.entries(
        categoryCounts,
      )
        .map(([category, count]) => `${category} (${count})`)
        .join(', ')}.`,
    );
  }

  const json = `${JSON.stringify(records, null, 2)}\n`;
  if (write) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json, 'utf8');
  }

  return {
    json,
    records,
    report: {
      worksheetName,
      totalRows: records.length,
      postersResolved,
      remotePosters,
      fallbackRecords,
      categoryCounts,
      categoryNormalizations,
      playbackCounts,
      playbackWarnings,
    },
  };
}

export function printGenerationReport(report) {
  console.log(
    `Generated ${report.totalRows} catalogue rows from worksheet ${report.worksheetName}.`,
  );
  console.log(`Posters resolved locally: ${report.postersResolved}`);
  console.log(`Remote poster URLs preserved: ${report.remotePosters}`);
  console.log(`Rows using ${FALLBACK_POSTER}: ${report.fallbackRecords.length}`);
  for (const record of report.fallbackRecords) console.log(`  - ${record.id}: ${record.title}`);
  console.log('Category counts:');
  for (const [category, count] of Object.entries(report.categoryCounts)) {
    console.log(`  - ${category}: ${count}`);
  }
  if (report.categoryNormalizations.length) {
    console.log('Approved category normalizations:');
    for (const change of report.categoryNormalizations) {
      console.log(`  - spreadsheet row ${change.rowNumber}: ${change.from} -> ${change.to}`);
    }
  }
  console.log('Playback URL formats:');
  console.log(`  - direct HLS (.m3u8): ${report.playbackCounts.hls}`);
  console.log(`  - direct MP4 (.mp4): ${report.playbackCounts.mp4}`);
  console.log(`  - Cloudflare Stream watch/embed: ${report.playbackCounts['cloudflare-embed']}`);
  console.log(`  - unrecognized: ${report.playbackCounts.unrecognized}`);
  console.log(`Playback compatibility warnings: ${report.playbackWarnings.length}`);
  for (const item of report.playbackWarnings) {
    console.log(`  - ${item.id}: ${item.title} - ${item.warning} (${item.url})`);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    const result = await generateMediaCatalog();
    printGenerationReport(result.report);
  } catch (error) {
    console.error(`[catalog:generate] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
