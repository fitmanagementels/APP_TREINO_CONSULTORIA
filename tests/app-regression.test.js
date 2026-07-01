const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "app", "Código.gs"), "utf8");
const index = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
const docsViewer = fs.readFileSync(path.join(root, "docs", "index.html"), "utf8");

function bodyOf(source, name) {
  const match = new RegExp(`(?:function\\s+${name}|^\\s*${name})\\s*\\(`, "m").exec(
    source,
  );
  assert.ok(match, `${name} should exist`);
  const start = match.index;
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Could not read body for ${name}`);
}

const tests = [
  [
    "initial load should unblock from essential data only",
    () => {
      const body = bodyOf(script, "fetchInitialData");
      assert.match(body, /const\s+totalRequests\s*=\s*2\b/);
      assert.doesNotMatch(body, /clientGetGestaoCarga\(\)/);
    },
  ],
  [
    "setupDatabase should match the current DB_Prescricao sheet schema",
    () => {
      assert.match(code, /PRESCRICAO_HEADERS\s*=\s*\[/);
      assert.match(code, /"id_ficha"[\s\S]*"id_treino"[\s\S]*"id_exercicio"/);
      const body = bodyOf(code, "setupDatabase");
      assert.match(body, /MANAGED_SHEETS/);
    },
  ],
  [
    "setupDatabase should be non-destructive and only manage approved database tabs",
    () => {
      const body = bodyOf(code, "setupDatabase");
      assert.doesNotMatch(body, /\.clear\s*\(/);
      assert.doesNotMatch(body, /createFormattedSheet\s*\(/);
      assert.match(code, /MANAGED_SHEETS/);
      assert.match(code, /ensureManagedSheet\s*\(/);
      assert.match(code, /ensureHeaders\s*\(/);
      assert.match(code, /DB_MemoriaBase/);
      assert.match(code, /DB_MemoriaExercicio/);
      assert.match(code, /DB_Insights/);
    },
  ],
  [
    "DB_GestaoCarga should keep a rich session-summary cache schema for the app",
    () => {
      assert.match(code, /GESTAO_CARGA_HEADERS\s*=\s*\[/);
      assert.match(code, /"id_resumo_sessao"[\s\S]*"id_sessao_grupo"[\s\S]*"data_sessao"/);
      assert.match(code, /"id_ficha"[\s\S]*"id_treino"[\s\S]*"total_exercicios"/);
      assert.match(code, /"volume_total"[\s\S]*"rpe_medio"[\s\S]*"exercicio_principal"/);
      assert.match(code, /"melhor_e1rm_sessao"[\s\S]*"maior_carga_sessao"[\s\S]*"updated_at"/);
    },
  ],
  [
    "memory and insight tabs should have structured schemas for hybrid AI reports",
    () => {
      assert.match(code, /MEMORIA_BASE_HEADERS\s*=\s*\[/);
      assert.match(code, /"id_snapshot"[\s\S]*"tipo_relatorio"[\s\S]*"filtro_tempo"/);
      assert.match(code, /"recordes_json"[\s\S]*"quedas_json"[\s\S]*"estagnacoes_json"/);
      assert.match(code, /MEMORIA_EXERCICIO_HEADERS\s*=\s*\[/);
      assert.match(code, /"id_exercicio"[\s\S]*"tendencia"[\s\S]*"status_alerta"/);
      assert.match(code, /INSIGHTS_HEADERS\s*=\s*\[/);
      assert.match(code, /"prompt_resumo_json"[\s\S]*"resposta_ia"[\s\S]*"status"/);
    },
  ],
  [
    "loading carga should not write DB_GestaoCarga as part of app boot",
    () => {
      const body = bodyOf(code, "clientGetGestaoCarga");
      assert.doesNotMatch(body, /updateGestaoCargaSheet|getGestaoCargaData\(\)/);
    },
  ],
  [
    "session ids should include ficha and treino to avoid collisions",
    () => {
      const body = bodyOf(script, "genSessionId");
      assert.match(body, /id_ficha/);
      assert.match(body, /id_treino/);
    },
  ],
  [
    "saving execution should build session id from selected ficha and treino",
    () => {
      const body = bodyOf(script, "saveExecution");
      assert.doesNotMatch(body, /prescricaoCache\[idx\]/);
      assert.match(body, /id_ficha:\s*this\.selectedFicha/);
      assert.match(body, /id_treino:\s*this\.selectedTreino/);
    },
  ],
  [
    "changing session RPE should mark affected rows pending for resync",
    () => {
      const body = bodyOf(script, "confirmSessionRPE");
      assert.match(body, /sync_status\s*=\s*"pending"/);
    },
  ],
  [
    "index should include an inline loader fallback before script include",
    () => {
      const fallbackIndex = index.indexOf("window.__xsReleaseLoader");
      const includeIndex = index.indexOf("include('script')");
      assert.ok(fallbackIndex > -1, "fallback should exist");
      assert.ok(includeIndex > -1, "script include should exist");
      assert.ok(fallbackIndex < includeIndex, "fallback should run before app script");
      assert.match(index, /boot timeout/);
      assert.match(index, /Modo seguro ativo/);
    },
  ],
  [
    "app init should run when DOMContentLoaded has already fired",
    () => {
      assert.match(script, /document\.readyState\s*===\s*"loading"/);
      assert.match(script, /App\.init\(\)/);
    },
  ],
  [
    "app init should mark boot as started before async data loading",
    () => {
      const body = bodyOf(script, "init");
      assert.match(body, /window\.__xsAppBootStarted\s*=\s*true/);
      assert.match(body, /this\.fetchInitialData\(\)/);
    },
  ],
  [
    "app should provide a fetch fallback for Apps Script data access",
    () => {
      assert.match(script, /fetchServerAction\s*\(/);
      assert.match(script, /callServer\s*\(/);
      assert.match(script, /actionUrl\.searchParams\.set\("action", action\)/);
    },
  ],
  [
    "initial data loading should use transport fallback before local cache fallback",
    () => {
      const body = bodyOf(script, "fetchInitialData");
      assert.match(body, /this\.callServer\("getPrescricao", "clientGetPrescricao"\)/);
      assert.match(body, /this\.callServer\("getHistorico", "clientGetHistorico"\)/);
      assert.match(body, /setTimeout\(finishWithCache,\s*12000\)/);
    },
  ],
  [
    "boot fallback should not force safe mode while app boot is in progress",
    () => {
      assert.match(index, /window\.__xsAppBootStarted\s*=\s*false/);
      assert.match(index, /window\.__xsLastBootError\s*=\s*""/);
      assert.match(
        index,
        /if\s*\(!window\.__xsAppBootStarted\)\s*{\s*setLoaderStatus\("Tempo excedido\. Abrindo modo seguro\.\.\."\);[\s\S]*releaseLoader\(/,
      );
      assert.match(index, /window\.__xsLastBootError/);
    },
  ],
  [
    "index should avoid multiline inline handlers that can break Apps Script rendering",
    () => {
      assert.doesNotMatch(index, /onchange="\s*document\.getElementById\('ficha-filter'\)/);
      assert.doesNotMatch(index, /onclick="\s*document\.getElementById\('history-modal'\)\.classList\.remove\('show'\)/);
      assert.doesNotMatch(index, /onclick="\s*document\s*\.getElementById\('chart-settings-modal'\)/);
      assert.match(script, /bindInlineControls\s*\(/);
    },
  ],
  [
    "chart rendering should avoid template literal SVG strings that break published parsing",
    () => {
      const barBody = bodyOf(script, "drawBarChart");
      const progBody = bodyOf(script, "drawProgressionChart");
      assert.doesNotMatch(barBody, /`<svg|`<line|`<text|`<rect/);
      assert.doesNotMatch(progBody, /`<svg|`<line|`<text|`<polyline|`<circle/);
    },
  ],
  [
    "docs viewer should start with all collapsible sections closed",
    () => {
      const body = bodyOf(docsViewer, "renderReader");
      assert.doesNotMatch(body, /index\s*===\s*0/);
    },
  ],
  [
    "docs viewer should preserve manual open sections and auto-open search matches",
    () => {
      assert.match(docsViewer, /openSectionsByDoc/);
      assert.match(docsViewer, /function\s+getOpenSectionsForDoc\s*\(/);
      const body = bodyOf(docsViewer, "renderReader");
      assert.match(body, /const\s+docOpenSections\s*=\s*getOpenSectionsForDoc\(doc\.id\)/);
      assert.match(body, /state\.query\s*\?\s*" open"\s*:\s*docOpenSections\.has\(section\.id\)\s*\?\s*" open"\s*:\s*""/);
      assert.match(body, /addEventListener\("toggle"/);
    },
  ],
];

let failed = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(error.message);
  }
}

if (failed > 0) process.exit(1);
