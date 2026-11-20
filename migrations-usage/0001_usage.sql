-- Counts only. No public client can supply a bucket, an identifier or an arbitrary dimension.
CREATE TABLE usage_hourly (
 day TEXT NOT NULL, hour INTEGER NOT NULL,
 surface TEXT NOT NULL CHECK(surface IN ('browser','pwa')),
 event TEXT NOT NULL CHECK(event IN ('open','active','planning','place','time','date','seasons','shadow','save','share')),
 n INTEGER NOT NULL CHECK(n>0), PRIMARY KEY(day,hour,surface,event)
) WITHOUT ROWID;
CREATE TABLE edge_hourly (
 hour INTEGER PRIMARY KEY, through_ms INTEGER NOT NULL,
 requests INTEGER NOT NULL, visits INTEGER NOT NULL, bytes INTEGER NOT NULL, errors INTEGER NOT NULL,
 countries TEXT NOT NULL
);
CREATE TABLE usage_meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL) WITHOUT ROWID;
