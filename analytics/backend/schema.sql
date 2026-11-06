CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL, site TEXT NOT NULL, event TEXT NOT NULL,
  path TEXT NOT NULL, detail TEXT NOT NULL,
  session_hash TEXT NOT NULL, source TEXT NOT NULL,
  referrer TEXT NOT NULL, device TEXT NOT NULL, browser TEXT NOT NULL,
  duration INTEGER NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL, city TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_ts ON analytics_events(ts);
CREATE INDEX IF NOT EXISTS idx_analytics_site_event ON analytics_events(site,event,ts);
CREATE TABLE IF NOT EXISTS security_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL, site TEXT NOT NULL,
  ip TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL, city TEXT NOT NULL,
  event TEXT NOT NULL, endpoint TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_ts ON security_access(ts);
