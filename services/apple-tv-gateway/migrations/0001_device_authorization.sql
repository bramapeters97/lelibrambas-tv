CREATE TABLE device_authorizations (
  id TEXT PRIMARY KEY,
  device_code_hash TEXT NOT NULL UNIQUE CHECK (length(device_code_hash) = 64),
  user_code_hash TEXT NOT NULL UNIQUE CHECK (length(user_code_hash) = 64),
  device_name TEXT NOT NULL CHECK (length(device_name) BETWEEN 1 AND 80),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'consumed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  poll_interval_seconds INTEGER NOT NULL CHECK (poll_interval_seconds BETWEEN 2 AND 30),
  last_poll_at INTEGER,
  approved_at INTEGER,
  denied_at INTEGER,
  consumed_at INTEGER,
  decided_by_hash TEXT CHECK (decided_by_hash IS NULL OR length(decided_by_hash) = 64),
  email_hint TEXT
) STRICT;

CREATE INDEX device_authorizations_expiry_idx
  ON device_authorizations (expires_at, status);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  subject_hash TEXT NOT NULL CHECK (length(subject_hash) = 64),
  email_hint TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  rotated_to_session_id TEXT,
  FOREIGN KEY (rotated_to_session_id) REFERENCES sessions (id)
) STRICT;

CREATE INDEX sessions_active_token_idx
  ON sessions (token_hash, expires_at, revoked_at);

CREATE TABLE rate_limits (
  key_hash TEXT PRIMARY KEY CHECK (length(key_hash) = 64),
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  expires_at INTEGER NOT NULL
) STRICT;

CREATE INDEX rate_limits_expiry_idx ON rate_limits (expires_at);
