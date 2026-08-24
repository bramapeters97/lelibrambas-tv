# LeliBramBas+ video importer

Use [`../../README_VIDEO_IMPORT.md`](../../README_VIDEO_IMPORT.md) for the complete Windows workflow and safe LocalAppData paths. The short `\.\imports` paths below are illustrative only and are not ignored at the project root.

This Windows-first CLI scans ordinary home-video files and unencrypted `VIDEO_TS` folders without changing the source archive. Source paths are kept only in local manifests/job state. Converted viewing copies default to `%LOCALAPPDATA%\LeliBramBasPlus\video-importer\viewing-copies`.

`scan` is read-only and does not accept `--dry-run`. `prepare --dry-run` scans and reports proposed paths/counts without writing manifest or state. `convert --dry-run` prints exact FFmpeg plans without creating output directories, concat files, job state, or video files. Actual conversion writes a `.partial` file in the configured output directory and promotes it only after FFmpeg succeeds.

```powershell
yarn importer scan --folder "D:\Family Videos"
yarn importer prepare --folder "D:\Family Videos" --manifest ".\imports\catalog.csv"
yarn importer convert --manifest ".\imports\catalog.csv" --concurrency 1 --dry-run
yarn importer convert --manifest ".\imports\catalog.csv" --concurrency 1
yarn importer resume --state ".\imports\catalog.state.json"
yarn importer verify --state ".\imports\catalog.state.json"
yarn importer status --state ".\imports\catalog.state.json"
yarn importer export-errors --state ".\imports\catalog.state.json" --output ".\imports\errors.csv"
```

The importer prefers HandBrakeCLI for DVD title discovery and records when it falls back to grouping sequential non-menu VOB files. FFmpeg creates H.264/AAC, `yuv420p`, fast-start MP4 copies with no frame-rate conversion, upscaling, sharpening, or cropping. Interlacing is filtered only when detected.

The tool does not bypass encryption or copy protection and is intended only for user-authored or lawfully owned unencrypted media.
