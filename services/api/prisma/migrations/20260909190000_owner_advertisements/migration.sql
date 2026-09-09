-- Dedicated tables prevent generic Entity writes from changing advertisements.
CREATE TABLE advertisements (
 id TEXT PRIMARY KEY, advertiser TEXT NOT NULL, headline TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '', creative TEXT NOT NULL DEFAULT '', url TEXT NOT NULL,
 seconds INTEGER NOT NULL CHECK(seconds BETWEEN 3 AND 120), active BOOLEAN NOT NULL DEFAULT FALSE,
 starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, image BYTEA NOT NULL,
 removed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Keyed pseudonyms only: no account IDs, emails, profiles, IPs or sermons.
CREATE TABLE advertisement_events (
 ad_id TEXT NOT NULL REFERENCES advertisements(id), viewer TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('impression','click')), bucket BIGINT NOT NULL,
 day TEXT NOT NULL, ticket TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(ad_id, viewer, kind, bucket),
 UNIQUE(ad_id, viewer, kind, ticket)
);
CREATE INDEX advertisement_events_day ON advertisement_events(ad_id, day);
