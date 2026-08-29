CREATE TABLE IF NOT EXISTS exercise_catalog (
  id_exercicio TEXT PRIMARY KEY NOT NULL,
  grupo_principal TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS exercise_muscle_demands (
  id_exercicio TEXT NOT NULL REFERENCES exercise_catalog(id_exercicio),
  muscle_name TEXT NOT NULL,
  demand REAL NOT NULL CHECK (demand >= 0 AND demand <= 1),
  PRIMARY KEY (id_exercicio, muscle_name)
);

CREATE TABLE IF NOT EXISTS prescription_exercises (
  id_ficha TEXT NOT NULL,
  id_treino TEXT NOT NULL,
  id_exercicio TEXT NOT NULL REFERENCES exercise_catalog(id_exercicio),
  observacoes TEXT NOT NULL DEFAULT '',
  ordem_exercicio INTEGER NOT NULL CHECK (ordem_exercicio > 0),
  semana_1_sets TEXT NOT NULL DEFAULT '',
  semana_1_reps TEXT NOT NULL DEFAULT '',
  semana_1_descanso TEXT NOT NULL DEFAULT '',
  semana_2_sets TEXT NOT NULL DEFAULT '',
  semana_2_reps TEXT NOT NULL DEFAULT '',
  semana_2_descanso TEXT NOT NULL DEFAULT '',
  semana_3_sets TEXT NOT NULL DEFAULT '',
  semana_3_reps TEXT NOT NULL DEFAULT '',
  semana_3_descanso TEXT NOT NULL DEFAULT '',
  semana_4_sets TEXT NOT NULL DEFAULT '',
  semana_4_reps TEXT NOT NULL DEFAULT '',
  semana_4_descanso TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id_ficha, id_treino, ordem_exercicio)
);

CREATE INDEX IF NOT EXISTS idx_prescription_lookup
  ON prescription_exercises (id_ficha, id_treino, ordem_exercicio);

CREATE TABLE IF NOT EXISTS execution_records (
  id_sessao TEXT PRIMARY KEY NOT NULL,
  data_treino TEXT NOT NULL,
  id_exercicio TEXT NOT NULL,
  semana_referencia TEXT NOT NULL DEFAULT '',
  carga_absoluta REAL NOT NULL DEFAULT 0,
  reps_executadas INTEGER NOT NULL DEFAULT 0,
  rir REAL NOT NULL DEFAULT 0,
  rpe_sessao REAL NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'clean',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_execution_date ON execution_records (data_treino);
CREATE INDEX IF NOT EXISTS idx_execution_exercise_date ON execution_records (id_exercicio, data_treino);
