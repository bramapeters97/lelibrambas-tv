import type { ProviderWebhookEvent } from '@lelibrambas/media';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { D1CatalogRepository } from '../src/d1-repositories.js';

const migrationPath = fileURLToPath(
  new URL('../../../infra/d1/migrations/0001_initial.sql', import.meta.url),
);

class SqliteD1Statement {
  public constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly values: readonly string[] = [],
  ) {}

  public bind(...values: readonly unknown[]): SqliteD1Statement {
    return new SqliteD1Statement(
      this.database,
      this.sql,
      values.map((value) => String(value)),
    );
  }

  public execute(): D1Result {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } } as unknown as D1Result;
  }
}

function d1Adapter(database: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      return new SqliteD1Statement(database, sql);
    },
    async batch(statements: readonly unknown[]) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement) => (statement as SqliteD1Statement).execute());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
}

function streamEvent(
  eventId: string,
  status: ProviderWebhookEvent['status'],
  occurredAt: string,
): ProviderWebhookEvent {
  return {
    eventId,
    assetId: 'stream-asset-1',
    status,
    progressPercent: status === 'ready' ? 100 : 50,
    occurredAt,
    payload: { uid: 'stream-asset-1', status },
  };
}

describe('D1CatalogRepository media status ordering', () => {
  it('orders provider events independently without rewinding metadata edit time', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec(await readFile(migrationPath, 'utf8'));
    database
      .prepare(
        `
        INSERT INTO videos (
          id, slug, title, source_type, processing_status, playback_asset_id,
          media_status_updated_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        'video-1',
        'stockholm',
        'Stockholm',
        'mp4',
        'processing',
        'stream-asset-1',
        '2026-01-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
      );

    const repository = new D1CatalogRepository(d1Adapter(database));
    expect(
      await repository.applyMediaStatus(
        streamEvent('ready-event', 'ready', '2026-03-01T00:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      database
        .prepare(
          'SELECT processing_status, media_status_updated_at, updated_at FROM videos WHERE id = ?',
        )
        .get('video-1'),
    ).toMatchObject({
      processing_status: 'ready',
      media_status_updated_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    });

    expect(
      await repository.applyMediaStatus(
        streamEvent('stale-event', 'failed', '2026-02-01T00:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      database
        .prepare(
          'SELECT processing_status, media_status_updated_at, updated_at FROM videos WHERE id = ?',
        )
        .get('video-1'),
    ).toMatchObject({
      processing_status: 'ready',
      media_status_updated_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    });

    expect(
      await repository.applyMediaStatus(
        streamEvent('ready-event', 'ready', '2026-03-01T00:00:00.000Z'),
      ),
    ).toBe(false);
    database.close();
  });
});
