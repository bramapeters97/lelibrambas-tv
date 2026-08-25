import { describe, expect, it } from 'vitest';
import { ConfiguredUpstreamCatalog } from '../src/upstream.js';
import { syntheticConfig } from './helpers.js';

describe('fixed upstream proxy', () => {
  it('fetches only the configured catalog path with server-side Access credentials', async () => {
    const requests: Request[] = [];
    const upstream = new ConfiguredUpstreamCatalog(syntheticConfig, (input, init) => {
      const outgoing = new Request(input, init);
      requests.push(outgoing);
      return Promise.resolve(
        Response.json([
          {
            id: 7,
            title: 'Synthetic Journey',
            year: null,
            description: 'Fixture',
            category: 'OTHERS',
            poster_url: '/artwork/synthetic.jpg',
            stream_video_id: 'https://media.example.test/asset-7/watch',
          },
        ]),
      );
    });
    const catalog = await upstream.loadCatalog();
    expect(catalog).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://archive.example.test/data/media_catalog.json');
    expect(requests[0]?.headers.get('cf-access-client-id')).toBe('synthetic-client-id');
    expect(requests[0]?.headers.get('cf-access-client-secret')).toBe('synthetic-client-secret');
    await expect(upstream.playbackURL(catalog[0]!)).resolves.toEqual(
      new URL('https://media.example.test/asset-7/manifest/video.m3u8'),
    );
  });

  it('rejects playback hosts outside the configured allow-list', async () => {
    const upstream = new ConfiguredUpstreamCatalog(syntheticConfig);
    await expect(
      upstream.playbackURL({
        id: 1,
        title: 'Synthetic',
        year: null,
        description: '',
        category: 'OTHERS',
        posterUrl: '',
        backdropUrl: null,
        streamVideoId: 'https://untrusted.invalid/video.mp4',
        playbackAssetId: null,
        sortOrder: 1,
        featured: false,
        previewStartSeconds: 0,
      }),
    ).rejects.toMatchObject({ code: 'PLAYBACK_URL_INVALID' });
  });
});
