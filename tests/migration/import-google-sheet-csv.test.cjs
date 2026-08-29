const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { runImport } = require("../../scripts/import-google-sheet-csv.js");
const projectRoot = path.resolve(__dirname, "..", "..");
const dataImportRoot = path.join(projectRoot, "data-import");

const PRESCRIPTION_HEADERS = [
  "id_ficha", "id_treino", "id_exercicio", "observacoes", "ordem_exercicio",
  "semana_1_sets", "semana_1_reps", "semana_1_descanso",
  "semana_2_sets", "semana_2_reps", "semana_2_descanso",
  "semana_3_sets", "semana_3_reps", "semana_3_descanso",
  "semana_4_sets", "semana_4_reps", "semana_4_descanso",
].join(",");

const EXECUTION_HEADERS = [
  "id_sessao", "data_treino", "id_exercicio", "semana_referencia",
  "carga_absoluta", "reps_executadas", "rir", "rpe_sessao", "sync_status",
].join(",");

function makeSource(files) {
  fs.mkdirSync(dataImportRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(dataImportRoot, "source-test-"));
  Object.entries(files).forEach(([name, content]) => {
    fs.writeFileSync(path.join(directory, name), content, "utf8");
  });
  return directory;
}

function sourceFiles(executionRows) {
  return {
    "Demanda_Muscular.csv": "\uFEFFNome do Exercício , Grupo Principal , Tipo , Peitoral\nSupino d'halteres,Peito,Composto,\"0,75\"\n",
    "DB_Prescricao.csv": `${PRESCRIPTION_HEADERS}\nFicha 1,Treino A,Supino d'halteres,,1,3,10,60,3,10,60,3,10,60,3,10,60\nFicha 1,Treino A,,,2,3,10,60,3,10,60,3,10,60,3,10,60\n`,
    "DB_Execucao.csv": `${EXECUTION_HEADERS}\n${executionRows}\n`,
  };
}

test("normalizes BOM/whitespace headers, accepts comma demand, and skips empty prescription exercises", () => {
  const source = makeSource(sourceFiles("sessao-1,01/08/2026,Supino d'halteres,1,20,10,2,8,clean"));
  const output = fs.mkdtempSync(path.join(dataImportRoot, "staging-test-"));

  try {
    const manifest = runImport({ source, output });
    assert.deepEqual(manifest.validationErrors, []);
    assert.equal(manifest.tables.exercise_catalog.parsedRows, 1);
    assert.equal(manifest.tables.prescription_exercises.skippedRows, 1);
    assert.equal(manifest.tables.prescription_exercises.importedRows, 1);
    assert.match(fs.readFileSync(path.join(output, "01-exercise-catalog.sql"), "utf8"), /0\.75/);
    assert.match(fs.readFileSync(path.join(output, "02-prescriptions.sql"), "utf8"), /Supino d''halteres/);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test("records duplicate session ids as a validation error and does not generate SQL", () => {
  const source = makeSource(sourceFiles([
    "sessao-1,01/08/2026,Supino,1,20,10,2,8,clean",
    "sessao-1,02/08/2026,Supino,1,22,10,2,8,clean",
  ].join("\n")));
  const output = fs.mkdtempSync(path.join(dataImportRoot, "staging-test-"));

  try {
    const manifest = runImport({ source, output });
    assert.equal(manifest.ok, false);
    assert.match(manifest.validationErrors.join("\n"), /id_sessao duplicado: sessao-1/);
    assert.equal(fs.existsSync(path.join(output, "03-executions.sql")), false);
    assert.equal(fs.existsSync(path.join(output, "import-manifest.json")), true);
  } finally {
    fs.rmSync(source, { recursive: true, force: true });
    fs.rmSync(output, { recursive: true, force: true });
  }
});
