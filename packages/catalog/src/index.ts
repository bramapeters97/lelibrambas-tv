import {
  validateCatalogue,
  type Collection,
  type HomeRail,
  type Person,
  type Place,
  type Profile,
  type VideoRecord,
} from '@lelibrambas/types';
import { archivePlaceholderCategories, archivePlaceholders } from './archive-placeholders';

export { archivePlaceholderCategories, archivePlaceholders } from './archive-placeholders';

const palettes: Array<[string, string, string]> = [
  ['#241A22', '#6E4A3E', '#E9C778'],
  ['#10213D', '#25718A', '#D7B16A'],
  ['#2B233F', '#705B91', '#F0C58B'],
  ['#132B2B', '#417C6A', '#D5BE7C'],
  ['#311927', '#9B4E55', '#F0C58B'],
  ['#2B1E19', '#8E5A42', '#F1D7A1'],
  ['#07192A', '#254B75', '#8FC7E8'],
  ['#241B34', '#71556D', '#DCA86C'],
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function yearFromFolderName(title: string): number | null {
  const match = /\((\d{4})(?:\s*-\s*\d{4})?\)$/.exec(title);
  return match?.[1] ? Number(match[1]) : null;
}

const rawCatalogue: VideoRecord[] = archivePlaceholders.map((placeholder, index) => {
  const id = `folder-placeholder-${String(index + 1).padStart(2, '0')}`;
  const year = yearFromFolderName(placeholder.title);
  const collectionId = slugify(placeholder.category);
  const palette = palettes[index % palettes.length] ?? palettes[0]!;

  return {
    id,
    slug: slugify(placeholder.title),
    title: placeholder.title,
    subtitle: `${placeholder.category} - fictional catalogue placeholder`,
    description:
      'This fictional catalogue-only record preserves the private archive structure without exposing family names, places, filenames or source media.',
    originalFilename: `synthetic-folder-entry-${String(index + 1).padStart(2, '0')}.placeholder`,
    sourceType: 'synthetic',
    recordingDate: year ? `${year}-01-01` : null,
    dateApproximate: true,
    year,
    durationSeconds: 1,
    aspectRatio: 'unknown',
    resolution: 'Not inspected',
    frameRate: 25,
    interlaced: false,
    people: ['Synthetic family'],
    location: 'Synthetic archive',
    country: null,
    tags: [placeholder.category, 'Synthetic placeholder', 'Media not inspected'],
    categories: [placeholder.category],
    collectionId,
    seasonNumber: null,
    episodeNumber: placeholder.itemIndex + 1,
    artwork: {
      thumbnail: `/artwork/${id}-thumb.webp`,
      landscape: `/artwork/${id}-landscape.webp`,
      portrait: `/artwork/${id}-portrait.webp`,
      backdrop: `/artwork/${id}-backdrop.webp`,
      palette,
    },
    previewStartSeconds: 0,
    featured: archivePlaceholderCategories.some(
      (category) => category.movies[0] === placeholder.title,
    ),
    visibility: 'family',
    processingStatus: 'unavailable',
    playbackProvider: 'local',
    playbackAssetId: null,
    playbackUrl: null,
    progressSeconds: 0,
    lastWatched: null,
    addedDate: '2026-08-17T12:00:00.000Z',
    restorationNotes:
      'Fictional demo placeholder only. No original media, private metadata or source files have been inspected or bundled.',
    legacyFormat: null,
    chapterMarkers: [],
    playCount: 0,
  };
});

export const catalogue = validateCatalogue(rawCatalogue);

export const profiles: Profile[] = [
  {
    id: 'bart-astrid',
    name: 'Bart & Astrid',
    initials: 'BA',
    accent: '#70D8FF',
    watchlist: ['folder-placeholder-01', 'folder-placeholder-03'],
    recentlyDiscovered: ['JEUGDFILMS', 'VAKANTIEFILMS'],
  },
  {
    id: 'bram-edvin',
    name: 'Bram & Edvin',
    initials: 'BE',
    accent: '#8275FF',
    watchlist: ['folder-placeholder-11'],
    recentlyDiscovered: ['OVERIGE'],
  },
  {
    id: 'eline-luca',
    name: 'Eline & Luca',
    initials: 'EL',
    accent: '#E9C778',
    watchlist: ['folder-placeholder-02', 'folder-placeholder-18'],
    recentlyDiscovered: ['JEUGDFILMS', 'EVENTS', 'OVERIGE', 'VAKANTIEFILMS'],
  },
];

export const people: Person[] = [
  {
    id: 'synthetic-family',
    name: 'Synthetic Family',
    initials: 'SF',
    accent: '#E9C778',
    description:
      'Synthetic placeholder metadata only; people in the media have not been identified.',
  },
];

export const places: Place[] = [
  {
    id: 'synthetic-archive',
    name: 'Synthetic Archive',
    country: 'Fictional collection',
    description: 'Fictional placeholders only. Media locations have not been inspected.',
    palette: ['#241A22', '#6E4A3E', '#E9C778'],
  },
];

const idsForCategory = (category: string) =>
  catalogue.filter((video) => video.categories.includes(category)).map((video) => video.id);

const idsForTitles = (titles: readonly string[]) =>
  catalogue.filter((video) => titles.includes(video.title)).map((video) => video.id);

export const collections: Collection[] = archivePlaceholderCategories.map((category) => ({
  id: slugify(category.name),
  title: category.name,
  kind: category.name === 'VAKANTIEFILMS' ? 'holiday' : 'curated',
  description: category.description,
  videoIds: idsForCategory(category.name),
}));

export const homeRails: HomeRail[] = [
  {
    id: 'all-folder-placeholders',
    title: 'Complete private directory',
    order: 0,
    visible: true,
    videoIds: catalogue.map((video) => video.id),
  },
  ...archivePlaceholderCategories.map((category, index) => ({
    id: slugify(category.name),
    title: category.name,
    order: index + 1,
    visible: true,
    videoIds: idsForCategory(category.name),
  })),
  ...archivePlaceholderCategories.flatMap(
    (category, categoryIndex) =>
      category.groups?.map((group, groupIndex) => ({
        id: `${slugify(category.name)}-${slugify(group.name)}`,
        title: `${category.name} / ${group.name}`,
        order: archivePlaceholderCategories.length + categoryIndex * 10 + groupIndex + 1,
        visible: true,
        videoIds: idsForTitles(group.movies),
      })) ?? [],
  ),
];

export function getVideo(idOrSlug: string): VideoRecord | undefined {
  return catalogue.find((video) => video.id === idOrSlug || video.slug === idOrSlug);
}

export function surpriseMe(): VideoRecord {
  return catalogue[0]!;
}
