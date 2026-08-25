# ADR 0002: immutable sources and provider-neutral playback

Status: accepted.

OneDrive-synchronised folders and legacy discs are archive sources, never playback backends. Scans are read-only; derivatives, manifests, checksums and thumbnails go to a separate output root. Hydration failures, ambiguous DVD titles and metadata guesses become review states rather than destructive assumptions.

The viewer depends on a provider-neutral media interface. Local demos use generated MP4 files, development can serve converted local copies with byte ranges, and production can request short-lived signed HLS from Cloudflare Stream through the Worker. R2 contains approved custom artwork only, while D1 contains catalogue and device state. This boundary keeps provider credentials and vendor-specific payloads out of TV and Electron renderer bundles.
