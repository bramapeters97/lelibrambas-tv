import {
  createCatalogue,
  createCollections,
  profiles,
  type CatalogueVideoRecord,
} from '@lelibrambas/catalog';
import type { Collection } from '@lelibrambas/types';

export const DEFAULT_MOVIES_API_URL = 'https://lelibrambas-api.bramapeters.workers.dev/api/movies';

export interface LoadedCatalogue {
  catalogue: CatalogueVideoRecord[];
  collections: Collection[];
  source: 'api' | 'fallback';
}

export function moviesApiRequestUrl(configuredUrl = import.meta.env.VITE_MOVIES_API_URL): string {
  return configuredUrl?.trim() || DEFAULT_MOVIES_API_URL;
}

export function catalogueRequestUrl(locationHref = window.location.href): string {
  return new URL('/data/media_catalog.json', locationHref).toString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchPayload(fetcher: typeof fetch, requestUrl: string): Promise<unknown> {
  const response = await fetcher(requestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Catalogue request failed with HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Catalogue response is not valid JSON.');
  }
}

function collectionsInCatalogueOrder(catalogue: readonly CatalogueVideoRecord[]): Collection[] {
  return createCollections(catalogue).map((collection) => ({
    ...collection,
    videoIds: catalogue
      .filter((video) => video.categories.includes(collection.title))
      .map((video) => video.id),
  }));
}

export function orderCatalogueByPriority(
  catalogue: readonly CatalogueVideoRecord[],
): CatalogueVideoRecord[] {
  return catalogue
    .map((video, index) => ({ video, index }))
    .sort(
      (left, right) =>
        Number(right.video.priority) - Number(left.video.priority) || left.index - right.index,
    )
    .map(({ video }) => video);
}

export function featuredCatalogue(
  catalogue: readonly CatalogueVideoRecord[],
): CatalogueVideoRecord[] {
  return catalogue.filter((video) => video.featured);
}

function loadedCatalogue(
  catalogue: CatalogueVideoRecord[],
  source: LoadedCatalogue['source'],
): LoadedCatalogue {
  if (!catalogue.length) throw new Error('Catalogue contains no movies.');
  const orderedCatalogue = orderCatalogueByPriority(catalogue);
  return {
    catalogue: orderedCatalogue,
    collections: collectionsInCatalogueOrder(orderedCatalogue),
    source,
  };
}

function apiCatalogue(payload: unknown): CatalogueVideoRecord[] {
  if (!Array.isArray(payload)) throw new Error('Movies API response must be a JSON array.');

  const createdAtById = new Map<number, string>();
  const normalizedPayload = payload.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Movies API item ${index + 1} must be an object.`);
    }
    const record = value as Record<string, unknown>;
    if (typeof record.created_at !== 'string') {
      throw new Error(`Movies API item ${index + 1} has an invalid created_at.`);
    }
    const id =
      typeof record.id === 'string' && /^\d+$/.test(record.id.trim())
        ? Number(record.id)
        : record.id;
    if (!Number.isInteger(id)) {
      throw new Error(`Movies API item ${index + 1} has an invalid integer id.`);
    }
    createdAtById.set(id as number, record.created_at);
    return { ...record, id };
  });

  const normalizedById = new Map(
    createCatalogue(normalizedPayload).map((video) => [video.catalogueId, video] as const),
  );
  return normalizedPayload.map((record) => {
    const id = record.id as number;
    const video = normalizedById.get(id);
    if (!video) throw new Error(`Movies API item ${id} could not be normalized.`);
    return { ...video, addedDate: createdAtById.get(id)! };
  });
}

export async function loadCatalogue(
  fetcher: typeof fetch = fetch,
  locationHref = window.location.href,
  apiUrl = moviesApiRequestUrl(),
): Promise<LoadedCatalogue> {
  let apiError: unknown;
  try {
    const payload = await fetchPayload(fetcher, apiUrl);
    return loadedCatalogue(apiCatalogue(payload), 'api');
  } catch (error) {
    apiError = error;
  }

  try {
    const payload = await fetchPayload(fetcher, catalogueRequestUrl(locationHref));
    return loadedCatalogue(createCatalogue(payload), 'fallback');
  } catch (fallbackError) {
    throw new Error(
      `Movies API failed (${errorMessage(apiError)}); local fallback failed (${errorMessage(fallbackError)}).`,
    );
  }
}

export { profiles };
export type { CatalogueVideoRecord };
