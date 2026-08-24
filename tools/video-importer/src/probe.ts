import type { ProcessRunner } from './process.js';
import { SpawnProcessRunner, detectToolVersion } from './process.js';
import type { TechnicalProber, TechnicalProbeResult } from './types.js';

interface FfprobeStream {
  readonly index?: number;
  readonly codec_type?: string;
  readonly codec_name?: string;
  readonly width?: number;
  readonly height?: number;
  readonly display_aspect_ratio?: string;
  readonly avg_frame_rate?: string;
  readonly field_order?: string;
  readonly tags?: { readonly language?: string; readonly title?: string };
}

interface FfprobePayload {
  readonly format?: { readonly duration?: string };
  readonly streams?: readonly FfprobeStream[];
  readonly chapters?: readonly unknown[];
}

function parseRate(rate: string | undefined): number | null {
  if (rate === undefined || rate === '0/0') return null;
  const [numeratorValue, denominatorValue] = rate.split('/');
  const numerator = Number(numeratorValue);
  const denominator = Number(denominatorValue ?? '1');
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
    return null;
  return numerator / denominator;
}

export class FfprobeProber implements TechnicalProber {
  public constructor(
    private readonly runner: ProcessRunner = new SpawnProcessRunner(),
    private readonly executable = 'ffprobe',
  ) {}

  public async version(): Promise<string | null> {
    return detectToolVersion(this.runner, this.executable, ['-version']);
  }

  public async probe(filePath: string, signal?: AbortSignal): Promise<TechnicalProbeResult> {
    const result = await this.runner.run(
      this.executable,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        '-show_chapters',
        filePath,
      ],
      signal,
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `ffprobe exited with code ${result.exitCode}`);
    }
    const payload: FfprobePayload = JSON.parse(result.stdout) as FfprobePayload;
    const streams = payload.streams ?? [];
    const video = streams.find((stream) => stream.codec_type === 'video');
    const makeTracks = (type: 'audio' | 'subtitle') =>
      streams
        .filter((stream) => stream.codec_type === type)
        .map((stream, position) => ({
          index: stream.index ?? position,
          codec: stream.codec_name ?? 'unknown',
          language: stream.tags?.language ?? null,
          title: stream.tags?.title ?? null,
        }));
    const duration = Number(payload.format?.duration);
    const fieldOrder = video?.field_order?.toLocaleLowerCase();
    return {
      durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
      width: video?.width ?? null,
      height: video?.height ?? null,
      aspectRatio: video?.display_aspect_ratio ?? null,
      frameRate: parseRate(video?.avg_frame_rate),
      interlaced:
        fieldOrder === undefined || fieldOrder === 'unknown' || fieldOrder === 'progressive'
          ? fieldOrder === 'progressive'
            ? false
            : null
          : true,
      audioTracks: makeTracks('audio'),
      subtitleTracks: makeTracks('subtitle'),
      chapterCount: payload.chapters?.length ?? 0,
    };
  }
}

export const EMPTY_PROBE: TechnicalProbeResult = {
  durationSeconds: null,
  width: null,
  height: null,
  aspectRatio: null,
  frameRate: null,
  interlaced: null,
  audioTracks: [],
  subtitleTracks: [],
  chapterCount: null,
};
