import {
  createCatalogue,
  createCollections,
  profiles,
  type CatalogueVideoRecord,
} from '@lelibrambas/catalog';
import type { Collection } from '@lelibrambas/types';

export interface LoadedCatalogue {
  catalogue: CatalogueVideoRecord[];
  collections: Collection[];
}

export function catalogueRequestUrl(locationHref = window.location.href): string {
  return new URL('/data/media_catalog.json', locationHref).toString();
}

export async function loadCatalogue(
  fetcher: typeof fetch = fetch,
  locationHref = window.location.href,
): Promise<LoadedCatalogue> {
  const requestUrl = catalogueRequestUrl(locationHref);
  const response = await fetcher(requestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Catalogue request failed with HTTP ${response.status}.`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Catalogue response is not valid JSON.');
  }
  const catalogue = createCatalogue(payload);
  if (!catalogue.length) throw new Error('Catalogue contains no movies.');
  return { catalogue, collections: createCollections(catalogue) };
}

export { profiles };
export type { CatalogueVideoRecord };
