const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || "./data/onevoice.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  address_text TEXT,
  image_path TEXT,
  reporter_name TEXT,
  reporter_phone TEXT,
  severity_rule TEXT NOT NULL,
  severity_ai TEXT,
  severity_final TEXT NOT NULL,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  cluster_key TEXT,
  duplicate_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_cluster_key ON reports(cluster_key);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity_final);

CREATE TABLE IF NOT EXISTS laws (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS law_comments (
  id TEXT PRIMARY KEY,
  law_id TEXT NOT NULL REFERENCES laws(id),
  rating INTEGER,
  comment_text TEXT NOT NULL,
  commenter_name TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ministries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  contact_email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ministry_suggestions (
  id TEXT PRIMARY KEY,
  ministry_id TEXT NOT NULL REFERENCES ministries(id),
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  attachment_path TEXT,
  reporter_name TEXT,
  reporter_phone TEXT,
  status TEXT NOT NULL DEFAULT 'NEW',
  created_at TEXT NOT NULL
);
`);

module.exports = db;
