import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'scriptshift.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    file_hash TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    target_language TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    current_stage TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_file_hash ON jobs(file_hash);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

  CREATE TABLE IF NOT EXISTS transcripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    language TEXT NOT NULL,
    speakers TEXT NOT NULL, -- JSON array of speaker IDs
    segments TEXT NOT NULL, -- JSON array of segments
    created_at INTEGER NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_transcripts_hash_lang ON transcripts(file_hash, language);

  CREATE TABLE IF NOT EXISTS voice_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    speaker_id TEXT NOT NULL,
    speaker_name TEXT,
    voice_id TEXT NOT NULL,
    voice_name TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_mappings_job_speaker ON voice_mappings(job_id, speaker_id);

  CREATE TABLE IF NOT EXISTS artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    file_hash TEXT,
    artifact_type TEXT NOT NULL, -- 'extracted_audio', 'vo_stem', 'bg_stem', 'dubbed_audio', 'final_video', etc.
    url TEXT NOT NULL,
    metadata TEXT, -- JSON
    created_at INTEGER NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_artifacts_job ON artifacts(job_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_hash_type ON artifacts(file_hash, artifact_type);

  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
`);

// Helper functions
export interface Job {
  id: string;
  file_hash: string;
  original_filename: string;
  file_url: string;
  target_language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_stage?: string;
  error?: string;
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string;
  text: string;
  confidence?: number;
}

export interface Transcript {
  id: number;
  job_id: string;
  file_hash: string;
  language: string;
  speakers: string[];
  segments: TranscriptSegment[];
  created_at: number;
}

export interface VoiceMapping {
  id: number;
  job_id: string;
  speaker_id: string;
  speaker_name?: string;
  voice_id: string;
  voice_name?: string;
  created_at: number;
}

export interface Artifact {
  id: number;
  job_id: string;
  file_hash?: string;
  artifact_type: string;
  url: string;
  metadata?: Record<string, any>;
  created_at: number;
}

export const jobQueries = {
  create: db.prepare(`
    INSERT INTO jobs (id, file_hash, original_filename, file_url, target_language, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `),

  getById: db.prepare(`
    SELECT * FROM jobs WHERE id = ?
  `),

  getByHash: db.prepare(`
    SELECT * FROM jobs WHERE file_hash = ? AND target_language = ? ORDER BY created_at DESC LIMIT 1
  `),

  updateStatus: db.prepare(`
    UPDATE jobs SET status = ?, progress = ?, current_stage = ?, updated_at = ? WHERE id = ?
  `),

  setError: db.prepare(`
    UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?
  `),

  complete: db.prepare(`
    UPDATE jobs SET status = 'completed', progress = 100, completed_at = ?, updated_at = ? WHERE id = ?
  `),

  listRecent: db.prepare(`
    SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?
  `)
};

export const transcriptQueries = {
  create: db.prepare(`
    INSERT INTO transcripts (job_id, file_hash, language, speakers, segments, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  getByHashAndLang: db.prepare(`
    SELECT * FROM transcripts WHERE file_hash = ? AND language = ?
  `),

  getByJobId: db.prepare(`
    SELECT * FROM transcripts WHERE job_id = ? ORDER BY created_at DESC
  `)
};

export const voiceMappingQueries = {
  create: db.prepare(`
    INSERT INTO voice_mappings (job_id, speaker_id, speaker_name, voice_id, voice_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  getByJobId: db.prepare(`
    SELECT * FROM voice_mappings WHERE job_id = ?
  `),

  upsert: db.prepare(`
    INSERT INTO voice_mappings (job_id, speaker_id, speaker_name, voice_id, voice_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id, speaker_id) DO UPDATE SET
      speaker_name = excluded.speaker_name,
      voice_id = excluded.voice_id,
      voice_name = excluded.voice_name
  `)
};

export const artifactQueries = {
  create: db.prepare(`
    INSERT INTO artifacts (job_id, file_hash, artifact_type, url, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  getByJobIdAndType: db.prepare(`
    SELECT * FROM artifacts WHERE job_id = ? AND artifact_type = ? ORDER BY created_at DESC LIMIT 1
  `),

  getByHashAndType: db.prepare(`
    SELECT * FROM artifacts WHERE file_hash = ? AND artifact_type = ? ORDER BY created_at DESC LIMIT 1
  `),

  listByJobId: db.prepare(`
    SELECT * FROM artifacts WHERE job_id = ? ORDER BY created_at ASC
  `)
};

export const cacheQueries = {
  set: db.prepare(`
    INSERT OR REPLACE INTO cache (key, value, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `),

  get: db.prepare(`
    SELECT value FROM cache WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
  `),

  delete: db.prepare(`
    DELETE FROM cache WHERE key = ?
  `),

  cleanup: db.prepare(`
    DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at < ?
  `)
};

// Helper to parse JSON fields
export function parseTranscript(row: any): Transcript {
  return {
    ...row,
    speakers: JSON.parse(row.speakers),
    segments: JSON.parse(row.segments)
  };
}

export function parseArtifact(row: any): Artifact {
  return {
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  };
}

// Cleanup expired cache on startup
cacheQueries.cleanup.run(Date.now());

export default db;
