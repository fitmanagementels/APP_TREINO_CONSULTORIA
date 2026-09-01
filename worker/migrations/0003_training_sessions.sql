ALTER TABLE execution_records
  ADD COLUMN training_session_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_execution_training_session
  ON execution_records (training_session_id);

CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  session_date TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('prescribed', 'free')),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'canceled')),
  id_ficha TEXT NOT NULL DEFAULT '',
  id_treino TEXT NOT NULL DEFAULT '',
  cycle_reference INTEGER CHECK (
    cycle_reference IS NULL OR cycle_reference BETWEEN 1 AND 4
  ),
  session_pse REAL CHECK (
    session_pse IS NULL OR (
      session_pse BETWEEN 1 AND 10
      AND CAST(session_pse * 2 AS INTEGER) = session_pse * 2
    )
  ),
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT '',
  canceled_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  CHECK (
    (
      mode = 'free'
      AND id_ficha = ''
      AND id_treino = ''
      AND cycle_reference IS NULL
    ) OR (
      mode = 'prescribed'
      AND id_ficha <> ''
      AND id_treino <> ''
      AND cycle_reference IS NOT NULL
      AND cycle_reference BETWEEN 1 AND 4
    )
  )
);

CREATE UNIQUE INDEX idx_training_sessions_one_active
  ON training_sessions (status)
  WHERE status = 'in_progress';

CREATE TABLE training_session_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  id_exercicio TEXT NOT NULL REFERENCES exercise_catalog(id_exercicio),
  exercise_order INTEGER NOT NULL CHECK (exercise_order > 0),
  source TEXT NOT NULL CHECK (source IN ('prescription', 'session')),
  observations TEXT NOT NULL DEFAULT '',
  expected_sets TEXT NOT NULL DEFAULT '',
  expected_reps TEXT NOT NULL DEFAULT '',
  expected_rest TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (session_id, exercise_order),
  UNIQUE (session_id, id_exercicio)
);

CREATE INDEX idx_training_session_exercises_session
  ON training_session_exercises (session_id, exercise_order);

CREATE TABLE training_session_sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  session_exercise_id TEXT NOT NULL REFERENCES training_session_exercises(id) ON DELETE CASCADE,
  set_order INTEGER NOT NULL CHECK (set_order > 0),
  load_value REAL CHECK (load_value IS NULL OR load_value >= 0),
  repetitions INTEGER CHECK (repetitions IS NULL OR repetitions > 0),
  rer REAL CHECK (
    rer IS NULL OR (
      rer BETWEEN 0 AND 10
      AND CAST(rer * 2 AS INTEGER) = rer * 2
    )
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (session_exercise_id, set_order)
);

CREATE INDEX idx_training_session_sets_session
  ON training_session_sets (session_id, session_exercise_id, set_order);
