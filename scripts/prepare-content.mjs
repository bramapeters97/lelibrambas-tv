import { generateMediaCatalog, printGenerationReport } from './generate-media-catalog.mjs';
import { syncArtworkAndCatalog } from './sync-artwork.mjs';

const generation = await generateMediaCatalog();
printGenerationReport(generation.report);
const sync = await syncArtworkAndCatalog();
console.log(
  `Prepared ${sync.artworkCount} artwork files and the runtime catalogue for the web viewer.`,
);
