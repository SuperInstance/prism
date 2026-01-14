-- Claude's Friend - Initial Database Schema
-- D1 Database Migration
-- Run: wrangler d1 execute claudes-friend-db --file=./migrations/001_initial.sql

-- ============================================
-- Documents Table
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'code', 'documentation', 'conversation', etc
  language TEXT,
  tags TEXT, -- JSON array
  metadata TEXT, -- JSON object
  chunk_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_language ON documents(language);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

-- Full-text search on title
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title,
  content=documents,
  content_rowid=rowid
);

-- ============================================
-- Document Chunks Table
-- ============================================

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  metadata TEXT, -- JSON object
  vector_id TEXT, -- Reference to Vectorize ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_vector_id ON document_chunks(vector_id);

-- ============================================
-- Users/Sessions Table
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  api_key_hash TEXT UNIQUE NOT NULL,
  email TEXT,
  preferences TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- ============================================
-- Conversations Table
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  model TEXT NOT NULL,
  messages TEXT, -- JSON array of message objects
  context TEXT, -- JSON object (relevant docs, etc)
  token_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

-- ============================================
-- Usage Tracking Table
-- ============================================

CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  hour INTEGER NOT NULL, -- 0-23
  metric TEXT NOT NULL, -- 'neurons', 'requests', 'kv_reads', 'kv_writes', 'd1_reads', 'd1_writes'
  value INTEGER NOT NULL,
  user_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_log_date_hour ON usage_log(date, hour);
CREATE INDEX IF NOT EXISTS idx_usage_log_metric ON usage_log(metric);
CREATE INDEX IF NOT EXISTS idx_usage_log_user_id ON usage_log(user_id);

-- ============================================
-- API Keys Table
-- ============================================

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  name TEXT,
  scopes TEXT, -- JSON array of scopes
  rate_limit INTEGER DEFAULT 1000, -- requests per hour
  last_used DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- ============================================
-- Cache Metadata Table
-- ============================================

CREATE TABLE IF NOT EXISTS cache_metadata (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'response', 'embedding', 'search'
  size INTEGER NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_cache_type ON cache_metadata(type);
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_metadata(expires_at);

-- ============================================
-- Document Relationships Table
-- ============================================

-- For tracking related documents (e.g., parent-child, imports, etc)
CREATE TABLE IF NOT EXISTS document_relationships (
  id TEXT PRIMARY KEY,
  source_document_id TEXT NOT NULL,
  target_document_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL, -- 'imports', 'references', 'related', etc
  metadata TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (target_document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(source_document_id, target_document_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_doc_rel_source ON document_relationships(source_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_rel_target ON document_relationships(target_document_id);
CREATE INDEX IF NOT EXISTS idx_doc_rel_type ON document_relationships(relationship_type);

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_documents_timestamp
AFTER UPDATE ON documents
BEGIN
  UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp
AFTER UPDATE ON conversations
BEGIN
  UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_cache_last_accessed
AFTER SELECT ON cache_metadata
BEGIN
  UPDATE cache_metadata SET last_accessed = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

-- ============================================
-- Views for Common Queries
-- ============================================

-- Active users (last 24 hours)
CREATE VIEW IF NOT EXISTS active_users AS
SELECT
  u.id,
  u.email,
  u.last_active,
  COUNT(DISTINCT c.id) as conversation_count
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id AND c.created_at >= datetime('now', '-1 day')
WHERE u.last_active >= datetime('now', '-1 day')
GROUP BY u.id;

-- Daily usage summary
CREATE VIEW IF NOT EXISTS daily_usage_summary AS
SELECT
  date,
  metric,
  SUM(value) as total_value,
  COUNT(DISTINCT user_id) as unique_users
FROM usage_log
GROUP BY date, metric
ORDER BY date DESC, metric;

-- Popular documents (by access)
CREATE VIEW IF NOT EXISTS popular_documents AS
SELECT
  d.id,
  d.title,
  d.type,
  d.chunk_count,
  COUNT(DISTINCT c.id) as access_count
FROM documents d
LEFT JOIN document_chunks dc ON dc.document_id = d.id
LEFT JOIN cache_metadata cm ON cm.key = 'chunk:' || dc.id
GROUP BY d.id
ORDER BY access_count DESC;

-- ============================================
-- Seed Data (Optional)
-- ============================================

-- Insert a default admin user (password should be hashed in production)
-- INSERT INTO users (id, api_key_hash, email, preferences)
-- VALUES (
--   'admin',
--   'hash_of_api_key',
--   'admin@example.com',
--   '{"role": "admin", "quota": 1000000}'
-- );
