export const REFERENCE_CATALOG_CSV_URL = "https://docs.google.com/spreadsheets/d/1ukUCtws2hV2_PW7JzduQV4cr_EcqVC6-EoHzut1KS0Y/export?format=csv&gid=139666673";

const APPROVED_FIRST_SYNC_SUBSTITUTIONS = [
  ["Agachamento livre com barra nas costas", "Agachamento com barra livre"],
  ["Desenvolvimento com halter", "Desenvolvimento com halteres sentado"],
];

export class CatalogSyncError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function cleanText(value) {
  return value === undefined || value === null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function normalizeHeader(value) {
  return cleanText(value)
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsv(csvText) {
  if (typeof csvText !== "string" || !csvText.trim()) {
    throw new CatalogSyncError("INVALID_REFERENCE_CATALOG", "A planilha de referência está vazia.");
  }

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    if (inQuotes) {
      if (character === '"') {
        if (csvText[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      if (cell) {
        throw new CatalogSyncError("INVALID_REFERENCE_CATALOG", "CSV da referência está malformado.");
      }
      inQuotes = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => cleanText(value))) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (inQuotes) {
    throw new CatalogSyncError("INVALID_REFERENCE_CATALOG", "CSV da referência está malformado.");
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => cleanText(value))) rows.push(row);
  return rows;
}

function parseDemand(value, exerciseName, muscleName) {
  const normalized = cleanText(value);
  if (!normalized) return 0;
  const numeric = Number(normalized.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new CatalogSyncError(
      "INVALID_REFERENCE_CATALOG",
      `Demanda muscular inválida em ${exerciseName}: ${muscleName}.`,
    );
  }
  return numeric;
}

function invalidCatalog(message) {
  throw new CatalogSyncError("INVALID_REFERENCE_CATALOG", message);
}

export function parseReferenceCatalogCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) invalidCatalog("A referência não contém exercícios.");

  const headers = rows[0];
  const headerKeys = headers.map(normalizeHeader);
  const positions = {};
  for (let index = 0; index < headerKeys.length; index += 1) {
    const key = headerKeys[index];
    if (!key) invalidCatalog("A referência possui um cabeçalho vazio.");
    if (positions[key] !== undefined) invalidCatalog(`Cabeçalho duplicado na referência: ${headers[index]}.`);
    positions[key] = index;
  }

  const requiredHeaders = ["exercicio", "grupo_muscular", "n_articulacao"];
  for (const requiredHeader of requiredHeaders) {
    if (positions[requiredHeader] === undefined) {
      invalidCatalog(`Cabeçalho obrigatório ausente: ${requiredHeader}.`);
    }
  }

  const metadataHeaders = new Set([
    "exercicio",
    "link_do_video",
    "grupo_muscular",
    "n_articulacao",
    "tipo",
  ]);
  const muscleColumns = headers
    .map((header, index) => ({ header: cleanText(header), key: headerKeys[index], index }))
    .filter((column) => !metadataHeaders.has(column.key));
  if (muscleColumns.length === 0) invalidCatalog("A referência não possui colunas de demanda muscular.");

  const catalog = [];
  const names = new Set();
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.length !== headers.length) {
      invalidCatalog(`Linha ${rowIndex + 1} da referência possui quantidade de colunas inválida.`);
    }
    const id_exercicio = cleanText(row[positions.exercicio]);
    const grupo_principal = cleanText(row[positions.grupo_muscular]);
    if (!id_exercicio || !grupo_principal) {
      invalidCatalog(`Linha ${rowIndex + 1} da referência não possui exercício ou grupo muscular.`);
    }
    const nameKey = id_exercicio.toLocaleLowerCase("pt-BR");
    if (names.has(nameKey)) invalidCatalog(`Exercício duplicado na referência: ${id_exercicio}.`);
    names.add(nameKey);

    const demands = {};
    for (const column of muscleColumns) {
      demands[column.header] = parseDemand(row[column.index], id_exercicio, column.header);
    }
    catalog.push({
      id_exercicio,
      video_url: positions.link_do_video === undefined ? "" : cleanText(row[positions.link_do_video]),
      grupo_principal,
      categoria_articular: cleanText(row[positions.n_articulacao]),
      tipo: positions.tipo === undefined ? "" : cleanText(row[positions.tipo]),
      demands,
    });
  }
  return catalog;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function asIsoString(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new CatalogSyncError("INVALID_REFERENCE_CATALOG", "Data de sincronização inválida.");
  }
  return date.toISOString();
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function buildCatalogUpserts(db, catalog, sourceUpdatedAt) {
  return chunks(catalog, 20).map((group) => {
    const values = group.map(() => "(?, ?, ?, ?, ?, 1, ?)").join(", ");
    const parameters = group.flatMap((exercise) => [
      exercise.id_exercicio,
      exercise.video_url,
      exercise.grupo_principal,
      exercise.categoria_articular,
      exercise.tipo,
      sourceUpdatedAt,
    ]);
    return db.prepare(`
      INSERT INTO exercise_catalog (
        id_exercicio, video_url, grupo_principal, categoria_articular, tipo, is_active, source_updated_at
      ) VALUES ${values}
      ON CONFLICT(id_exercicio) DO UPDATE SET
        video_url = excluded.video_url,
        grupo_principal = excluded.grupo_principal,
        categoria_articular = excluded.categoria_articular,
        tipo = excluded.tipo,
        is_active = 1,
        source_updated_at = excluded.source_updated_at,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).bind(...parameters);
  });
}

function buildDemandUpserts(db, catalog) {
  const demands = catalog.flatMap((exercise) => Object.entries(exercise.demands).map(([muscle, demand]) => ({
    id_exercicio: exercise.id_exercicio,
    muscle_name: muscle,
    demand,
  })));
  return chunks(demands, 30).map((group) => {
    const values = group.map(() => "(?, ?, ?)").join(", ");
    const parameters = group.flatMap((demand) => [demand.id_exercicio, demand.muscle_name, demand.demand]);
    return db.prepare(`
      INSERT INTO exercise_muscle_demands (id_exercicio, muscle_name, demand)
      VALUES ${values}
      ON CONFLICT(id_exercicio, muscle_name) DO UPDATE SET demand = excluded.demand
    `).bind(...parameters);
  });
}

async function readState(db) {
  const state = await db.prepare(`
    SELECT source_hash, last_attempt_at, last_success_at, active_exercise_count, last_error
    FROM catalog_sync_state WHERE id = 1
  `).first();
  if (!state) {
    throw new CatalogSyncError("CATALOG_SYNC_STATE_MISSING", "Estado de sincronização não encontrado.");
  }
  return state;
}

async function recordFailure(db, attemptedAt, error) {
  await db.prepare(`
    UPDATE catalog_sync_state
    SET last_attempt_at = ?, last_error = ?
    WHERE id = 1
  `).bind(attemptedAt, error.message || "Falha ao sincronizar catálogo.").run();
}

function statusFromState(state) {
  return {
    lastAttemptAt: state.last_attempt_at,
    lastSuccessAt: state.last_success_at,
    activeExerciseCount: Number(state.active_exercise_count),
    lastError: state.last_error,
  };
}

export async function getCatalogSyncStatus(db) {
  return statusFromState(await readState(db));
}

export async function syncReferenceCatalog({ db, fetchReference = () => fetch(REFERENCE_CATALOG_CSV_URL), now = new Date() }) {
  const attemptedAt = asIsoString(now);
  try {
    const response = await fetchReference();
    if (!response || !response.ok) {
      throw new CatalogSyncError("REFERENCE_CATALOG_FETCH_FAILED", "Não foi possível baixar a planilha de referência.");
    }
    const csvText = await response.text();
    const catalog = parseReferenceCatalogCsv(csvText);
    const sourceHash = await sha256(csvText);
    const state = await readState(db);

    if (state.source_hash === sourceHash) {
      await db.prepare(`
        UPDATE catalog_sync_state
        SET last_attempt_at = ?, last_error = ''
        WHERE id = 1
      `).bind(attemptedAt).run();
      return {
        changed: false,
        activeExerciseCount: Number(state.active_exercise_count),
        substitutionsApplied: 0,
        lastSuccessAt: state.last_success_at,
      };
    }

    const catalogIds = catalog.map((exercise) => exercise.id_exercicio);
    const sourceIdSet = new Set(catalogIds);
    let substitutions = [];
    if (!state.last_success_at) {
      const previousNames = APPROVED_FIRST_SYNC_SUBSTITUTIONS.map(([previousName]) => previousName);
      const placeholders = previousNames.map(() => "?").join(",");
      const { results } = await db.prepare(`
        SELECT id_exercicio FROM prescription_exercises WHERE id_exercicio IN (${placeholders})
      `).bind(...previousNames).all();
      const existingPrescriptionNames = new Set(results.map((row) => row.id_exercicio));
      substitutions = APPROVED_FIRST_SYNC_SUBSTITUTIONS.filter(([previousName, nextName]) =>
        existingPrescriptionNames.has(previousName) && sourceIdSet.has(nextName),
      );
    }

    const statements = [
      db.prepare(`
        UPDATE exercise_catalog
        SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE is_active = 1
      `),
      ...buildCatalogUpserts(db, catalog, attemptedAt),
      ...chunks(catalogIds, 50).map((ids) => db.prepare(
        `DELETE FROM exercise_muscle_demands WHERE id_exercicio IN (${ids.map(() => "?").join(",")})`,
      ).bind(...ids)),
      ...buildDemandUpserts(db, catalog),
      ...substitutions.map(([previousName, nextName]) => db.prepare(
        "UPDATE prescription_exercises SET id_exercicio = ? WHERE id_exercicio = ?",
      ).bind(nextName, previousName)),
      db.prepare(`
        UPDATE catalog_sync_state
        SET source_hash = ?, last_attempt_at = ?, last_success_at = ?, active_exercise_count = ?, last_error = ''
        WHERE id = 1
      `).bind(sourceHash, attemptedAt, attemptedAt, catalog.length),
    ];
    await db.batch(statements);

    return {
      changed: true,
      activeExerciseCount: catalog.length,
      substitutionsApplied: substitutions.length,
      lastSuccessAt: attemptedAt,
    };
  } catch (error) {
    const syncError = error instanceof CatalogSyncError
      ? error
      : new CatalogSyncError("REFERENCE_CATALOG_FETCH_FAILED", "Não foi possível sincronizar a planilha de referência.");
    await recordFailure(db, attemptedAt, syncError);
    throw syncError;
  }
}
