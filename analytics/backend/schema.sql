-- Aggregated, identifier-free analytics (hourly counters, no raw IP or per-visitor IDs).
CREATE TABLE IF NOT EXISTS analytics_hourly (
  hour TEXT NOT NULL,
  site TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL,
  source TEXT NOT NULL,
  device TEXT NOT NULL,
  browser TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hour,site,event,detail,source,device,browser,country,region,city)
);
CREATE INDEX IF NOT EXISTS idx_analytics_hour ON analytics_hourly(hour);
-- Technically separate, access-controlled security records.
-- One record per page load (not per click); never store activity details here.
CREATE TABLE IF NOT EXISTS security_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  site TEXT NOT NULL,
  ip TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  city TEXT NOT NULL,
  reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_ts ON security_access(ts);
