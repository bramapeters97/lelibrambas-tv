import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import {
  FALLBACK_POSTER,
  REQUIRED_COLUMNS,
  generateMediaCatalog,
} from './generate-media-catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workbookPath = resolve(root, 'media_catalog_populated.xlsx');
const catalogPath = resolve(root, 'data', 'media_catalog.json');
const fallbackPath = resolve(root, FALLBACK_POSTER);

function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function workbookDataRowCount() {
  const workbook = XLSX.readFile(workbookPath, { raw: true });
  const sheetName = workbook.SheetNames[0];
  assert.ok(sheetName, 'Workbook must contain a first worksheet.');
  const worksheet = workbook.Sheets[sheetName];
  assert.ok(worksheet, `First worksheet ${sheetName} must exist.`);
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  const headerIndex = rows.findIndex((row) => row.some((value) => !isEmpty(value)));
  assert.ok(headerIndex >= 0, 'Workbook must contain a header row.');
  return rows.slice(headerIndex + 1).filter((row) => row.some((value) => !isEmpty(value))).length;
}

const canonicalText = await readFile(catalogPath, 'utf8');
const canonical = JSON.parse(canonicalText);
assert.ok(Array.isArray(canonical), 'Generated catalogue must be an array.');
assert.equal(
  canonical.length,
  workbookDataRowCount(),
  'Generated row count must equal non-empty Excel data rows.',
);

const ids = new Set();
const categories = new Set();
for (const [index, record] of canonical.entries()) {
  for (const key of REQUIRED_COLUMNS) {
    assert.ok(Object.hasOwn(record, key), `Record ${index + 1} must contain ${key}.`);
  }
  assert.equal(
    Object.keys(record).length,
    REQUIRED_COLUMNS.length,
    `Record ${index + 1} has extra keys.`,
  );
  assert.ok(Number.isInteger(record.id), `Record ${index + 1} id must be an integer.`);
  assert.ok(!ids.has(record.id), `Record ${index + 1} repeats id ${record.id}.`);
  ids.add(record.id);
  assert.equal(typeof record.title, 'string');
  assert.ok(record.title.length > 0, `Record ${record.id} title must not be empty.`);
  assert.ok(
    record.year === null || Number.isInteger(record.year),
    `Record ${record.id} year is invalid.`,
  );
  assert.equal(typeof record.description, 'string');
  assert.equal(typeof record.category, 'string');
  assert.ok(record.category.length > 0, `Record ${record.id} category must not be empty.`);
  categories.add(record.category);
  assert.equal(typeof record.stream_video_id, 'string');
  assert.ok(record.stream_video_id.length > 0, `Record ${record.id} stream URL must not be empty.`);

  const poster = record.poster_url;
  assert.equal(typeof poster, 'string');
  if (!/^https:\/\//i.test(poster)) {
    assert.ok(!poster.includes('..'), `Record ${record.id} poster contains traversal.`);
    assert.ok(!poster.includes('\\'), `Record ${record.id} poster contains a backslash.`);
    assert.ok(!/^([a-z]:|\/)/i.test(poster), `Record ${record.id} poster is absolute.`);
    assert.ok(!/^file:\/\//i.test(poster), `Record ${record.id} poster uses file://.`);
    await access(resolve(root, poster));
  }
}
assert.equal(categories.size, 4, 'Catalogue must contain exactly four categories.');
await access(fallbackPath);

const firstRun = await generateMediaCatalog({ write: false });
const secondRun = await generateMediaCatalog({ write: false });
assert.equal(firstRun.json, secondRun.json, 'Generator output must be deterministic between runs.');
assert.equal(
  firstRun.json,
  canonicalText,
  'Committed catalogue must match current generator output.',
);

const sourceFiles = [
  resolve(root, 'apps', 'tv', 'src', 'catalogue.ts'),
  resolve(root, 'apps', 'tv', 'src', 'App.tsx'),
  resolve(root, 'apps', 'tv', 'src', 'Discovery.tsx'),
  resolve(root, 'packages', 'catalog', 'src', 'index.ts'),
];
const forbiddenMediaFixtures =
  /folder-placeholder|archivePlaceholders|Jeugdfilm\s+0\d|Vakantiefilm\s+0\d|Evenementfilm\s+0\d|Overige film\s+0\d/;
for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, 'utf8');
  assert.ok(
    !forbiddenMediaFixtures.test(source),
    `${sourceFile} still contains hardcoded placeholder movie data.`,
  );
}

console.log(
  `Catalogue validation passed: ${canonical.length} rows, ${categories.size} categories, ${firstRun.report.fallbackRecords.length} fallback posters, deterministic output.`,
);
