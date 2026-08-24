# LeliBramBas+ launch jingle

This folder contains an original, synthetic app-opening sonic logo. It uses warm orchestral swells, harp-like plucks, magical glass highlights, and an uplifting add-nine resolution without quoting another service's melody.

## Deliverables

- `lelibrambas-plus-magical-app-launch-master-48k-24bit.wav` — lossless production master
- `lelibrambas-plus-magical-app-launch-mobile-48k-16bit.wav` — broadly compatible PCM fallback
- `lelibrambas-plus-magical-app-launch-mobile-256k.m4a` — preferred compact mobile asset (AAC)
- `lelibrambas-plus-magical-app-launch-universal-192k.mp3` — broadly compatible compressed fallback
- `lelibrambas-plus-magical-app-launch-web-android.ogg` — compact Ogg Vorbis option for Android/web
- `lelibrambas-plus-magical-app-launch-archive.flac` — lossless archival copy
- `audio-analysis.json` — duration and level measurements

All audio is stereo at 48 kHz. The synthesis is deterministic and uses only generated tones/noise; it contains no sampled or personal media.

## Regenerate

From this folder, pass the desired duration in seconds:

```powershell
node .\generate-jingle.mjs 4.8
.\encode-formats.ps1 -FfmpegPath C:\path\to\ffmpeg.exe
```

The generator targets approximately -16 LUFS integrated with a sample peak ceiling of -1.2 dBFS, leaving headroom for a clear and comfortable mobile launch sound.
