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

const jeugdfilmsGroups: ArchivePlaceholderGroup[] = [
  {
    name: 'Eline Maria Peters',
    movies: [
      'Eline Maria Peters (Part 1)',
      'Eline Maria Peters (Part 2)',
      'Eline Maria Peters (Part 3)',
      'Eline Maria Peters (Part 4)',
    ],
  },
  {
    name: 'Bram Albertus Peters',
    movies: [
      'Bram Albertus Peters (Part 1)',
      'Bram Albertus Peters (Part 2)',
      'Bram Albertus Peters (Part 3)',
    ],
  },
  {
    name: 'Zomervakanties',
    movies: ['Zomervakanties (Part 1)', 'Zomervakanties (Part 2)', 'Zomervakanties (Part 3)'],
  },
];

export const archivePlaceholderCategories: ArchivePlaceholderCategory[] = [
  {
    name: 'JEUGDFILMS',
    description: 'Childhood chapters grouped exactly like the private folder structure.',
    groups: jeugdfilmsGroups,
    movies: jeugdfilmsGroups.flatMap((group) => group.movies),
  },
  {
    name: 'VAKANTIEFILMS',
    description: 'Travel folders represented with synthetic catalogue-only placeholders.',
    movies: [
      'The United States of America (2013)',
      'The United States of America (2014)',
      'The United States of America (2015)',
      'South Africa',
      'Baltic Capitals',
      'Antalya, Turkey',
      'Mas Patoxas, Spain',
      'Corfu, Greece',
      'Frejus, France',
      'Argeles, France',
      'Val Thorens, France',
    ],
  },
  {
    name: 'EVENTS',
    description: 'Milestones and event folders kept as fictional demo entries.',
    movies: [
      'Huwelijk Bart & Astrid',
      'Jubileum J. Meijer B.V.',
      'Huwelijk Eline & Luca (Bram)',
      'Huwelijk Eline & Luca (Event)',
      'Gouden Bruiloft Opa en Oma',
      'Lucky (2004)',
      'Lucky (2013)',
    ],
  },
  {
    name: 'OVERIGE',
    description: 'Standalone folders for school, stage and everyday archive moments.',
    movies: [
      "Musical De Boskampi's",
      'Schoolkamp Nutterden',
      'Afsluiting Basisschool',
      'Bram & Astrid in de Goliath',
    ],
  },
];

export const archivePlaceholders: ArchivePlaceholder[] = archivePlaceholderCategories.flatMap(
  (category, categoryIndex): ArchivePlaceholder[] => {
    if (category.groups?.length) {
      let itemIndex = 0;
      return category.groups.flatMap((group) =>
        group.movies.map((title) => ({
          title,
          category: category.name,
          group: group.name,
          directory: [category.name, group.name, title],
          categoryIndex,
          itemIndex: itemIndex++,
        })),
      );
    }

    return category.movies.map((title, itemIndex) => ({
      title,
      category: category.name,
      group: null,
      directory: [category.name, title],
      categoryIndex,
      itemIndex,
    }));
  },
);
