CREATE TABLE signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  price TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  consent_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX signups_expiry ON signups(expires_at);
CREATE INDEX signups_created ON signups(created_at);
