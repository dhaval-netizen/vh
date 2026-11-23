ALTER TABLE signups ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE signups ADD COLUMN ref_code TEXT NOT NULL DEFAULT '';
ALTER TABLE signups ADD COLUMN referred_by TEXT NOT NULL DEFAULT '';
CREATE INDEX signups_referred ON signups(referred_by);
