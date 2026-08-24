param(
  [string]$FfmpegPath = 'ffmpeg'
)

$ErrorActionPreference = 'Stop'
$inputFile = Join-Path $PSScriptRoot 'lelibrambas-plus-magical-app-launch-master-48k-24bit.wav'

if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) {
  throw "Generate the WAV master first: $inputFile"
}

$commonMetadata = @(
  '-metadata', 'title=LELIBRAMBAS+ App Launch',
  '-metadata', 'artist=LELIBRAMBAS+',
  '-metadata', 'comment=Original synthetic app launch jingle'
)

& $FfmpegPath -hide_banner -loglevel warning -y -i $inputFile @commonMetadata `
  -c:a aac -profile:a aac_low -b:a 256k -movflags +faststart `
  (Join-Path $PSScriptRoot 'lelibrambas-plus-magical-app-launch-mobile-256k.m4a')
if ($LASTEXITCODE -ne 0) { throw 'AAC/M4A encoding failed.' }

& $FfmpegPath -hide_banner -loglevel warning -y -i $inputFile @commonMetadata `
  -c:a libmp3lame -b:a 192k -write_xing 1 -id3v2_version 3 `
  (Join-Path $PSScriptRoot 'lelibrambas-plus-magical-app-launch-universal-192k.mp3')
if ($LASTEXITCODE -ne 0) { throw 'MP3 encoding failed.' }

& $FfmpegPath -hide_banner -loglevel warning -y -i $inputFile @commonMetadata `
  -c:a libvorbis -q:a 6 `
  (Join-Path $PSScriptRoot 'lelibrambas-plus-magical-app-launch-web-android.ogg')
if ($LASTEXITCODE -ne 0) { throw 'Ogg Vorbis encoding failed.' }

& $FfmpegPath -hide_banner -loglevel warning -y -i $inputFile @commonMetadata `
  -c:a flac -compression_level 8 `
  (Join-Path $PSScriptRoot 'lelibrambas-plus-magical-app-launch-archive.flac')
if ($LASTEXITCODE -ne 0) { throw 'FLAC encoding failed.' }
