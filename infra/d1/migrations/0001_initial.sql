PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tvos', 'windows', 'web', 'unknown')),
  pairing_code TEXT UNIQUE,
  pairing_expires_at TEXT,
  token_hash TEXT UNIQUE,
  approved_at TEXT,
  denied_at TEXT,
  token_rotated_at TEXT,
  last_seen_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_key TEXT NOT NULL,
  accent_token TEXT NOT NULL,
  pin_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, display_name)
);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  avatar_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  country TEXT,
  hero_artwork_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL DEFAULT '',
  original_filename TEXT,
  source_type TEXT NOT NULL,
  recording_date TEXT,
  approximate_date INTEGER NOT NULL DEFAULT 0 CHECK (approximate_date IN (0, 1)),
  year INTEGER CHECK (year IS NULL OR year BETWEEN 1900 AND 2200),
  duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  aspect_ratio TEXT,
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  frame_rate REAL CHECK (frame_rate IS NULL OR frame_rate > 0),
  interlaced INTEGER CHECK (interlaced IS NULL OR interlaced IN (0, 1)),
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  country TEXT,
  thumbnail_key TEXT,
  landscape_artwork_key TEXT,
  portrait_artwork_key TEXT,
  backdrop_artwork_key TEXT,
  preview_start_seconds REAL CHECK (preview_start_seconds IS NULL OR preview_start_seconds >= 0),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'family', 'hidden')),
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed', 'unavailable')),
  playback_provider TEXT NOT NULL DEFAULT 'mock' CHECK (playback_provider IN ('mock', 'local', 'cloudflare-stream')),
  playback_asset_id TEXT,
  media_status_updated_at TEXT,
  restoration_notes TEXT,
  legacy_format TEXT,
  chapter_markers_json TEXT NOT NULL DEFAULT '[]',
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE video_people (
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (video_id, person_id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE video_tags (
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, tag_id)
);

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  collection_type TEXT NOT NULL CHECK (collection_type IN ('series', 'trip', 'holiday', 'christmas', 'year', 'person', 'restored-dvd', 'favourite', 'curated')),
  artwork_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE collection_videos (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  season_number INTEGER,
  episode_number INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, video_id)
);

CREATE TABLE home_rails (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE home_rail_items (
  rail_id TEXT NOT NULL REFERENCES home_rails(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rail_id, video_id)
);

CREATE TABLE watch_progress (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  play_count INTEGER NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  last_watched_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (profile_id, video_id)
);

CREATE TABLE watchlist (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (profile_id, video_id)
);

CREATE TABLE playback_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  position_seconds REAL,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'scanning', 'review', 'completed', 'failed', 'interrupted')),
  manifest_key TEXT,
  source_label TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE conversion_jobs (
  id TEXT PRIMARY KEY,
  import_job_id TEXT REFERENCES import_jobs(id) ON DELETE CASCADE,
  video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'interrupted')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  output_checksum TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (source_fingerprint)
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE stream_webhook_events (
  event_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE rate_limit_buckets (
  key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_devices_pairing_code ON devices(pairing_code, pairing_expires_at);
CREATE INDEX idx_devices_token_hash ON devices(token_hash, revoked_at);
CREATE INDEX idx_videos_year ON videos(year, recording_date);
CREATE INDEX idx_videos_status_visibility ON videos(processing_status, visibility);
CREATE INDEX idx_videos_place ON videos(place_id, recording_date);
CREATE INDEX idx_video_people_person ON video_people(person_id, video_id);
CREATE INDEX idx_video_tags_tag ON video_tags(tag_id, video_id);
CREATE INDEX idx_collection_videos_order ON collection_videos(collection_id, season_number, episode_number, sort_order);
CREATE INDEX idx_home_rails_order ON home_rails(visible, sort_order);
CREATE INDEX idx_home_rail_items_order ON home_rail_items(rail_id, sort_order);
CREATE INDEX idx_watch_progress_recent ON watch_progress(profile_id, completed, last_watched_at DESC);
CREATE INDEX idx_playback_events_video_time ON playback_events(video_id, occurred_at DESC);
CREATE INDEX idx_conversion_jobs_status ON conversion_jobs(status, updated_at);
CREATE INDEX idx_stream_webhook_asset ON stream_webhook_events(asset_id, received_at DESC);
