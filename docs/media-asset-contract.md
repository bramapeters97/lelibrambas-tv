# Media asset contract

`data/media_catalog.json` is the canonical generated catalogue. Every local poster is represented
as a logical, platform-neutral value:

```text
artwork/<filename>.png
```

The path never contains a leading slash, drive letter, parent traversal, backslash, or `file://`
URL. A complete remote `https://` poster URL remains unchanged. Missing local posters resolve to
`artwork/generic_cinema_2.png` during generation.

## Web mapping

`apps/tv/src/media.ts` maps `artwork/<filename>.png` to `/artwork/<filename>.png`. The content
preparation workflow copies the repository-root `artwork/` tree to `apps/tv/public/artwork/` and
copies the generated JSON to `apps/tv/public/data/media_catalog.json`. An image load failure is
replaced once with `/artwork/generic_cinema_2.png`; the one-shot guard prevents an error loop if the
fallback itself is unavailable.

Root-relative browser paths also survive a nested application URL. Electron's standard custom
protocol maps the same `/artwork/` and `/data/` URLs into its packaged Vite output.

## Apple TV mapping

This Windows workspace has Expo tvOS source configuration but no generated or committed Xcode
tvOS target; `apps/tv/ios/` is disposable Continuous Native Generation output. Therefore no Swift
resource file is edited here. When a committed native target is added, its resource build phase
must include the root artwork files and `data/media_catalog.json`. Its artwork resolver should:

1. return remote `https://` poster URLs unchanged;
2. remove the `artwork/` prefix from local values;
3. resolve the remaining path or filename from `Bundle.main`;
4. fall back to `generic_cinema_2.png`.

The JSON does not need to be rewritten for that native mapping.

## Duration metadata

The seven-column workbook and generated JSON do not currently contain authoritative runtimes.
Catalogue records therefore expose `durationSeconds` as `null` until playback or provider metadata
supplies a finite positive duration. Cards and details omit the runtime until it is known; the player
may use neutral `Duration unavailable` copy. The viewer must not substitute a universal estimate.

## Playback URLs

The JSON preserves each spreadsheet `stream_video_id` exactly. The web resolver supports direct
MP4, direct HLS, and Cloudflare Stream watch/iframe URLs. Direct MP4 and HLS use the native video
element (with `hls.js` when the browser lacks native HLS). Cloudflare watch/iframe values use the
secure responsive Stream iframe.

Cloudflare documents the corresponding HLS shape as
`https://customer-<CODE>.cloudflarestream.com/<UID>/manifest/video.m3u8`. The native resolver uses
only the host and UID already present in a valid Stream watch/iframe URL to derive that manifest;
it does not invent an account, domain, token, or secret. See
[Cloudflare: use your own player](https://developers.cloudflare.com/stream/viewing-videos/using-own-player/)
and [Cloudflare: Stream player](https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/).

An iframe itself is browser-only and must not be passed to `AVPlayer`. The derived HLS URL is the
tvOS-compatible source for these catalogue values.
