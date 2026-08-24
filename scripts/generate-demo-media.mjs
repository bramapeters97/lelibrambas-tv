import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRuntimePaths } from './runtime-paths.mjs';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = getRuntimePaths();
let ffmpeg;
try {
  ffmpeg = require('@ffmpeg-installer/ffmpeg');
} catch {
  const configuredPath = process.env.LELIBRAMBAS_FFMPEG_PATH;
  if (configuredPath && existsSync(configuredPath)) {
    ffmpeg = { path: configuredPath, version: 'configured system binary' };
  }
  const emulatedPath = runtime.ffmpegBinary;
  if (!ffmpeg && existsSync(emulatedPath)) {
    ffmpeg = { path: emulatedPath, version: '4.1.0 (external Windows x64 helper)' };
  }
  const systemCommand = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  if (!ffmpeg && spawnSync(systemCommand, ['-version'], { stdio: 'ignore' }).status === 0) {
    ffmpeg = { path: systemCommand, version: 'system binary' };
  }
  if (!ffmpeg) {
    throw new Error(
      'No compatible FFmpeg binary was found. Install FFmpeg, set LELIBRAMBAS_FFMPEG_PATH, or run yarn setup on Windows.',
    );
  }
}
const publicDir = join(root, 'apps', 'tv', 'public', 'media');
const nativeAssetDir = join(root, 'apps', 'tv', 'assets');

for (const directory of [publicDir, nativeAssetDir])
  mkdirSync(directory, { recursive: true });

const windowsFont = 'C:/Windows/Fonts/segoeui.ttf';
const hasFont = existsSync(windowsFont);

const clips = [
  {
    name: 'archive-16x9.mp4',
    size: '640x360',
    duration: 16,
    background: '0x071426',
    accent: '0x2C7788',
    title: 'STOCKHOLM SUMMER',
    subtitle: 'A FAMILY ARCHIVE · 2014',
  },
  {
    name: 'archive-4x3.mp4',
    size: '480x360',
    duration: 14,
    background: '0x251A31',
    accent: '0x9B695C',
    title: 'THE EARLY YEARS',
    subtitle: 'RESTORED DVD · 4:3',
  },
  {
    name: 'up-next.mp4',
    size: '640x360',
    duration: 10,
    background: '0x0C2527',
    accent: '0x4D8A74',
    title: 'MIDSUMMER, MORE OR LESS',
    subtitle: 'UP NEXT',
  },
  {
    name: 'short-memory.mp4',
    size: '640x360',
    duration: 6,
    background: '0x1A203D',
    accent: '0x7666A9',
    title: 'A VERY SMALL PREMIERE',
    subtitle: 'SHORT FILM',
  },
];

function filterFor(clip) {
  const [width, height] = clip.size.split('x').map(Number);
  const titleSize = Math.round((height ?? 360) * 0.075);
  const subtitleSize = Math.round((height ?? 360) * 0.03);
  const layers = [
    `drawbox=x='-120+(t/${clip.duration})*${(width ?? 640) + 240}':y=${Math.round((height ?? 360) * 0.17)}:w=${Math.round((width ?? 640) * 0.28)}:h=${Math.round((height ?? 360) * 0.68)}:color=${clip.accent}@0.38:t=fill`,
    `drawbox=x=${Math.round((width ?? 640) * 0.68)}:y='${Math.round((height ?? 360) * 0.05)}+(t/${clip.duration})*${Math.round((height ?? 360) * 0.45)}':w=${Math.round((width ?? 640) * 0.012)}:h=${Math.round((width ?? 640) * 0.012)}:color=0xE9C778@0.95:t=fill`,
    `vignette=PI/5`,
    `eq=brightness='0.025*sin(2*PI*t/5)':saturation=1.12`,
    `fade=t=in:st=0:d=0.8`,
    `fade=t=out:st=${Math.max(0, clip.duration - 0.8)}:d=0.8`,
  ];
  if (hasFont) {
    const font = windowsFont.replace(':', '\\:');
    layers.push(
      `drawtext=fontfile='${font}':text='${clip.title}':fontcolor=white:fontsize=${titleSize}:x=(w-text_w)/2:y=(h-text_h)/2-18`,
    );
    layers.push(
      `drawtext=fontfile='${font}':text='${clip.subtitle}':fontcolor=0xE9C778:fontsize=${subtitleSize}:x=(w-text_w)/2:y=(h-text_h)/2+35`,
    );
  }
  return layers.join(',');
}

for (const clip of clips) {
  const output = join(publicDir, clip.name);
  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${clip.background}:s=${clip.size}:r=24:d=${clip.duration}`,
    '-vf',
    filterFor(clip),
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '25',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output,
  ];
  const result = spawnSync(ffmpeg.path, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`FFmpeg failed while generating ${clip.name}.`);
}

copyFileSync(join(publicDir, 'archive-16x9.mp4'), join(nativeAssetDir, 'archive-demo.mp4'));
console.log(`Generated ${clips.length} original silent demo clips with ${ffmpeg.version}.`);
