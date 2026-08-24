# Source-preserving video import

The CLI in `tools/video-importer` scans ordinary media and unencrypted `VIDEO_TS` folders, writes reviewable manifests/job state, and creates separate H.264/AAC viewing copies. It never deletes or intentionally overwrites source media.

The Library Manager's import screens are a UI prototype only; they do not launch this CLI. Run commands from PowerShell at the project root.

## Prerequisites

Make `ffmpeg` and `ffprobe` available on `Path`; add `HandBrakeCLI` for better DVD metadata.

```powershell
ffmpeg -version
ffprobe -version
HandBrakeCLI --version
corepack yarn importer help
```

For OneDrive, select **Always keep on this device** and wait for sync. The scanner flags unreadable and zero-byte OneDrive placeholders, but cannot guarantee every cloud placeholder state is detected.

## Recommended workflow

Choose output outside the source archive. Keep the manifest and state under local application data so their absolute paths cannot be committed accidentally. A preparation dry run scans/probes and reports the proposed paths/count without writing manifest or state:

```powershell
$leliSource = 'D:\Family Videos'
$leliJobRoot = Join-Path $env:LOCALAPPDATA 'LeliBramBasPlus\video-importer\jobs'
New-Item -ItemType Directory -Path $leliJobRoot -Force | Out-Null
$leliManifest = Join-Path $leliJobRoot 'family-catalog.csv'
$leliOutput = Join-Path $env:LOCALAPPDATA 'LeliBramBasPlus\video-importer\viewing-copies'
corepack yarn importer prepare `
  --folder "$leliSource" `
  --output "$leliOutput" `
  --dry-run
```

Run `prepare` with `--manifest` to create the manifest and sibling `.state.json`:

```powershell
corepack yarn importer prepare `
  --folder "$leliSource" `
  --manifest "$leliManifest" `
  --output "$leliOutput"
$leliState = Join-Path $leliJobRoot 'family-catalog.state.json'
```

CSV and JSON are supported. The manifest contains absolute local paths, technical metadata, duplicates, hydration flags, inferred metadata, confidence, and review notes. Treat it as private. Only the tool-scoped `tools/video-importer/imports/` and `.state/` paths are currently ignored; a project-root `imports/` directory is not, so do not use the shorter tracked-looking example.

Preview exact FFmpeg plans without running FFmpeg or creating conversion output:

```powershell
corepack yarn importer convert `
  --manifest "$leliManifest" `
  --concurrency 1 `
  --dry-run
```

Convert, inspect, resume, verify checksums, and export errors:

```powershell
corepack yarn importer convert --manifest "$leliManifest" --state "$leliState" --concurrency 1
corepack yarn importer status --state "$leliState"
corepack yarn importer resume --state "$leliState" --concurrency 1
corepack yarn importer verify --state "$leliState"
$leliErrors = Join-Path $leliJobRoot 'family-errors.csv'
corepack yarn importer export-errors `
  --state "$leliState" `
  --output "$leliErrors"
```

Retries default to 2. Concurrency is clamped to 1-8; use 1 for optical/slow media and first validation. Resume skips completed entries. Ctrl+C records interruption at the current safe boundary.

## Scan-only mode

`scan` is read-only and prints JSON unless `--manifest` is supplied:

```powershell
corepack yarn importer scan --folder "$leliSource"
corepack yarn importer scan `
  --folder "$leliSource" `
  --manifest "$(Join-Path $leliJobRoot 'scan.json')" `
  --output "$leliOutput"
```

`scan` does **not** accept `--dry-run`; it already performs no conversion. `prepare`, `convert`, and `resume` accept that flag. Without `--output`, copies default to `%LOCALAPPDATA%\LeliBramBasPlus\video-importer\viewing-copies`.

## Safety and conversion behavior

- Symbolic-link entries are skipped.
- Output inside source, an escaping output path, and source/output identity are rejected.
- Sampled-fingerprint duplicates and hydration-required entries are skipped; review both classifications.
- FFmpeg writes `.mp4.partial` and promotes only a non-empty successful result.
- Atomic state/manifest writes, checksums, bounded retries, and idempotent completed entries support resume.
- Output is H.264/AAC 192 kbps, `yuv420p`, fast-start MP4. No upscaling, cropping, sharpening, or fixed frame rate is requested; detected interlacing uses `bwdif`.
- Optional audio streams are mapped. Subtitle tracks are probed into metadata but are not mapped into the MP4 output.
- `verify` checks existence, non-zero size, and checksum, not a full decode. Spot-check representative outputs in target players.

## `VIDEO_TS`

Recognition requires `VIDEO_TS.IFO` and playable `VTS_nn_n.VOB` files. Menu `_0.VOB` files are ignored. HandBrakeCLI improves title/chapter/duration discovery; FFmpeg still converts the selected sequential VOB group. Without reliable HandBrake mapping, candidates are conservatively grouped and marked for review.

The tool does not decrypt or bypass copy protection. Use only user-authored or lawfully usable unencrypted media. Keep originals and an independent backup; viewing copies are not archival masters.

HandBrakeCLI title discovery records duration/chapter information when mappings are clear, but current concat-based conversion does not guarantee DVD chapter preservation. Subtitle tracks are probed into the manifest but are not mapped into the current MP4 derivative. Preserve the original DVD structure and review these limitations before a bulk job.

See [`tools/video-importer/README.md`](tools/video-importer/README.md) and [ADR 0002](docs/decisions/0002-private-media-pipeline.md).
