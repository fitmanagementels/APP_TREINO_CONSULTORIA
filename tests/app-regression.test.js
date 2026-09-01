const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "app", "Código.gs"), "utf8");
const index = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
const style = fs.readFileSync(path.join(root, "app", "style.html"), "utf8");
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
    "Código.gs should avoid trailing commas that can break Apps Script parsing",
    () => {
      assert.doesNotMatch(code, /,\s*[\]\}\)]/);
    },
  ],
  [
    "frontend HTML scripts should avoid trailing commas that can break Apps Script document.write",
    () => {
      assert.doesNotMatch(script, /,\s*[\]\}\)]/);
      assert.doesNotMatch(index, /,\s*[\]\}\)]/);
    },
  ],
  [
    "frontend script should avoid modern operators that break older Apps Script webviews",
    () => {
      assert.doesNotMatch(script, /\.\.\.\s*[A-Za-z_$({\[]/);
      assert.doesNotMatch(script, /\?\./);
    },
  ],
  [
    "frontend script should use conservative syntax for Apps Script HtmlService",
    () => {
      assert.doesNotMatch(script, /\bconst\b/);
      assert.doesNotMatch(script, /\blet\b/);
      assert.doesNotMatch(script, /=>/);
      assert.doesNotMatch(script, /`/);
      assert.doesNotMatch(script, /\bnew\s+Set\s*\(/);
      assert.doesNotMatch(script, /\bArray\.from\s*\(/);
      assert.doesNotMatch(script, /\bObject\.values\s*\(/);
      assert.doesNotMatch(script, /\bObject\.assign\s*\(/);
      assert.doesNotMatch(script, /\brequestAnimationFrame\s*\(/);
    },
  ],
  [
    "frontend script should avoid fragile WebView APIs when simple fallbacks exist",
    () => {
      assert.doesNotMatch(script, /querySelectorAll\([^)]+\)\.forEach/);
      assert.doesNotMatch(script, /\.dataset\./);
      assert.doesNotMatch(script, /\bnew\s+URL\s*\(/);
    },
  ],
  [
    "exercise accordion should avoid layout-heavy grid row animation",
    () => {
      assert.doesNotMatch(style, /\.ex-body-wrapper\s*{[\s\S]*?grid-template-rows/);
      assert.doesNotMatch(style, /\.rx-body-wrapper\s*{[\s\S]*?grid-template-rows/);
      assert.doesNotMatch(style, /transition:\s*grid-template-rows/);
      assert.match(style, /will-change:\s*opacity,\s*transform/);
      assert.match(style, /transform-origin:\s*top/);
      assert.match(style, /scaleY\(0\.98\)/);
    },
  ],
  [
    "backend should target the provided spreadsheet explicitly before falling back to active spreadsheet",
    () => {
      assert.match(code, /DEFAULT_SPREADSHEET_ID\s*=\s*"1x4tHTYIr4GKuBqyW_SnoUsQaC9U1PeIgsKdXrXaztG8"/);
      assert.match(code, /function\s+getSpreadsheet\s*\(/);
      const body = bodyOf(code, "getSpreadsheet");
      assert.match(body, /PropertiesService\.getScriptProperties\(\)\.getProperty\("SPREADSHEET_ID"\)/);
      assert.match(body, /SpreadsheetApp\.openById\(spreadsheetId\)/);
      assert.match(body, /SpreadsheetApp\.getActiveSpreadsheet\(\)/);
      assert.match(body, /spreadsheetErrors/);
      assert.match(body, /catch\s*\(err\)/);
      assert.ok(
        body.indexOf("SpreadsheetApp.openById(spreadsheetId)") <
          body.indexOf("SpreadsheetApp.getActiveSpreadsheet()"),
        "active spreadsheet should be tried after explicit ids fail"
      );
      assert.doesNotMatch(bodyOf(code, "getPrescricaoData"), /SpreadsheetApp\.getActiveSpreadsheet\(\)/);
      assert.doesNotMatch(bodyOf(code, "getExecucaoData"), /SpreadsheetApp\.getActiveSpreadsheet\(\)/);
      assert.doesNotMatch(bodyOf(code, "syncExecucaoData"), /SpreadsheetApp\.getActiveSpreadsheet\(\)/);
      assert.doesNotMatch(bodyOf(code, "setupDatabase"), /SpreadsheetApp\.getActiveSpreadsheet\(\)/);
    },
  ],
  [
    "backend should expose one boot payload independent from hybrid AI caches",
    () => {
      assert.match(code, /function\s+getInitialAppData\s*\(/);
      assert.match(code, /function\s+getInitialAppDataJson\s*\(/);
      assert.match(code, /function\s+clientGetInitialData\s*\(/);
      assert.match(code, /case\s+"getInitialData"/);
      const body = bodyOf(code, "getInitialAppData");
      assert.match(body, /getPrescricaoData\(\)/);
      assert.match(body, /getExecucaoData\(\)/);
      assert.doesNotMatch(body, /getGestaoCargaData/);
      assert.doesNotMatch(body, /DB_Memoria/);
      assert.doesNotMatch(body, /DB_Insights/);
    },
  ],
  [
    "backend should expose app status diagnostics for spreadsheet reads",
    () => {
      assert.match(code, /function\s+getAppStatus\s*\(/);
      assert.match(code, /case\s+"getAppStatus"/);
      assert.match(code, /function\s+clientGetAppStatus\s*\(/);
      const body = bodyOf(code, "getAppStatus");
      assert.match(body, /spreadsheetId/);
      assert.match(body, /DB_Prescricao/);
      assert.match(body, /missingHeaders/);
      assert.match(body, /dataRows/);
    },
  ],
  [
    "prescricao rows should be normalized so sheet whitespace does not break filters",
    () => {
      const body = bodyOf(code, "getPrescricaoData");
      assert.match(body, /cleanText\(/);
      assert.match(body, /id_ficha:\s*cleanText/);
      assert.match(body, /id_treino:\s*cleanText/);
      assert.match(body, /id_exercicio:\s*cleanText/);
    },
  ],
  [
    "frontend should request diagnostics and warn when prescricao is empty",
    () => {
      assert.match(script, /appStatus:\s*null/);
      assert.match(index, /window\.__XS_BOOTSTRAP__/);
      assert.match(index, /window\.__XS_BOOTSTRAP__\s*=\s*null/);
      const body = bodyOf(script, "applyInitialData");
      assert.match(body, /Prescrição vazia/);
      assert.match(body, /showDataWarning\(/);
    },
  ],
  [
    "initial load should unblock from essential data only",
    () => {
      const body = bodyOf(script, "fetchInitialData");
      assert.match(body, /this\.readInitialData\(\)/);
      assert.doesNotMatch(body, /clientGetGestaoCarga\(\)/);
      assert.doesNotMatch(body, /loadAppStatusInBackground\(\)/);
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
    "prescription editor should read Demanda_Muscular as a manual catalog",
    () => {
      assert.match(code, /DEMANDA_MUSCULAR_SHEET\s*=\s*"Demanda_Muscular"/);
      assert.match(code, /function\s+getDemandaMuscularData\s*\(/);
      assert.match(code, /function\s+parseDemandValue\s*\(/);
      const body = bodyOf(code, "getDemandaMuscularData");
      assert.match(body, /getDisplayValues\(\)/);
      assert.match(body, /musculos/);
      assert.match(body, /demandas/);
      assert.match(body, /parseDemandValue/);
      assert.doesNotMatch(bodyOf(code, "setupDatabase"), /Demanda_Muscular/);
      assert.doesNotMatch(/MANAGED_SHEETS[\s\S]*?};/.exec(code)[0], /Demanda_Muscular/);
    },
  ],
  [
    "backend should expose a prescription editor payload without hybrid AI caches",
    () => {
      assert.match(code, /function\s+getPrescriptionEditorData\s*\(/);
      assert.match(code, /function\s+clientGetPrescriptionEditorData\s*\(/);
      assert.match(code, /case\s+"getPrescriptionEditorData"/);
      const body = bodyOf(code, "getPrescriptionEditorData");
      assert.match(body, /getDemandaMuscularData\(\)/);
      assert.match(body, /getPrescricaoData\(\)/);
      assert.match(body, /treinosPorFicha/);
      assert.doesNotMatch(body, /getGestaoCargaData/);
      assert.doesNotMatch(body, /DB_Memoria/);
      assert.doesNotMatch(body, /DB_Insights/);
    },
  ],
  [
    "saving a prescribed treino should replace only the selected ficha and treino",
    () => {
      assert.match(code, /function\s+savePrescricaoTreino\s*\(/);
      assert.match(code, /function\s+clientSavePrescricaoTreino\s*\(/);
      assert.match(code, /case\s+"savePrescricaoTreino"/);
      const body = bodyOf(code, "savePrescricaoTreino");
      assert.match(body, /LockService\.getScriptLock\(\)/);
      assert.match(body, /id_ficha/);
      assert.match(body, /id_treino/);
      assert.match(body, /getDemandaMuscularData\(\)/);
      assert.match(body, /deleteRow/);
      assert.match(body, /setNumberFormat\("@"/);
      assert.doesNotMatch(body, /DB_Memoria/);
      assert.doesNotMatch(body, /DB_Insights/);
    },
  ],
  [
    "frontend should include a Prescrever tab and editor screen",
    () => {
      assert.match(index, /id="screen-prescrever"/);
      assert.match(index, /data-screen="prescrever"[\s\S]*Prescrever/);
      assert.match(index, /id="prescrever-add-exercise-btn"/);
      assert.match(index, /id="prescrever-sync-catalog-btn"/);
      assert.match(index, /id="prescrever-catalog-sync-status"/);
      assert.match(index, /id="prescrever-catalog-modal"/);
      assert.match(index, /id="prescrever-search"/);
      assert.match(index, /id="prescrever-grupo"/);
      assert.doesNotMatch(index, /id="prescrever-tipo"/);
      assert.match(script, /catalogoCache:\s*\[\]/);
      assert.match(script, /prescreverDraft/);
      assert.match(script, /loadPrescrever\s*:/);
      assert.match(script, /loadCatalogSyncStatus\s*:/);
      assert.match(script, /syncCatalogFromReference\s*:/);
      assert.match(script, /renderPrescrever\s*:/);
      assert.match(script, /openAddExerciseModal\s*:/);
      assert.match(script, /closeAddExerciseModal\s*:/);
      assert.match(script, /openExerciseSelectModal\s*:/);
      assert.match(script, /catalogTargetIndex/);
      const body = bodyOf(script, "switchScreen");
      assert.match(body, /screenId === "prescrever"/);
    },
  ],
  [
    "prescrever catalog should render only inside the add-exercise modal",
    () => {
      const screenStart = index.indexOf('id="screen-prescrever"');
      const modalStart = index.indexOf('id="prescrever-catalog-modal"');
      const catalogList = index.indexOf('id="prescrever-catalog-list"');
      assert.ok(screenStart > -1, "Prescrever screen should exist");
      assert.ok(modalStart > -1, "Catalog modal should exist");
      assert.ok(catalogList > modalStart, "Catalog list should live inside the modal");
      assert.match(script, /renderPrescreverCatalog/);
      const addBody = bodyOf(script, "addCatalogExercise");
      assert.match(addBody, /push\(/);
      assert.match(addBody, /catalogTargetIndex/);
      assert.match(addBody, /renderPrescrever\(\)/);
      assert.match(addBody, /closeAddExerciseModal\(\)/);
    },
  ],
  [
    "prescrever demand blocks should open a complete demand detail modal",
    () => {
      assert.match(index, /id="prescrever-demand-modal"/);
      assert.match(index, /id="prescrever-demand-table"/);
      assert.match(index, /id="prescrever-demand-detail"/);
      assert.match(script, /openDemandModal\s*:/);
      assert.match(script, /renderDemandModal\s*:/);
      assert.match(script, /selectDemandMuscle\s*:/);
      assert.match(script, /calculateDemandDetails\s*:/);
      const body = bodyOf(script, "renderPrescreverDemandSummary");
      assert.match(body, /openDemandModal\(\\'sessao\\'\)/);
      assert.match(body, /openDemandModal\(\\'ficha\\'\)/);
    },
  ],
  [
    "prescrever exercise cards should change exercise through catalog popup",
    () => {
      const body = bodyOf(script, "renderPrescreverEditorList");
      assert.match(body, /openExerciseSelectModal\(/);
      assert.match(body, /exercise-select/);
      const modalBody = bodyOf(script, "openExerciseSelectModal");
      assert.match(modalBody, /catalogTargetIndex\s*=\s*index/);
      assert.match(modalBody, /renderPrescreverCatalog\(\)/);
    },
  ],
  [
    "frontend editor should save ciclos to existing semana fields",
    () => {
      assert.match(script, /getPrescriptionEditorData/);
      assert.match(script, /savePrescricaoTreino/);
      assert.match(script, /Ciclo 1/);
      assert.match(script, /semana_1_sets/);
      assert.match(script, /semana_4_descanso/);
      assert.match(script, /calculateDemandSummary\s*:/);
      assert.match(script, /savePrescricaoTreino\s*:/);
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
    "treino should dispatch between start and active server session states",
    () => {
      const renderBody = bodyOf(script, "renderTreino");
      assert.match(renderBody, /this\.activeTrainingSession/);
      assert.match(renderBody, /this\.renderActiveTrainingSession\(\)/);
      assert.match(renderBody, /this\.renderTrainingStart\(\)/);
      const startBody = bodyOf(script, "startTrainingSession");
      assert.match(startBody, /navigator\.onLine/);
      assert.match(startBody, /ACTIVE_SESSION_EXISTS/);
      assert.doesNotMatch(startBody, /syncExecucao/);
    },
  ],
  [
    "Cloudflare transport should preserve structured API errors for session recovery",
    () => {
      const body = bodyOf(script, "fetchServerAction");
      assert.match(body, /apiError\.status\s*=\s*response\.status/);
      assert.match(body, /apiError\.code/);
      assert.match(body, /apiError\.details/);
      assert.match(body, /getActiveTrainingSession/);
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
      const includeIndex = index.indexOf('<script src="/app.js"></script>');
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
    "app should use same-origin Cloudflare API routes",
    () => {
      assert.match(script, /fetchServerAction\s*\(/);
      assert.match(script, /callApi\s*\(/);
      assert.match(script, /var SERVER_ROUTES/);
      assert.match(script, /getInitialData:\s*\{ method: "GET", path: "\/api\/bootstrap" \}/);
      assert.match(script, /getPrescriptionEditorData:\s*\{ method: "GET", path: "\/api\/prescription-editor" \}/);
      assert.match(script, /syncExecucao:\s*\{ method: "POST", path: "\/api\/executions\/sync" \}/);
      const body = bodyOf(script, "callApi");
      assert.match(body, /this\.fetchServerAction\(action, payload\)/);
      assert.doesNotMatch(script, /google\.script/);
      assert.doesNotMatch(script, /clientGet/);
    },
  ],
  [
    "initial data loading should consume one boot payload before local cache fallback",
    () => {
      const body = bodyOf(script, "fetchInitialData");
      assert.match(script, /readInitialData\s*\(/);
      assert.match(script, /applyInitialData\s*\(/);
      assert.match(body, /this\.readInitialData\(\)/);
      assert.match(body, /setTimeout\(finishWithCache,\s*12000\)/);
      assert.match(body, /err && err\.message \? " Detalhe: " \+ err\.message : ""/);
    },
  ],
  [
    "Cloudflare transport should return the API data envelope payload",
    () => {
      const body = bodyOf(script, "fetchServerAction");
      assert.match(body, /response\.json\(\)/);
      assert.match(body, /result\.data !== undefined \? result\.data : result/);
      assert.match(body, /result && result\.error/);
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
    "docs viewer should expose the portable project-status sections",
    () => {
      assert.match(docsViewer, /Status atual/);
      assert.match(docsViewer, /Próxima ação/);
      assert.match(docsViewer, /Contexto para outro chat ou IA/);
      assert.match(docsViewer, /<details class="doc-section"/);
    },
  ],
  [
    "docs viewer should keep detailed status sections collapsed by default",
    () => {
      assert.doesNotMatch(docsViewer, /<details class="doc-section" open>/);
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
