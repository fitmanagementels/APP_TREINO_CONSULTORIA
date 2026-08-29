import { getExecucaoData } from "./executions.js";
import { getPrescricaoData } from "./prescriptions.js";

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function sanitizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function dateValue(value) {
  const parts = String(value).split("/");
  if (parts.length !== 3) return 0;
  return Number(`${parts[2]}${parts[1]}${parts[0]}`);
}

export async function getInitialAppData(db) {
  const result = {
    prescricao: { rows: [] },
    historico: { rows: [] },
    status: {
      prescricaoRows: 0,
      historicoRows: 0,
      prescricaoSource: "D1",
      execucaoSource: "D1",
    },
    errors: [],
    error: "",
    updatedAt: new Date().toISOString(),
  };

  try {
    result.prescricao = await getPrescricaoData(db);
    result.status.prescricaoRows = result.prescricao.rows.length;
  } catch (error) {
    result.errors.push(`prescricao: ${error.message}`);
  }

  try {
    result.historico = await getExecucaoData(db);
    result.status.historicoRows = result.historico.rows.length;
  } catch (error) {
    result.errors.push(`historico: ${error.message}`);
  }

  result.error = result.errors.join(" | ");
  return result;
}

export async function getGestaoCargaData(db) {
  const { rows } = await getExecucaoData(db);
  const sessionsByGroup = new Map();
  const exerciseNames = new Set();

  for (const row of rows) {
    const groupKey = `${row.data_treino}|${row.id_ficha || "SEM_FICHA"}|${row.id_treino || "SEM_TREINO"}`;
    const carga = Number(row.carga_absoluta) || 0;
    const reps = Number(row.reps_executadas) || 0;
    const rpe = Number(row.rpe_sessao) || 0;
    const exercise = {
      nome: row.id_exercicio,
      id_exercicio: row.id_exercicio,
      carga,
      reps,
      volumeLoad: carga * reps,
      e1rm: reps > 0 ? carga * (1 + reps / 30) : 0,
      rpe,
    };

    if (!sessionsByGroup.has(groupKey)) {
      sessionsByGroup.set(groupKey, {
        idResumoSessao: sanitizeId(groupKey),
        idSessaoGrupo: groupKey,
        data: row.data_treino,
        id_ficha: row.id_ficha || "SEM_FICHA",
        id_treino: row.id_treino || "SEM_TREINO",
        exercises: [],
      });
    }
    sessionsByGroup.get(groupKey).exercises.push(exercise);
    exerciseNames.add(exercise.nome);
  }

  const sessoes = [...sessionsByGroup.values()].map((session) => {
    const totalSeries = session.exercises.length;
    const exerciseSet = new Set(session.exercises.map((exercise) => exercise.nome));
    const volumeTotal = session.exercises.reduce((total, exercise) => total + exercise.volumeLoad, 0);
    const rpeValues = session.exercises.filter((exercise) => exercise.rpe > 0).map((exercise) => exercise.rpe);
    const principal = session.exercises.reduce(
      (current, exercise) => (exercise.volumeLoad > current.volumeLoad ? exercise : current),
      { nome: "-", volumeLoad: 0 },
    );
    const best = session.exercises.reduce(
      (current, exercise) => (exercise.e1rm > current.e1rm ? exercise : current),
      { e1rm: 0, carga: 0 },
    );

    return {
      idResumoSessao: session.idResumoSessao,
      idSessaoGrupo: session.idSessaoGrupo,
      data: session.data,
      id_ficha: session.id_ficha,
      id_treino: session.id_treino,
      totalExercicios: exerciseSet.size,
      totalSeries,
      volumeTotal,
      rpeMedia: rpeValues.length > 0 ? roundOne(rpeValues.reduce((total, value) => total + value, 0) / rpeValues.length) : 0,
      exercicioPrincipal: principal.nome,
      melhorE1rmSessao: roundOne(best.e1rm),
      maiorCargaSessao: best.carga,
      duracaoEstimadaMin: totalSeries * 3,
      origemDados: "DB_Execucao",
      updatedAt: new Date().toISOString(),
      exercicios: session.exercises,
    };
  });

  sessoes.sort((left, right) => dateValue(left.data) - dateValue(right.data));
  const e1rmByExercise = {};
  for (const session of sessoes) {
    for (const exercise of session.exercicios) {
      if (!e1rmByExercise[exercise.nome]) e1rmByExercise[exercise.nome] = [];
      e1rmByExercise[exercise.nome].push({
        data: session.data,
        e1rm: roundOne(exercise.e1rm),
        carga: exercise.carga,
      });
    }
  }

  return {
    sessoes,
    e1rmByExercise,
    exercicios: [...exerciseNames].sort((left, right) => left.localeCompare(right, "pt-BR")),
  };
}
