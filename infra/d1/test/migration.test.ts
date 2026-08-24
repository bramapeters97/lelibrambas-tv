import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(new URL('../migrations/0001_initial.sql', import.meta.url));

function tableNames(database: DatabaseSync): string[] {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => String(row.name));
}

describe('D1 initial migration', () => {
  it('applies to SQLite and creates every required entity', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec(await readFile(migrationPath, 'utf8'));
    expect(tableNames(database)).toEqual(
      expect.arrayContaining([
        'users',
        'devices',
        'profiles',
        'videos',
        'people',
        'video_people',
        'places',
        'tags',
        'video_tags',
        'collections',
        'collection_videos',
        'home_rails',
        'home_rail_items',
        'watch_progress',
        'watchlist',
        'playback_events',
        'import_jobs',
        'conversion_jobs',
        'app_settings',
        'stream_webhook_events',
        'rate_limit_buckets',
      ]),
    );
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(
      database
        .prepare(
          "SELECT name FROM pragma_table_info('videos') WHERE name = 'media_status_updated_at'",
        )
        .get()?.name,
    ).toBe('media_status_updated_at');
    database.close();
  });

  it('enforces uniqueness and cascades profile state safely', async () => {
    const database = new DatabaseSync(':memory:');
    database.exec(await readFile(migrationPath, 'utf8'));
    database.exec(`
      INSERT INTO users (id, display_name) VALUES ('user-1', 'Family');
      INSERT INTO profiles (id, user_id, display_name, avatar_key, accent_token)
        VALUES ('profile-1', 'user-1', 'Viewer One', 'viewer-one', 'aurora');
      INSERT INTO videos (id, slug, title, source_type) VALUES ('video-1', 'stockholm', 'Stockholm', 'mp4');
      INSERT INTO watchlist (profile_id, video_id) VALUES ('profile-1', 'video-1');
      DELETE FROM profiles WHERE id = 'profile-1';
    `);
    expect(database.prepare('SELECT COUNT(*) AS count FROM watchlist').get()?.count).toBe(0);
    expect(() =>
      database.exec(
        "INSERT INTO videos (id, slug, title, source_type) VALUES ('video-2', 'stockholm', 'Duplicate', 'mp4')",
      ),
    ).toThrow(/UNIQUE/u);
    database.close();
  });
});
