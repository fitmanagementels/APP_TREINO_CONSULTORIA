function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function number(value, field, { integer = false, min = 0, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)) || parsed < min || parsed > max) {
    throw new ExecutionValidationError("INVALID_EXECUTION", `${field} inválido.`);
  }
  return parsed;
}

function parseSessionId(idSessao) {
  const parts = text(idSessao).split("_");
  if (parts.length < 6) {
    return { id_ficha: "", id_treino: "" };
  }
  return {
    id_ficha: parts[0],
    id_treino: parts[1],
  };
}

export class ExecutionValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function normalizeRecord(record) {
  const id_sessao = text(record && record.id_sessao);
  const data_treino = text(record && record.data_treino);
  const id_exercicio = text(record && record.id_exercicio);
  if (!id_sessao) {
    throw new ExecutionValidationError("INVALID_EXECUTION", "id_sessao obrigatório.");
  }
  if (!data_treino) {
    throw new ExecutionValidationError("INVALID_EXECUTION", "data_treino obrigatório.");
  }
  if (!id_exercicio) {
    throw new ExecutionValidationError("INVALID_EXECUTION", "id_exercicio obrigatório.");
  }

  return {
    id_sessao,
    data_treino,
    id_exercicio,
    semana_referencia: text(record.semana_referencia),
    carga_absoluta: number(record.carga_absoluta, "carga_absoluta"),
    reps_executadas: number(record.reps_executadas, "reps_executadas", { integer: true }),
    rir: number(record.rir, "rir", { max: 10 }),
    rpe_sessao: number(record.rpe_sessao, "rpe_sessao", { max: 10 }),
  };
}

export async function syncExecucaoData(db, records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ExecutionValidationError("INVALID_EXECUTION", "Nenhum registro.");
  }

  const normalized = records.map(normalizeRecord);
  const statement = `
    INSERT INTO execution_records (
      id_sessao, data_treino, id_exercicio, semana_referencia,
      carga_absoluta, reps_executadas, rir, rpe_sessao, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'clean')
    ON CONFLICT(id_sessao) DO UPDATE SET
      data_treino = excluded.data_treino,
      id_exercicio = excluded.id_exercicio,
      semana_referencia = excluded.semana_referencia,
      carga_absoluta = excluded.carga_absoluta,
      reps_executadas = excluded.reps_executadas,
      rir = excluded.rir,
      rpe_sessao = excluded.rpe_sessao,
      sync_status = 'clean',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `;
  await db.batch(
    normalized.map((record) =>
      db.prepare(statement).bind(
        record.id_sessao,
        record.data_treino,
        record.id_exercicio,
        record.semana_referencia,
        record.carga_absoluta,
        record.reps_executadas,
        record.rir,
        record.rpe_sessao,
      ),
    ),
  );

  return {
    synced: normalized.length,
    acceptedSessionIds: normalized.map((record) => record.id_sessao),
  };
}

export async function getExecucaoData(db) {
  const { results } = await db
    .prepare(`
      SELECT id_sessao, data_treino, id_exercicio, semana_referencia,
             carga_absoluta, reps_executadas, rir, rpe_sessao, sync_status
      FROM execution_records
      ORDER BY substr(data_treino, 7, 4) DESC, substr(data_treino, 4, 2) DESC, substr(data_treino, 1, 2) DESC, id_sessao ASC
    `)
    .all();

  return {
    rows: results.map((row) => ({
      ...row,
      ...parseSessionId(row.id_sessao),
      carga_absoluta: Number(row.carga_absoluta),
      reps_executadas: Number(row.reps_executadas),
      rir: Number(row.rir),
      rpe_sessao: Number(row.rpe_sessao),
    })),
  };
}
