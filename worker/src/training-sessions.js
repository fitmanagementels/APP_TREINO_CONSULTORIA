const CYCLE_COLUMNS = {
  1: ["semana_1_sets", "semana_1_reps", "semana_1_descanso"],
  2: ["semana_2_sets", "semana_2_reps", "semana_2_descanso"],
  3: ["semana_3_sets", "semana_3_reps", "semana_3_descanso"],
  4: ["semana_4_sets", "semana_4_reps", "semana_4_descanso"],
};

export class TrainingSessionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "TrainingSessionError";
    this.code = code;
    this.details = details;
  }
}

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function isoDate(value) {
  const normalized = text(value);
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalized)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new TrainingSessionError("INVALID_SESSION", "Data do treino inválida.");
  }
  return normalized;
}

function sessionOptions(options = {}) {
  const now = options.now || new Date();
  const parsedNow = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(parsedNow.getTime())) {
    throw new TrainingSessionError("INVALID_SESSION", "Horário da sessão inválido.");
  }
  return {
    timestamp: parsedNow.toISOString(),
    idFactory: options.idFactory || (() => crypto.randomUUID()),
  };
}

function normalizeStartPayload(payload) {
  const source = payload || {};
  const mode = text(source.mode);
  const session_date = isoDate(source.session_date);
  if (mode === "free") {
    return {
      mode,
      session_date,
      id_ficha: "",
      id_treino: "",
      cycle_reference: null,
    };
  }
  if (mode !== "prescribed") {
    throw new TrainingSessionError("INVALID_SESSION", "Modalidade de treino inválida.");
  }

  const id_ficha = text(source.id_ficha);
  const id_treino = text(source.id_treino);
  const cycle_reference = Number(source.cycle_reference);
  if (!id_ficha || !id_treino || !Number.isInteger(cycle_reference) || !CYCLE_COLUMNS[cycle_reference]) {
    throw new TrainingSessionError(
      "INVALID_SESSION",
      "Ficha, treino e ciclo são obrigatórios para o treino prescrito.",
    );
  }
  return { mode, session_date, id_ficha, id_treino, cycle_reference };
}

function numericOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeSessionRow(row) {
  return {
    ...row,
    cycle_reference: numericOrNull(row.cycle_reference),
    session_pse: numericOrNull(row.session_pse),
  };
}

function normalizeExerciseRow(row) {
  return {
    ...row,
    exercise_order: Number(row.exercise_order),
    sets: [],
  };
}

function normalizeSetRow(row) {
  return {
    ...row,
    set_order: Number(row.set_order),
    load_value: numericOrNull(row.load_value),
    repetitions: numericOrNull(row.repetitions),
    rer: numericOrNull(row.rer),
  };
}

async function assembleSession(db, sessionRow) {
  if (!sessionRow) return null;
  const [exerciseResult, setResult] = await db.batch([
    db.prepare(`
      SELECT id, session_id, id_exercicio, exercise_order, source, observations,
             expected_sets, expected_reps, expected_rest, created_at, updated_at
      FROM training_session_exercises
      WHERE session_id = ?
      ORDER BY exercise_order ASC
    `).bind(sessionRow.id),
    db.prepare(`
      SELECT id, session_id, session_exercise_id, set_order,
             load_value, repetitions, rer, created_at, updated_at
      FROM training_session_sets
      WHERE session_id = ?
      ORDER BY session_exercise_id ASC, set_order ASC
    `).bind(sessionRow.id),
  ]);
  const exercises = exerciseResult.results.map(normalizeExerciseRow);
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  for (const row of setResult.results) {
    const exercise = exerciseById.get(row.session_exercise_id);
    if (exercise) exercise.sets.push(normalizeSetRow(row));
  }
  return { ...normalizeSessionRow(sessionRow), exercises };
}

async function getTrainingSessionById(db, sessionId) {
  const row = await db.prepare(`
    SELECT id, session_date, mode, status, id_ficha, id_treino,
           cycle_reference, session_pse, started_at, completed_at,
           canceled_at, updated_at
    FROM training_sessions
    WHERE id = ?
  `).bind(sessionId).first();
  return assembleSession(db, row);
}

export async function getActiveTrainingSession(db) {
  const row = await db.prepare(`
    SELECT id, session_date, mode, status, id_ficha, id_treino,
           cycle_reference, session_pse, started_at, completed_at,
           canceled_at, updated_at
    FROM training_sessions
    WHERE status = 'in_progress'
    LIMIT 1
  `).first();
  return assembleSession(db, row);
}

function expectedSetCount(value) {
  const match = text(value).match(/^\d+/);
  const count = match ? Number(match[0]) : 0;
  return Number.isInteger(count) && count > 0 ? count : 1;
}

async function prescribedExercises(db, selection) {
  const [setsColumn, repsColumn, restColumn] = CYCLE_COLUMNS[selection.cycle_reference];
  const { results } = await db.prepare(`
    SELECT prescription.id_exercicio, prescription.observacoes,
           prescription.ordem_exercicio,
           prescription.${setsColumn} AS expected_sets,
           prescription.${repsColumn} AS expected_reps,
           prescription.${restColumn} AS expected_rest
    FROM prescription_exercises AS prescription
    INNER JOIN exercise_catalog AS catalog
      ON catalog.id_exercicio = prescription.id_exercicio
     AND catalog.is_active = 1
    WHERE prescription.id_ficha = ? AND prescription.id_treino = ?
    ORDER BY prescription.ordem_exercicio ASC
  `).bind(selection.id_ficha, selection.id_treino).all();
  if (results.length === 0) {
    throw new TrainingSessionError(
      "PRESCRIPTION_NOT_FOUND",
      "Nenhum exercício ativo foi encontrado para a prescrição selecionada.",
    );
  }
  return results;
}

function sessionInsert(db, id, selection, timestamp) {
  return db.prepare(`
    INSERT INTO training_sessions (
      id, session_date, mode, status, id_ficha, id_treino,
      cycle_reference, started_at, updated_at
    ) VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)
  `).bind(
    id,
    selection.session_date,
    selection.mode,
    selection.id_ficha,
    selection.id_treino,
    selection.cycle_reference,
    timestamp,
    timestamp,
  );
}

export async function startTrainingSession(db, payload, options = {}) {
  const selection = normalizeStartPayload(payload);
  const activeSession = await getActiveTrainingSession(db);
  if (activeSession) {
    throw new TrainingSessionError(
      "ACTIVE_SESSION_EXISTS",
      "Já existe uma sessão de treino em andamento.",
      { activeSession },
    );
  }

  const { timestamp, idFactory } = sessionOptions(options);
  const sessionId = idFactory();
  const statements = [sessionInsert(db, sessionId, selection, timestamp)];

  if (selection.mode === "prescribed") {
    const exercises = await prescribedExercises(db, selection);
    for (const exercise of exercises) {
      const exerciseId = idFactory();
      statements.push(db.prepare(`
        INSERT INTO training_session_exercises (
          id, session_id, id_exercicio, exercise_order, source, observations,
          expected_sets, expected_reps, expected_rest, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'prescription', ?, ?, ?, ?, ?, ?)
      `).bind(
        exerciseId,
        sessionId,
        exercise.id_exercicio,
        Number(exercise.ordem_exercicio),
        text(exercise.observacoes),
        text(exercise.expected_sets),
        text(exercise.expected_reps),
        text(exercise.expected_rest),
        timestamp,
        timestamp,
      ));
      const setCount = expectedSetCount(exercise.expected_sets);
      for (let setOrder = 1; setOrder <= setCount; setOrder += 1) {
        statements.push(db.prepare(`
          INSERT INTO training_session_sets (
            id, session_id, session_exercise_id, set_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(idFactory(), sessionId, exerciseId, setOrder, timestamp, timestamp));
      }
    }
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const concurrentSession = await getActiveTrainingSession(db);
    if (concurrentSession) {
      throw new TrainingSessionError(
        "ACTIVE_SESSION_EXISTS",
        "Já existe uma sessão de treino em andamento.",
        { activeSession: concurrentSession },
      );
    }
    throw error;
  }

  return getTrainingSessionById(db, sessionId);
}
