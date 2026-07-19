const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const code = read(path.join("app", "Código.gs"));
const index = read(path.join("app", "index.html"));
const script = read(path.join("app", "script.html"));
const docsViewer = read(path.join("docs", "knowledge hub.html"));

function bodyOf(source, name) {
  const match = new RegExp("function\\s+" + name + "\\s*\\(").exec(source);
  assert.ok(match, name + " should exist");
  const start = source.indexOf("{", match.index);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(start + 1, i);
  }
  throw new Error("Could not read " + name);
}

const tests = [
  ["tenant backend exposes the V2 active-ficha contract", () => {
    ["getTenantBootstrap", "getVisibleFichas", "getActiveFicha", "getTreinoSessionBootstrap", "syncTenantSession", "calculateBrzyckiE1rm"].forEach((name) => assert.match(code, new RegExp("function\\s+" + name + "\\s*\\(")));
    ["DB_Fichas", "DB_Catalogo_Exercicios", "DB_Prescricao_Substitutos", "DB_Referencia_Exercicio"].forEach((sheet) => assert.match(code, new RegExp(sheet)));
  }],
  ["student routes do not allow prescription editing", () => {
    const routes = bodyOf(code, "routeAction");
    ["getTenantBootstrap", "getTreinoSession", "syncTenantSession", "getVisibleFichas", "getProgressData"].forEach((action) => assert.match(routes, new RegExp(action)));
    assert.doesNotMatch(routes, /getPrescriptionEditorData|savePrescricaoTreino/);
  }],
  ["student navigation has only the four approved areas", () => {
    ["Treino", "Fichas", "Histórico", "Progresso"].forEach((label) => assert.match(index, new RegExp(label)));
    assert.doesNotMatch(index, />Prescrever</);
    assert.doesNotMatch(index, />Carga</);
  }],
  ["session draft is local and requires resume or discard", () => {
    ["saveSessionDraft", "restorePendingSession", "discardPendingSession", "showResumeDecision"].forEach((name) => assert.match(script, new RegExp(name + "\\s*[(:]")));
    assert.match(script, /localStorage/);
    assert.match(script, /Retomar/);
    assert.match(script, /Descartar/);
  }],
  ["session supports substitutes, omissions and extras without editing the fiche", () => {
    ["openSubstituteModal", "applySubstitute", "removeFromSession", "addExtraExercise"].forEach((name) => assert.match(script, new RegExp(name + "\\s*[(:]")));
    assert.match(script, /substituto/);
    assert.match(script, /Não realizado/);
    assert.match(script, /Extra/);
  }],
  ["RIR is optional and PSE is mandatory", () => {
    assert.match(script, /"6\+"/);
    assert.match(script, /RIR/);
    assert.match(script, /PSE/);
    assert.match(script, /pse.*obrigat/i);
  }],
  ["progression uses RIR-adjusted Brzycki only with valid RIR", () => {
    const calculation = bodyOf(code, "calculateBrzyckiE1rm");
    assert.match(calculation, /1\.0278/);
    assert.match(calculation, /0\.0278/);
    assert.match(calculation, /rir/);
    assert.match(calculation, /6\+/);
  }],
  ["frontend remains conservative for Apps Script webviews", () => {
    assert.doesNotMatch(script, /\?\.|=>|\bconst\b|\blet\b|`/);
    assert.doesNotMatch(code, /,\s*[\]\})]/);
  }],
  ["knowledge hub retains portable project status", () => {
    ["Status atual", "Próxima ação", "Contexto para outro chat ou IA"].forEach((label) => assert.match(docsViewer, new RegExp(label)));
  }]
];

let failed = 0;
tests.forEach(([name, run]) => {
  try { run(); console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name); console.error(error.message); }
});
if (failed) process.exit(1);
