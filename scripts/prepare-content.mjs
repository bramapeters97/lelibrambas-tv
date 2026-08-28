import { syncArtworkAndCatalog } from './sync-artwork.mjs';

const sync = await syncArtworkAndCatalog();
console.log(
  `Prepared ${sync.artworkCount} artwork files and the runtime catalogue for the web viewer.`,
);
