import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

import type { Plugin } from 'vite';

const BACKGROUND = [5, 5, 5, 255] as const;
const GOLD = [222, 193, 126, 255] as const;
const EDGE = [121, 98, 54, 255] as const;
const BORDER = [40, 35, 25, 255] as const;

type Rgba = readonly [number, number, number, number];

function crc32(input: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name: string, data: Uint8Array): Buffer {
  const type = Buffer.from(name, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  type.copy(output, 4);
  Buffer.from(data).copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([type, Buffer.from(data)])), 8 + data.length);
  return output;
}

function encodePng(size: number, pixels: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);

  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    Buffer.from(pixels.subarray(y * size * 4, (y + 1) * size * 4)).copy(
      scanlines,
      y * (size * 4 + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n', 'binary'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', new Uint8Array()),
  ]);
}

function renderIcon(size: number, maskable = false): Buffer {
  const pixels = new Uint8Array(size * size * 4);
  const radius = Math.round(size * 0.18);

  const setPixel = (x: number, y: number, color: Rgba) => {
    pixels.set(color, (y * size + x) * 4);
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cornerX = x < radius ? radius : size - radius - 1;
      const cornerY = y < radius ? radius : size - radius - 1;
      const inside =
        size < 180 ||
        (x >= radius && x < size - radius) ||
        (y >= radius && y < size - radius) ||
        (x - cornerX) ** 2 + (y - cornerY) ** 2 <= radius ** 2;
      const atBorder = x < 4 || y < 4 || x >= size - 4 || y >= size - 4;
      setPixel(x, y, inside ? (size >= 180 && atBorder ? BORDER : BACKGROUND) : [0, 0, 0, 0]);
    }
  }

  const scale = maskable ? 0.84 : 1;
  const offset = ((1 - scale) * size) / 2;
  const coordinate = (value: number) => Math.round(offset + (scale * value * size) / 512);
  const rectangle = (left: number, top: number, right: number, bottom: number, color: Rgba) => {
    for (let y = coordinate(top); y < coordinate(bottom); y += 1) {
      for (let x = coordinate(left); x < coordinate(right); x += 1) setPixel(x, y, color);
    }
  };

  rectangle(155, 143, 209, 370, EDGE);
  rectangle(155, 316, 319, 370, EDGE);
  rectangle(151, 139, 205, 366, GOLD);
  rectangle(151, 312, 315, 366, GOLD);
  rectangle(316, 154, 356, 282, GOLD);
  rectangle(272, 198, 400, 238, GOLD);

  return encodePng(size, pixels);
}

function encodeIco(images: ReadonlyArray<{ size: number; data: Buffer }>): Buffer {
  const directory = Buffer.alloc(6 + images.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(images.length, 4);
  let offset = directory.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    directory.writeUInt8(size, entry);
    directory.writeUInt8(size, entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([directory, ...images.map(({ data }) => data)]);
}

export function webIconPlugin(): Plugin {
  const favicon16 = renderIcon(16);
  const favicon32 = renderIcon(32);
  const assets = new Map<string, Buffer>([
    ['favicon-16x16.png', favicon16],
    ['favicon-32x32.png', favicon32],
    ['favicon.ico', encodeIco([{ size: 16, data: favicon16 }, { size: 32, data: favicon32 }])],
    ['apple-touch-icon.png', renderIcon(180)],
    ['android-chrome-192x192.png', renderIcon(192)],
    ['android-chrome-512x512.png', renderIcon(512)],
    ['maskable-icon-512x512.png', renderIcon(512, true)],
  ]);

  return {
    name: 'lelibrambas-web-icons',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = new URL(request.url ?? '/', 'http://localhost').pathname.slice(1);
        const asset = assets.get(name);
        if (!asset) return next();
        response.setHeader('Content-Type', name.endsWith('.ico') ? 'image/x-icon' : 'image/png');
        response.end(asset);
      });
    },
    generateBundle() {
      for (const [fileName, source] of assets) {
        // The legacy binary remains in public for patch compatibility; replace it after Vite copies public.
        if (fileName !== 'apple-touch-icon.png') this.emitFile({ type: 'asset', fileName, source });
      }
    },
    async writeBundle(options) {
      await writeFile(resolve(options.dir ?? 'dist', 'apple-touch-icon.png'), assets.get('apple-touch-icon.png')!);
    },
  };
}
