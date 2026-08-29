const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DATA_IMPORT_ROOT = path.join(ROOT, "data-import");
const REQUIRED_FILES = ["Demanda_Muscular.csv", "DB_Prescricao.csv", "DB_Execucao.csv"];
const PRESCRIPTION_COLUMNS = [
  "id_ficha", "id_treino", "id_exercicio", "observacoes", "ordem_exercicio",
  "semana_1_sets", "semana_1_reps", "semana_1_descanso",
  "semana_2_sets", "semana_2_reps", "semana_2_descanso",
  "semana_3_sets", "semana_3_reps", "semana_3_descanso",
  "semana_4_sets", "semana_4_reps", "semana_4_descanso",
];
const EXECUTION_COLUMNS = [
  "id_sessao", "data_treino", "id_exercicio", "semana_referencia",
  "carga_absoluta", "reps_executadas", "rir", "rpe_sessao", "sync_status",
];

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function normalizedHeader(value) {
  return text(value)
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV contém aspas sem fechamento.");
  if (cell !== "" || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function pathInsideDataImport(candidate, label) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(DATA_IMPORT_ROOT, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} deve ficar dentro de data-import/.`);
  }
  return resolved;
}

function sqlText(value) {
  return "'" + String(value === undefined || value === null ? "" : value).replace(/'/g, "''") + "'";
}

function sqlNumber(value) {
  return String(value);
}

function decimal(value, field, errors, rowNumber, options = {}) {
  const raw = text(value);
  if (!raw && options.emptyAsZero) return 0;
  let normalized = raw;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || (options.integer && !Number.isInteger(parsed))) {
    errors.push(`${field} inválido na linha ${rowNumber}: ${raw || "vazio"}.`);
    return null;
  }
  if (options.min !== undefined && parsed < options.min || options.max !== undefined && parsed > options.max) {
    errors.push(`${field} fora do intervalo na linha ${rowNumber}: ${raw}.`);
    return null;
  }
  return parsed;
}

function valueAt(row, headers, name) {
  const index = headers[name];
  return index === undefined ? "" : text(row[index]);
}

function readTable(sourceDirectory, fileName, errors) {
  const filePath = path.join(sourceDirectory, fileName);
  if (!fs.existsSync(filePath)) {
    errors.push(`Arquivo obrigatório ausente: ${fileName}.`);
    return { filePath, sha256: "", headers: [], rawHeaders: [], rows: [] };
  }
  const content = fs.readFileSync(filePath, "utf8");
  const csvRows = parseCsv(content);
  if (csvRows.length === 0) {
    errors.push(`${fileName} está vazio.`);
    return { filePath, sha256: crypto.createHash("sha256").update(content).digest("hex"), headers: [], rawHeaders: [], rows: [] };
  }
  const headers = {};
  csvRows[0].forEach((header, index) => {
    const normalized = normalizedHeader(header);
    if (!normalized) return;
    if (headers[normalized] !== undefined) {
      errors.push(`${fileName} possui cabeçalho duplicado: ${text(header)}.`);
      return;
    }
    headers[normalized] = index;
  });
  return {
    filePath,
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    headers,
    rawHeaders: csvRows[0],
    rows: csvRows.slice(1).filter((row) => row.some((value) => text(value))),
  };
}

function requireColumns(table, fileName, columns, errors) {
  columns.forEach((column) => {
    if (table.headers[column] === undefined) {
      errors.push(`${fileName} não possui o cabeçalho obrigatório: ${column}.`);
    }
  });
}

function firstHeader(table, aliases) {
  return aliases.find((alias) => table.headers[alias] !== undefined) || "";
}

function transaction(statements) {
  return ["BEGIN TRANSACTION;"].concat(statements).concat(["COMMIT;", ""]).join("\n");
}

function parseCatalog(table, errors) {
  const idHeader = firstHeader(table, ["id_exercicio", "nome", "nome_do_exercicio"]);
  const groupHeader = firstHeader(table, ["grupo_principal", "grupo"]);
  const typeHeader = firstHeader(table, ["tipo"]);
  if (!idHeader) errors.push("Demanda_Muscular.csv não possui id_exercicio ou Nome do Exercício.");
  if (!groupHeader) errors.push("Demanda_Muscular.csv não possui grupo_principal.");
  if (!typeHeader) errors.push("Demanda_Muscular.csv não possui tipo.");
  const fixedHeaders = [idHeader, groupHeader, typeHeader].filter(Boolean);
  const muscles = table.rawHeaders
    .map((header, index) => ({ name: text(header), normalized: normalizedHeader(header), index }))
    .filter((header) => header.name && fixedHeaders.indexOf(header.normalized) === -1);
  const seen = new Set();
  const records = [];
  let skippedRows = 0;

  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const id = valueAt(row, table.headers, idHeader);
    if (!id) {
      skippedRows += 1;
      return;
    }
    if (seen.has(id)) errors.push(`Demanda_Muscular.csv possui id_exercicio duplicado: ${id}.`);
    seen.add(id);
    const group = valueAt(row, table.headers, groupHeader);
    const type = valueAt(row, table.headers, typeHeader);
    if (!group) errors.push(`grupo_principal obrigatório na linha ${rowNumber} de Demanda_Muscular.csv.`);
    if (!type) errors.push(`tipo obrigatório na linha ${rowNumber} de Demanda_Muscular.csv.`);
    const demands = muscles.map((muscle) => ({
      muscle: muscle.name,
      value: decimal(row[muscle.index], `demanda ${muscle.name}`, errors, rowNumber, { emptyAsZero: true, min: 0, max: 1 }),
    }));
    records.push({ id, group, type, demands });
  });

  const statements = [];
  records.forEach((record) => {
    statements.push(
      "INSERT INTO exercise_catalog (id_exercicio, grupo_principal, tipo) VALUES (" +
      [sqlText(record.id), sqlText(record.group), sqlText(record.type)].join(", ") +
      ") ON CONFLICT(id_exercicio) DO UPDATE SET grupo_principal = excluded.grupo_principal, tipo = excluded.tipo;",
    );
    record.demands.forEach((demand) => {
      if (demand.value === null) return;
      statements.push(
        "INSERT INTO exercise_muscle_demands (id_exercicio, muscle_name, demand) VALUES (" +
        [sqlText(record.id), sqlText(demand.muscle), sqlNumber(demand.value)].join(", ") +
        ") ON CONFLICT(id_exercicio, muscle_name) DO UPDATE SET demand = excluded.demand;",
      );
    });
  });
  return { records, skippedRows, sql: transaction(statements) };
}

function parsePrescriptions(table, errors) {
  requireColumns(table, "DB_Prescricao.csv", PRESCRIPTION_COLUMNS, errors);
  const records = [];
  let skippedRows = 0;
  const seen = new Set();
  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const idExercicio = valueAt(row, table.headers, "id_exercicio");
    if (!idExercicio) {
      skippedRows += 1;
      return;
    }
    const record = {};
    PRESCRIPTION_COLUMNS.forEach((column) => { record[column] = valueAt(row, table.headers, column); });
    if (!record.id_ficha || !record.id_treino) errors.push(`Ficha e treino são obrigatórios na linha ${rowNumber} de DB_Prescricao.csv.`);
    const ordem = decimal(record.ordem_exercicio, "ordem_exercicio", errors, rowNumber, { integer: true, min: 1 });
    if (ordem !== null) record.ordem_exercicio = ordem;
    const key = [record.id_ficha, record.id_treino, record.ordem_exercicio].join("|");
    if (seen.has(key)) errors.push(`DB_Prescricao.csv possui chave duplicada: ${key}.`);
    seen.add(key);
    records.push(record);
  });
  const statements = records.map((record) => {
    const values = PRESCRIPTION_COLUMNS.map((column) => column === "ordem_exercicio" ? sqlNumber(record[column]) : sqlText(record[column]));
    return "INSERT INTO prescription_exercises (" + PRESCRIPTION_COLUMNS.join(", ") + ") VALUES (" + values.join(", ") + ") ON CONFLICT(id_ficha, id_treino, ordem_exercicio) DO UPDATE SET id_exercicio = excluded.id_exercicio, observacoes = excluded.observacoes, semana_1_sets = excluded.semana_1_sets, semana_1_reps = excluded.semana_1_reps, semana_1_descanso = excluded.semana_1_descanso, semana_2_sets = excluded.semana_2_sets, semana_2_reps = excluded.semana_2_reps, semana_2_descanso = excluded.semana_2_descanso, semana_3_sets = excluded.semana_3_sets, semana_3_reps = excluded.semana_3_reps, semana_3_descanso = excluded.semana_3_descanso, semana_4_sets = excluded.semana_4_sets, semana_4_reps = excluded.semana_4_reps, semana_4_descanso = excluded.semana_4_descanso;";
  });
  return { records, skippedRows, sql: transaction(statements) };
}

function parseExecutions(table, errors) {
  requireColumns(table, "DB_Execucao.csv", EXECUTION_COLUMNS, errors);
  const records = [];
  const seen = new Set();
  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const record = {};
    EXECUTION_COLUMNS.forEach((column) => { record[column] = valueAt(row, table.headers, column); });
    ["id_sessao", "data_treino", "id_exercicio"].forEach((column) => {
      if (!record[column]) errors.push(`${column} obrigatório na linha ${rowNumber} de DB_Execucao.csv.`);
    });
    if (seen.has(record.id_sessao)) errors.push(`DB_Execucao.csv possui id_sessao duplicado: ${record.id_sessao}.`);
    seen.add(record.id_sessao);
    ["carga_absoluta", "reps_executadas", "rir", "rpe_sessao"].forEach((column) => {
      record[column] = decimal(record[column], column, errors, rowNumber, {
        integer: column === "reps_executadas",
        min: 0,
        max: column === "rir" || column === "rpe_sessao" ? 10 : undefined,
      });
    });
    record.sync_status = record.sync_status || "clean";
    records.push(record);
  });
  const statements = records.map((record) => {
    const values = EXECUTION_COLUMNS.map((column) => ["carga_absoluta", "reps_executadas", "rir", "rpe_sessao"].indexOf(column) !== -1 ? sqlNumber(record[column]) : sqlText(record[column]));
    return "INSERT INTO execution_records (" + EXECUTION_COLUMNS.join(", ") + ") VALUES (" + values.join(", ") + ") ON CONFLICT(id_sessao) DO UPDATE SET data_treino = excluded.data_treino, id_exercicio = excluded.id_exercicio, semana_referencia = excluded.semana_referencia, carga_absoluta = excluded.carga_absoluta, reps_executadas = excluded.reps_executadas, rir = excluded.rir, rpe_sessao = excluded.rpe_sessao, sync_status = excluded.sync_status;";
  });
  return { records, skippedRows: 0, sql: transaction(statements) };
}

function tableManifest(fileName, table, parsed) {
  return {
    sourceFile: fileName,
    sha256: table.sha256,
    parsedRows: table.rows.length,
    skippedRows: parsed.skippedRows,
    importedRows: parsed.records.length,
    uniqueKeys: new Set(parsed.records.map((record) => record.id || record.id_sessao || [record.id_ficha, record.id_treino, record.ordem_exercicio].join("|"))).size,
    keys: fileName === "DB_Execucao.csv" ? parsed.records.map((record) => record.id_sessao) : undefined,
  };
}

function runImport({ source, output }) {
  const sourceDirectory = pathInsideDataImport(source, "--source");
  const outputDirectory = pathInsideDataImport(output, "--output");
  if (sourceDirectory === outputDirectory) {
    throw new Error("--source e --output devem ser pastas diferentes.");
  }
  const errors = [];
  if (!fs.existsSync(sourceDirectory) || !fs.statSync(sourceDirectory).isDirectory()) {
    throw new Error("--source deve apontar para uma pasta existente.");
  }
  const actualFiles = fs.readdirSync(sourceDirectory).filter((name) => fs.statSync(path.join(sourceDirectory, name)).isFile());
  actualFiles.forEach((name) => {
    if (REQUIRED_FILES.indexOf(name) === -1) errors.push(`Arquivo não esperado em --source: ${name}.`);
  });
  REQUIRED_FILES.forEach((name) => {
    if (actualFiles.indexOf(name) === -1) errors.push(`Arquivo obrigatório ausente: ${name}.`);
  });

  const catalogTable = readTable(sourceDirectory, "Demanda_Muscular.csv", errors);
  const prescriptionTable = readTable(sourceDirectory, "DB_Prescricao.csv", errors);
  const executionTable = readTable(sourceDirectory, "DB_Execucao.csv", errors);
  const catalog = parseCatalog(catalogTable, errors);
  const prescriptions = parsePrescriptions(prescriptionTable, errors);
  const executions = parseExecutions(executionTable, errors);
  const catalogIds = new Set(catalog.records.map((record) => record.id));
  prescriptions.records.forEach((record) => {
    if (!catalogIds.has(record.id_exercicio)) {
      errors.push(`DB_Prescricao.csv referencia exercício fora de Demanda_Muscular: ${record.id_exercicio}.`);
    }
  });
  const manifest = {
    createdAt: new Date().toISOString(),
    ok: errors.length === 0,
    validationErrors: errors,
    tables: {
      exercise_catalog: tableManifest("Demanda_Muscular.csv", catalogTable, catalog),
      prescription_exercises: tableManifest("DB_Prescricao.csv", prescriptionTable, prescriptions),
      execution_records: tableManifest("DB_Execucao.csv", executionTable, executions),
    },
  };

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, "import-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  if (manifest.ok) {
    fs.writeFileSync(path.join(outputDirectory, "01-exercise-catalog.sql"), catalog.sql, "utf8");
    fs.writeFileSync(path.join(outputDirectory, "02-prescriptions.sql"), prescriptions.sql, "utf8");
    fs.writeFileSync(path.join(outputDirectory, "03-executions.sql"), executions.sql, "utf8");
  }
  return manifest;
}

function parseArguments(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--source" || key === "--output") args[key.slice(2)] = argv[index + 1];
  }
  if (!args.source || !args.output) throw new Error("Uso: node scripts/import-google-sheet-csv.js --source data-import/source --output data-import/staging");
  return args;
}

if (require.main === module) {
  try {
    const manifest = runImport(parseArguments(process.argv.slice(2)));
    process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
    if (!manifest.ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}

module.exports = { normalizedHeader, parseCsv, runImport };
