ALTER TABLE exercise_catalog ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
ALTER TABLE exercise_catalog ADD COLUMN categoria_articular TEXT NOT NULL DEFAULT '';
ALTER TABLE exercise_catalog ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE exercise_catalog ADD COLUMN source_updated_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_exercise_catalog_active_name
  ON exercise_catalog (is_active, id_exercicio COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS catalog_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source_hash TEXT NOT NULL DEFAULT '',
  last_attempt_at TEXT NOT NULL DEFAULT '',
  last_success_at TEXT NOT NULL DEFAULT '',
  active_exercise_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO catalog_sync_state (id) VALUES (1);
