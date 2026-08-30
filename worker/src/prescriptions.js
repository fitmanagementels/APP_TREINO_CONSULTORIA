const PRESCRIPTION_COLUMNS = `
  prescription.id_ficha, prescription.id_treino, prescription.id_exercicio,
  prescription.id_exercicio AS nome_exercicio,
  prescription.observacoes, prescription.ordem_exercicio,
  prescription.semana_1_sets, prescription.semana_1_reps, prescription.semana_1_descanso,
  prescription.semana_2_sets, prescription.semana_2_reps, prescription.semana_2_descanso,
  prescription.semana_3_sets, prescription.semana_3_reps, prescription.semana_3_descanso,
  prescription.semana_4_sets, prescription.semana_4_reps, prescription.semana_4_descanso
`;

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "pt-BR"),
  );
}

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function cycleValue(exercise, week, field) {
  const direct = exercise[`semana_${week}_${field}`];
  if (direct !== undefined) return text(direct);
  if (Array.isArray(exercise.ciclos) && exercise.ciclos[week - 1]) {
    return text(exercise.ciclos[week - 1][field]);
  }
  return "";
}

export class PrescriptionValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function normalizeExercises(payload) {
  if (!payload || !Array.isArray(payload.exercicios)) {
    throw new PrescriptionValidationError("INVALID_PAYLOAD", "Lista de exercícios inválida.");
  }

  return payload.exercicios.map((exercise, index) => {
    const id_exercicio = text(exercise.id_exercicio || exercise.nome);
    if (!id_exercicio) {
      throw new PrescriptionValidationError("INVALID_EXERCISE", "Exercício obrigatório.");
    }

    return {
      id_exercicio,
      observacoes: text(exercise.observacoes),
      ordem_exercicio: index + 1,
      semana_1_sets: cycleValue(exercise, 1, "sets"),
      semana_1_reps: cycleValue(exercise, 1, "reps"),
      semana_1_descanso: cycleValue(exercise, 1, "descanso"),
      semana_2_sets: cycleValue(exercise, 2, "sets"),
      semana_2_reps: cycleValue(exercise, 2, "reps"),
      semana_2_descanso: cycleValue(exercise, 2, "descanso"),
      semana_3_sets: cycleValue(exercise, 3, "sets"),
      semana_3_reps: cycleValue(exercise, 3, "reps"),
      semana_3_descanso: cycleValue(exercise, 3, "descanso"),
      semana_4_sets: cycleValue(exercise, 4, "sets"),
      semana_4_reps: cycleValue(exercise, 4, "reps"),
      semana_4_descanso: cycleValue(exercise, 4, "descanso"),
    };
  });
}

export async function getPrescricaoData(db) {
  const { results } = await db
    .prepare(`
      SELECT ${PRESCRIPTION_COLUMNS}
      FROM prescription_exercises AS prescription
      INNER JOIN exercise_catalog AS catalog
        ON catalog.id_exercicio = prescription.id_exercicio
       AND catalog.is_active = 1
      ORDER BY prescription.id_ficha COLLATE NOCASE, prescription.id_treino COLLATE NOCASE, prescription.ordem_exercicio ASC
    `)
    .all();

  return {
    rows: results.map((row) => ({
      ...row,
      ordem_exercicio: Number(row.ordem_exercicio),
    })),
  };
}

export async function getDemandaMuscularData(db) {
  const [catalogResult, demandsResult] = await db.batch([
    db.prepare(`
      SELECT id_exercicio, video_url, grupo_principal, categoria_articular, tipo
      FROM exercise_catalog
      WHERE is_active = 1
      ORDER BY id_exercicio COLLATE NOCASE
    `),
    db.prepare(`
      SELECT demands.id_exercicio, demands.muscle_name, demands.demand
      FROM exercise_muscle_demands AS demands
      INNER JOIN exercise_catalog AS catalog
        ON catalog.id_exercicio = demands.id_exercicio
       AND catalog.is_active = 1
      ORDER BY demands.muscle_name COLLATE NOCASE, demands.id_exercicio COLLATE NOCASE
    `),
  ]);
  const demandsByExercise = new Map();
  const muscles = [];

  for (const demand of demandsResult.results) {
    if (!demandsByExercise.has(demand.id_exercicio)) {
      demandsByExercise.set(demand.id_exercicio, {});
    }
    demandsByExercise.get(demand.id_exercicio)[demand.muscle_name] = Number(demand.demand);
    muscles.push(demand.muscle_name);
  }

  const rows = catalogResult.results.map((exercise) => ({
    nome: exercise.id_exercicio,
    id_exercicio: exercise.id_exercicio,
    video_url: exercise.video_url,
    grupo_principal: exercise.grupo_principal,
    categoria_articular: exercise.categoria_articular,
    tipo: exercise.tipo,
    demandas: demandsByExercise.get(exercise.id_exercicio) || {},
  }));

  return {
    rows,
    grupos: sortedUnique(rows.map((row) => row.grupo_principal)),
    tipos: sortedUnique(rows.map((row) => row.tipo)),
    musculos: sortedUnique(muscles),
  };
}

export async function getPrescriptionEditorData(db) {
  const [catalogo, prescricao] = await Promise.all([
    getDemandaMuscularData(db),
    getPrescricaoData(db),
  ]);
  const fichas = [];
  const treinosPorFicha = {};

  for (const row of prescricao.rows) {
    if (!treinosPorFicha[row.id_ficha]) treinosPorFicha[row.id_ficha] = [];
    fichas.push(row.id_ficha);
    treinosPorFicha[row.id_ficha].push(row.id_treino);
  }

  for (const ficha of Object.keys(treinosPorFicha)) {
    treinosPorFicha[ficha] = sortedUnique(treinosPorFicha[ficha]);
  }

  return {
    catalogo,
    prescricao,
    fichas: sortedUnique(fichas),
    treinosPorFicha,
    updatedAt: new Date().toISOString(),
  };
}

export async function savePrescricaoTreino(db, idFicha, idTreino, payload) {
  const normalizedFicha = text(idFicha);
  const normalizedTreino = text(idTreino);
  if (!normalizedFicha) {
    throw new PrescriptionValidationError("INVALID_PAYLOAD", "Ficha obrigatória.");
  }
  if (!normalizedTreino) {
    throw new PrescriptionValidationError("INVALID_PAYLOAD", "Treino obrigatório.");
  }

  const exercises = normalizeExercises(payload);
  const exerciseIds = sortedUnique(exercises.map((exercise) => exercise.id_exercicio));

  if (exerciseIds.length > 0) {
    const placeholders = exerciseIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id_exercicio FROM exercise_catalog WHERE is_active = 1 AND id_exercicio IN (${placeholders})`)
      .bind(...exerciseIds)
      .all();
    const catalogIds = new Set(results.map((row) => row.id_exercicio));
    const unknown = exerciseIds.find((id) => !catalogIds.has(id));
    if (unknown) {
      throw new PrescriptionValidationError(
        "INVALID_EXERCISE",
        `Exercício fora do catálogo: ${unknown}.`,
      );
    }
  }

  const statements = [
    db
      .prepare("DELETE FROM prescription_exercises WHERE id_ficha = ? AND id_treino = ?")
      .bind(normalizedFicha, normalizedTreino),
  ];
  const insert = `
    INSERT INTO prescription_exercises (
      id_ficha, id_treino, id_exercicio, observacoes, ordem_exercicio,
      semana_1_sets, semana_1_reps, semana_1_descanso,
      semana_2_sets, semana_2_reps, semana_2_descanso,
      semana_3_sets, semana_3_reps, semana_3_descanso,
      semana_4_sets, semana_4_reps, semana_4_descanso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const exercise of exercises) {
    statements.push(
      db.prepare(insert).bind(
        normalizedFicha,
        normalizedTreino,
        exercise.id_exercicio,
        exercise.observacoes,
        exercise.ordem_exercicio,
        exercise.semana_1_sets,
        exercise.semana_1_reps,
        exercise.semana_1_descanso,
        exercise.semana_2_sets,
        exercise.semana_2_reps,
        exercise.semana_2_descanso,
        exercise.semana_3_sets,
        exercise.semana_3_reps,
        exercise.semana_3_descanso,
        exercise.semana_4_sets,
        exercise.semana_4_reps,
        exercise.semana_4_descanso,
      ),
    );
  }

  await db.batch(statements);
  return getPrescriptionEditorData(db);
}
