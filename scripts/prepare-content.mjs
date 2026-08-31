import { syncArtworkAndCatalog } from './sync-artwork.mjs';

const sync = await syncArtworkAndCatalog();
console.log(
  sync.artworkSourceAvailable
    ? `Prepared ${sync.artworkCount} local artwork files and the runtime fallback catalogue ` +
        'for the web viewer.'
    : 'Prepared the runtime fallback catalogue; local artwork is absent and will be loaded ' +
        'from the Movies API.',
);
