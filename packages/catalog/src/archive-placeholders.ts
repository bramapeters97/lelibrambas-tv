export interface ArchivePlaceholderGroup {
  name: string;
  movies: string[];
}

export interface ArchivePlaceholderCategory {
  name: string;
  description: string;
  movies: string[];
  groups?: ArchivePlaceholderGroup[];
}

export interface ArchivePlaceholder {
  title: string;
  category: string;
  group: string | null;
  directory: string[];
  categoryIndex: number;
  itemIndex: number;
}

interface PlaceholderCategorySeed {
  name: string;
  description: string;
  titlePrefix: string;
  itemCount: number;
}

function orderedTitles(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix} ${String(index + 1).padStart(2, '0')}`,
  );
}

// These counts and their order mirror the private directory at a structural level only.
// Titles are intentionally fictional so no family names, places or source filenames are checked in.
const categorySeeds: PlaceholderCategorySeed[] = [
  {
    name: 'JEUGDFILMS',
    description: 'Three fictional childhood-film placeholders for the private archive prototype.',
    titlePrefix: 'Jeugdfilm',
    itemCount: 3,
  },
  {
    name: 'VAKANTIEFILMS',
    description: 'Seventeen fictional holiday-film placeholders for the private archive prototype.',
    titlePrefix: 'Vakantiefilm',
    itemCount: 17,
  },
  {
    name: 'EVENTS',
    description: 'Eight fictional event-film placeholders for the private archive prototype.',
    titlePrefix: 'Evenementfilm',
    itemCount: 8,
  },
  {
    name: 'OVERIGE',
    description:
      'Seven fictional miscellaneous-film placeholders for the private archive prototype.',
    titlePrefix: 'Overige film',
    itemCount: 7,
  },
];

export const archivePlaceholderCategories: ArchivePlaceholderCategory[] = categorySeeds.map(
  (seed) => ({
    name: seed.name,
    description: seed.description,
    movies: orderedTitles(seed.titlePrefix, seed.itemCount),
  }),
);

export const archivePlaceholders: ArchivePlaceholder[] = archivePlaceholderCategories.flatMap(
  (category, categoryIndex) =>
    category.movies.map((title, itemIndex) => ({
      title,
      category: category.name,
      group: null,
      directory: [category.name, title],
      categoryIndex,
      itemIndex,
    })),
);
