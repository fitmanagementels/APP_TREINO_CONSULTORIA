// =====================================================================
// Code.gs — XSTeam Wellness V2.0 | Single-Tenant
// DB_Prescricao: id_ficha|id_treino|id_exercicio|observacoes|ordem_exercicio
//   semana_1_* ate semana_4_*
// =====================================================================
// Cada instância recebe seu próprio ID em Script Properties (SPREADSHEET_ID).
// Nunca mantenha aqui o ID de outra planilha/aluno.
var DEFAULT_SPREADSHEET_ID = "";
var DEMANDA_MUSCULAR_SHEET = "Demanda_Muscular";

var PRESCRICAO_HEADERS = [
  "id_ficha",
  "id_treino",
  "id_exercicio",
  "observacoes",
  "ordem_exercicio",
  "semana_1_sets",
  "semana_1_reps",
  "semana_1_descanso",
  "semana_2_sets",
  "semana_2_reps",
  "semana_2_descanso",
  "semana_3_sets",
  "semana_3_reps",
  "semana_3_descanso",
  "semana_4_sets",
  "semana_4_reps",
  "semana_4_descanso"];

var EXECUCAO_HEADERS = [
  "id_sessao",
  "data_treino",
  "id_exercicio",
  "semana_referencia",
  "carga_absoluta",
  "reps_executadas",
  "rir",
  "rpe_sessao",
  "sync_status"];

var GESTAO_CARGA_HEADERS = [
  "id_resumo_sessao",
  "id_sessao_grupo",
  "data_sessao",
  "id_ficha",
  "id_treino",
  "total_exercicios",
  "total_series",
  "volume_total",
  "rpe_medio",
  "exercicio_principal",
  "melhor_e1rm_sessao",
  "maior_carga_sessao",
  "duracao_estimada_min",
  "origem_dados",
  "updated_at"];

var MEMORIA_BASE_HEADERS = [
  "id_snapshot",
  "tipo_relatorio",
  "filtro_tempo",
  "data_inicio",
  "data_fim",
  "periodo_referencia_inicio",
  "periodo_referencia_fim",
  "total_sessoes",
  "total_exercicios",
  "volume_total",
  "rpe_medio",
  "carga_media_sessao",
  "variacao_volume_percentual",
  "variacao_rpe_percentual",
  "variacao_frequencia_percentual",
  "recordes_json",
  "quedas_json",
  "estagnacoes_json",
  "alertas_json",
  "top_exercicios_json",
  "comparacao_periodo_json",
  "resumo_contexto_json",
  "created_at",
  "updated_at"];

var MEMORIA_EXERCICIO_HEADERS = [
  "id_snapshot",
  "id_exercicio",
  "nome_exercicio",
  "sessoes_consideradas",
  "volume_total",
  "rpe_medio",
  "melhor_carga",
  "melhor_e1rm",
  "media_reps",
  "variacao_carga_percentual",
  "variacao_e1rm_percentual",
  "variacao_volume_percentual",
  "tendencia",
  "status_alerta",
  "resumo_exercicio_json",
  "updated_at"];

var INSIGHTS_HEADERS = [
  "id_insight",
  "id_snapshot",
  "tipo_relatorio",
  "filtro_tempo",
  "data_inicio",
  "data_fim",
  "modelo",
  "versao_prompt",
  "prompt_resumo_json",
  "resposta_ia",
  "resposta_curta",
  "status",
  "created_at"];

var MANAGED_SHEETS = {
  DB_Prescricao: PRESCRICAO_HEADERS,
  DB_Execucao: EXECUCAO_HEADERS,
  DB_GestaoCarga: GESTAO_CARGA_HEADERS,
  DB_MemoriaBase: MEMORIA_BASE_HEADERS,
  DB_MemoriaExercicio: MEMORIA_EXERCICIO_HEADERS,
  DB_Insights: INSIGHTS_HEADERS};

function doGet(e) {
  var p = e ? e.parameter : {};
  if (p.action) {
    return ContentService.createTextOutput(
      JSON.stringify(routeAction(p))).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("XSTeam Wellness V2.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag(
      "viewport",
      "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no");
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    return ContentService.createTextOutput(
      JSON.stringify(routeAction(p))).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function include(f) {
  return HtmlService.createHtmlOutputFromFile(f).getContent();
}

function routeAction(p) {
  try {
    p = p || {};
    switch (p.action) {
      case "getTenantBootstrap":
        return { success: true, data: getTenantBootstrap() };
      case "getVisibleFichas":
        return { success: true, data: getVisibleFichas() };
      case "getActiveFicha":
        return { success: true, data: getActiveFicha() };
      case "getTreinoSession":
        return { success: true, data: getTreinoSessionBootstrap(p.payload || p) };
      case "syncTenantSession":
        return syncTenantSession(p.payload || p);
      case "getHistorico":
        return { success: true, data: getTenantHistorico() };
      case "getProgressData":
        return { success: true, data: getProgressData(p.payload || p) };
      case "setupDatabase":
        setupDatabase();
        return { success: true };
      default:
        return { success: false, error: "Ação desconhecida: " + p.action };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getInitialAppData() {
  var result = {
    success: true,
    prescricao: { rows: [] },
    historico: { rows: [] },
    status: {
      prescricaoRows: 0,
      historicoRows: 0,
      prescricaoSheet: "DB_Prescricao",
      execucaoSheet: "DB_Execucao"},
    errors: [],
    error: "",
    updatedAt: new Date().toISOString()};

  try {
    var prescricao = getPrescricaoData();
    result.prescricao =
      prescricao && prescricao.rows ? prescricao : { rows: [] };
    result.status.prescricaoRows = result.prescricao.rows.length;
  } catch (err) {
    result.success = false;
    result.errors.push("prescricao: " + err.message);
  }

  try {
    var historico = getExecucaoData();
    result.historico = historico && historico.rows ? historico : { rows: [] };
    result.status.historicoRows = result.historico.rows.length;
  } catch (err) {
    result.errors.push("historico: " + err.message);
  }

  if (result.errors.length > 0) result.error = result.errors.join(" | ");
  return result;
}

function getInitialAppDataJson() {
  return JSON.stringify(getInitialAppData()).replace(/</g, "\\u003c");
}

function getSpreadsheet() {
  var spreadsheetIds = [];
  var spreadsheetErrors = [];
  var propertyId = "";

  try {
    propertyId = cleanText(
      PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID"));
  } catch (err) {
    spreadsheetErrors.push("ScriptProperties: " + err.message);
  }

  if (propertyId) spreadsheetIds.push(propertyId);
  if (
    DEFAULT_SPREADSHEET_ID &&
    spreadsheetIds.indexOf(DEFAULT_SPREADSHEET_ID) === -1
  ) {
    spreadsheetIds.push(DEFAULT_SPREADSHEET_ID);
  }

  for (var i = 0; i < spreadsheetIds.length; i++) {
    var spreadsheetId = spreadsheetIds[i];
    try {
      return SpreadsheetApp.openById(spreadsheetId);
    } catch (err) {
      spreadsheetErrors.push(spreadsheetId + ": " + err.message);
    }
  }

  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {
    spreadsheetErrors.push("active: " + err.message);
  }

  throw new Error(
    "Planilha base nao acessivel. Defina SPREADSHEET_ID ou vincule o script a planilha. " +
      spreadsheetErrors.join(" | "));
}

function getAppStatus() {
  var ss = getSpreadsheet();
  var status = {
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheets: {},
    updatedAt: new Date().toISOString()};

  Object.keys(MANAGED_SHEETS).forEach(function (sheetName) {
    status.sheets[sheetName] = getSheetStatus(
      ss,
      sheetName,
      MANAGED_SHEETS[sheetName]);
  });
  status.prescricao = status.sheets.DB_Prescricao;
  status.prescricaoMissingHeaders = status.prescricao.missingHeaders;
  status.prescricaoDataRows = status.prescricao.dataRows;

  return status;
}

function getSheetStatus(ss, sheetName, expectedHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      exists: false,
      dataRows: 0,
      lastRow: 0,
      lastColumn: 0,
      headers: [],
      missingHeaders: expectedHeaders.slice()};
  }

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var headers =
    lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(cleanText)
      : [];
  var lowerHeaders = headers.map(function (h) {
    return h.toLowerCase();
  });
  var missingHeaders = expectedHeaders.filter(function (header) {
    return lowerHeaders.indexOf(String(header).toLowerCase()) === -1;
  });

  return {
    exists: true,
    dataRows: Math.max(lastRow - 1, 0),
    lastRow: lastRow,
    lastColumn: lastColumn,
    headers: headers,
    missingHeaders: missingHeaders};
}

function getDemandaMuscularData() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(DEMANDA_MUSCULAR_SHEET);
  if (!sheet) return { rows: [], grupos: [], tipos: [], musculos: [] };
  var data = sheet.getDataRange().getDisplayValues();
  if (data.length < 2) return { rows: [], grupos: [], tipos: [], musculos: [] };
  var headers = data[0].map(cleanText);
  var musculos = [];
  for (var m = 3; m < headers.length && m <= 15; m++) {
    if (headers[m]) musculos.push(headers[m]);
  }

  var rows = [];
  var grupos = [];
  var tipos = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var nome = cleanText(r[0]);
    if (!nome) continue;
    var grupo = cleanText(r[1]);
    var tipo = cleanText(r[2]);
    var demandas = {};
    for (var j = 0; j < musculos.length; j++) {
      demandas[musculos[j]] = parseDemandValue(r[j + 3]);
    }
    xsUniquePushServer(grupos, grupo);
    xsUniquePushServer(tipos, tipo);
    rows.push({
      nome: nome,
      id_exercicio: nome,
      grupo_principal: grupo,
      tipo: tipo,
      demandas: demandas});
  }

  return {
    rows: rows,
    grupos: grupos.sort(),
    tipos: tipos.sort(),
    musculos: musculos};
}

function getPrescriptionEditorData() {
  var catalogo = getDemandaMuscularData();
  var prescricao = getPrescricaoData();
  var fichas = [];
  var treinosPorFicha = {};

  prescricao.rows.forEach(function (row) {
    xsUniquePushServer(fichas, row.id_ficha);
    if (!treinosPorFicha[row.id_ficha]) treinosPorFicha[row.id_ficha] = [];
    xsUniquePushServer(treinosPorFicha[row.id_ficha], row.id_treino);
  });

  return {
    catalogo: catalogo,
    prescricao: prescricao,
    fichas: fichas.sort(),
    treinosPorFicha: treinosPorFicha,
    updatedAt: new Date().toISOString()};
}

function savePrescricaoTreino(payload) {
  payload = payload || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var idFicha = cleanText(payload.id_ficha);
    var idTreino = cleanText(payload.id_treino);
    var exercicios = payload.exercicios || [];
    if (!idFicha) return { success: false, error: "Ficha obrigatoria." };
    if (!idTreino) return { success: false, error: "Treino obrigatorio." };
    if (!Array.isArray(exercicios))
      return { success: false, error: "Lista de exercicios invalida." };

    var catalogo = getDemandaMuscularData();
    var catalogMap = {};
    catalogo.rows.forEach(function (ex) {
      catalogMap[cleanText(ex.nome).toLowerCase()] = ex;
    });
    for (var e = 0; e < exercicios.length; e++) {
      var nome = cleanText(exercicios[e].id_exercicio || exercicios[e].nome);
      if (!catalogMap[nome.toLowerCase()]) {
        return {
          success: false,
          error: "Exercicio fora do catalogo Demanda_Muscular: " + nome};
      }
    }

    var ss = getSpreadsheet();
    var sheet = ensureManagedSheet(ss, "DB_Prescricao", PRESCRICAO_HEADERS);
    ensureTextFormatForReps(sheet);
    sheet
      .getRange(
        2,
        PRESCRICAO_HEADERS.indexOf("semana_1_reps") + 1,
        Math.max(sheet.getMaxRows() - 1, 1),
        1)
      .setNumberFormat("@");
    var data = sheet.getDataRange().getValues();
    var col = getColumnMap(data);
    for (var i = data.length - 1; i >= 1; i--) {
      var row = data[i];
      if (
        cleanText(getCell(row, col, "id_ficha", 0)) === idFicha &&
        cleanText(getCell(row, col, "id_treino", 1)) === idTreino
      ) {
        sheet.deleteRow(i + 1);
      }
    }

    if (exercicios.length > 0) {
      var values = [];
      for (var x = 0; x < exercicios.length; x++) {
        values.push(buildPrescricaoEditorRow(idFicha, idTreino, exercicios[x], x + 1));
      }
      sheet
        .getRange(sheet.getLastRow() + 1, 1, values.length, PRESCRICAO_HEADERS.length)
        .setValues(values);
      ensureTextFormatForReps(sheet);
    }

    return {
      success: true,
      data: getPrescriptionEditorData()};
  } finally {
    lock.releaseLock();
  }
}

function buildPrescricaoEditorRow(idFicha, idTreino, exercicio, ordem) {
  var valuesByHeader = {
    id_ficha: idFicha,
    id_treino: idTreino,
    id_exercicio: cleanText(exercicio.id_exercicio || exercicio.nome),
    observacoes: cleanText(exercicio.observacoes),
    ordem_exercicio: ordem};
  for (var week = 1; week <= 4; week++) {
    valuesByHeader["semana_" + week + "_sets"] =
      cleanText(getExerciseCycleValue(exercicio, week, "sets"));
    valuesByHeader["semana_" + week + "_reps"] =
      cleanText(getExerciseCycleValue(exercicio, week, "reps"));
    valuesByHeader["semana_" + week + "_descanso"] =
      cleanText(getExerciseCycleValue(exercicio, week, "descanso"));
  }

  return PRESCRICAO_HEADERS.map(function (header) {
    return valuesByHeader[header] !== undefined ? valuesByHeader[header] : "";
  });
}

function getExerciseCycleValue(exercicio, week, field) {
  var key = "semana_" + week + "_" + field;
  if (exercicio[key] !== undefined) return exercicio[key];
  if (exercicio.ciclos && exercicio.ciclos[week - 1]) {
    return exercicio.ciclos[week - 1][field];
  }
  return "";
}

function ensureTextFormatForReps(sheet) {
  var maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  for (var i = 0; i < PRESCRICAO_HEADERS.length; i++) {
    if (PRESCRICAO_HEADERS[i].indexOf("_reps") !== -1) {
      sheet.getRange(2, i + 1, maxRows, 1).setNumberFormat("@");
    }
  }
}

function parseDemandValue(value) {
  var clean = cleanText(value).replace(",", ".");
  var parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function getPrescricaoData() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("DB_Prescricao");
  if (!sheet) return { rows: [] };
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  var col = getColumnMap(data);
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var idEx = cleanText(
      col["id_exercicio"] !== undefined ? r[col["id_exercicio"]] : r[1]);
    if (!idEx) continue;
    rows.push({
      id_ficha: cleanText(
        col["id_ficha"] !== undefined ? r[col["id_ficha"]] : ""),
      id_treino: cleanText(
        col["id_treino"] !== undefined ? r[col["id_treino"]] : r[0]),
      id_exercicio: cleanText(idEx),
      nome_exercicio: idEx,
      observacoes: cleanText(
        col["observacoes"] !== undefined ? r[col["observacoes"]] : r[2]),
      ordem_exercicio:
        col["ordem_exercicio"] !== undefined ? r[col["ordem_exercicio"]] : r[3],
      semana_1_sets:
        col["semana_1_sets"] !== undefined ? r[col["semana_1_sets"]] : r[4],
      semana_1_reps:
        col["semana_1_reps"] !== undefined ? r[col["semana_1_reps"]] : r[5],
      semana_1_descanso:
        col["semana_1_descanso"] !== undefined
          ? r[col["semana_1_descanso"]]
          : r[6],
      semana_2_sets:
        col["semana_2_sets"] !== undefined ? r[col["semana_2_sets"]] : r[7],
      semana_2_reps:
        col["semana_2_reps"] !== undefined ? r[col["semana_2_reps"]] : r[8],
      semana_2_descanso:
        col["semana_2_descanso"] !== undefined
          ? r[col["semana_2_descanso"]]
          : r[9],
      semana_3_sets:
        col["semana_3_sets"] !== undefined ? r[col["semana_3_sets"]] : r[10],
      semana_3_reps:
        col["semana_3_reps"] !== undefined ? r[col["semana_3_reps"]] : r[11],
      semana_3_descanso:
        col["semana_3_descanso"] !== undefined
          ? r[col["semana_3_descanso"]]
          : r[12],
      semana_4_sets:
        col["semana_4_sets"] !== undefined ? r[col["semana_4_sets"]] : r[13],
      semana_4_reps:
        col["semana_4_reps"] !== undefined ? r[col["semana_4_reps"]] : r[14],
      semana_4_descanso:
        col["semana_4_descanso"] !== undefined
          ? r[col["semana_4_descanso"]]
          : r[15]});
  }
  rows.sort(function (a, b) {
    return Number(a.ordem_exercicio) - Number(b.ordem_exercicio);
  });
  return { rows: rows };
}

function getColumnMap(data) {
  if (!data || data.length === 0) return {};
  var headers = data[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var col = {};
  for (var j = 0; j < headers.length; j++) col[headers[j]] = j;
  return col;
}

function getExecucaoData() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("DB_Execucao");
  if (!sheet) return { rows: [] };
  var data = sheet.getDataRange().getValues();
  var col = getColumnMap(data);
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var idSessao = getCell(r, col, "id_sessao", 0);
    if (!idSessao) continue;
    var meta = parseSessionId(idSessao);
    rows.push({
      id_sessao: idSessao,
      data_treino: formatDateValue(getCell(r, col, "data_treino", 1)),
      id_exercicio: getCell(r, col, "id_exercicio", 2),
      semana_referencia: getCell(r, col, "semana_referencia", 3),
      carga_absoluta: parseFloat(getCell(r, col, "carga_absoluta", 4)) || 0,
      reps_executadas: parseInt(getCell(r, col, "reps_executadas", 5), 10) || 0,
      rir: parseFloat(getCell(r, col, "rir", 6)) || 0,
      rpe_sessao: parseFloat(getCell(r, col, "rpe_sessao", 7)) || 0,
      sync_status: getCell(r, col, "sync_status", 8),
      id_ficha: meta.id_ficha,
      id_treino: meta.id_treino});
  }
  return { rows: rows };
}

function getGestaoCargaData(options) {
  options = options || {};
  var ss = getSpreadsheet();
  var sheetExec = ss.getSheetByName("DB_Execucao");
  var sheetRx = ss.getSheetByName("DB_Prescricao");
  if (!sheetExec) return { sessoes: [], exercicios: [] };

  var execData = sheetExec.getDataRange().getValues();
  var execCol = getColumnMap(execData);
  var rxMap = buildExerciseNameMap(sheetRx);
  var sessoesByGroup = {};
  var exercicioSet = {};

  for (var i = 1; i < execData.length; i++) {
    var r = execData[i];
    var idSessao = getCell(r, execCol, "id_sessao", 0);
    if (!idSessao) continue;

    var meta = parseSessionId(idSessao);
    var dateStr = formatDateValue(getCell(r, execCol, "data_treino", 1));
    var idEx = String(
      getCell(r, execCol, "id_exercicio", 2) || meta.id_exercicio || "");
    if (!idEx) continue;

    var carga = parseFloat(getCell(r, execCol, "carga_absoluta", 4)) || 0;
    var reps = parseInt(getCell(r, execCol, "reps_executadas", 5), 10) || 0;
    var rpe = parseFloat(getCell(r, execCol, "rpe_sessao", 7)) || 0;
    var nomeEx = rxMap[idEx] || idEx;
    var groupKey = [
      dateStr,
      meta.id_ficha || "SEM_FICHA",
      meta.id_treino || "SEM_TREINO"].join("|");
    var vl = carga * reps;
    var e1rm = reps > 0 ? carga * (1 + reps / 30) : 0;

    exercicioSet[nomeEx] = true;
    if (!sessoesByGroup[groupKey]) {
      sessoesByGroup[groupKey] = {
        idResumoSessao: sanitizeId(groupKey),
        idSessaoGrupo: groupKey,
        data: dateStr,
        idFicha: meta.id_ficha || "SEM_FICHA",
        idTreino: meta.id_treino || "SEM_TREINO",
        totalVolume: 0,
        totalRPE: 0,
        countRPE: 0,
        totalSeries: 0,
        exercicioNames: {},
        exercicios: []};
    }

    var s = sessoesByGroup[groupKey];
    s.totalVolume += vl;
    s.totalSeries++;
    s.exercicioNames[nomeEx] = true;
    if (rpe > 0) {
      s.totalRPE += rpe;
      s.countRPE++;
    }
    s.exercicios.push({
      nome: nomeEx,
      id_exercicio: idEx,
      carga: carga,
      reps: reps,
      volumeLoad: vl,
      e1rm: e1rm,
      rpe: rpe});
  }

  var sessoes = [];
  for (var k in sessoesByGroup) {
    var sessao = sessoesByGroup[k];
    var principal = pickPrincipalExercise(sessao.exercicios);
    var best = pickBestE1rm(sessao.exercicios);
    sessoes.push({
      idResumoSessao: sessao.idResumoSessao,
      idSessaoGrupo: sessao.idSessaoGrupo,
      data: sessao.data,
      id_ficha: sessao.idFicha,
      id_treino: sessao.idTreino,
      totalExercicios: Object.keys(sessao.exercicioNames).length,
      totalSeries: sessao.totalSeries,
      volumeTotal: sessao.totalVolume,
      rpeMedia:
        sessao.countRPE > 0
          ? Math.round((sessao.totalRPE / sessao.countRPE) * 10) / 10
          : 0,
      exercicioPrincipal: principal.nome,
      melhorE1rmSessao: Math.round(best.e1rm * 10) / 10,
      maiorCargaSessao: best.carga,
      duracaoEstimadaMin: sessao.totalSeries * 3,
      origemDados: "DB_Execucao",
      updatedAt: new Date(),
      exercicios: sessao.exercicios});
  }

  sessoes.sort(function (a, b) {
    return parsePtBrDate(a.data) - parsePtBrDate(b.data);
  });

  var e1rmByExercise = {};
  sessoes.forEach(function (s) {
    s.exercicios.forEach(function (ex) {
      if (!e1rmByExercise[ex.nome]) e1rmByExercise[ex.nome] = [];
      e1rmByExercise[ex.nome].push({
        data: s.data,
        e1rm: ex.e1rm,
        carga: ex.carga});
    });
  });

  if (options.updateSheet) updateGestaoCargaSheet(ss, sessoes);
  return {
    sessoes: sessoes,
    e1rmByExercise: e1rmByExercise,
    exercicios: Object.keys(exercicioSet)};
}

function buildExerciseNameMap(sheetRx) {
  var rxMap = {};
  if (!sheetRx) return rxMap;
  var rxData = sheetRx.getDataRange().getValues();
  var rxCol = getColumnMap(rxData);
  for (var i = 1; i < rxData.length; i++) {
    var idIndex =
      rxCol["id_exercicio"] !== undefined ? rxCol["id_exercicio"] : 2;
    var idExercicio = rxData[i][idIndex];
    if (idExercicio) rxMap[cleanText(idExercicio)] = cleanText(idExercicio);
  }
  return rxMap;
}

function pickPrincipalExercise(exercicios) {
  return exercicios.reduce(
    function (a, b) {
      return a.volumeLoad > b.volumeLoad ? a : b;
    },
    { nome: "-", volumeLoad: 0 });
}

function pickBestE1rm(exercicios) {
  return exercicios.reduce(
    function (a, b) {
      return a.e1rm > b.e1rm ? a : b;
    },
    { e1rm: 0, carga: 0 });
}

function updateGestaoCargaSheet(ss, sessoes) {
  var sheet = ensureManagedSheet(ss, "DB_GestaoCarga", GESTAO_CARGA_HEADERS);
  var data = sheet.getDataRange().getValues();
  var col = getColumnMap(data);
  var existingRows = {};

  for (var i = 1; i < data.length; i++) {
    var existingId = getCell(data[i], col, "id_resumo_sessao", 0);
    if (existingId) existingRows[String(existingId)] = i + 1;
  }

  sessoes.forEach(function (s) {
    var valuesByHeader = {
      id_resumo_sessao: s.idResumoSessao,
      id_sessao_grupo: s.idSessaoGrupo,
      data_sessao: s.data,
      id_ficha: s.id_ficha,
      id_treino: s.id_treino,
      total_exercicios: s.totalExercicios,
      total_series: s.totalSeries,
      volume_total: s.volumeTotal,
      rpe_medio: s.rpeMedia,
      exercicio_principal: s.exercicioPrincipal,
      melhor_e1rm_sessao: s.melhorE1rmSessao,
      maior_carga_sessao: s.maiorCargaSessao,
      duracao_estimada_min: s.duracaoEstimadaMin,
      origem_dados: s.origemDados,
      updated_at: s.updatedAt};
    var rowIndex =
      existingRows[String(s.idResumoSessao)] || sheet.getLastRow() + 1;
    setRowByHeaders(sheet, rowIndex, valuesByHeader, GESTAO_CARGA_HEADERS);
    existingRows[String(s.idResumoSessao)] = rowIndex;
  });
}

function syncExecucaoData(records) {
  if (!records || !Array.isArray(records) || records.length === 0)
    return { success: false, error: "Nenhum registro." };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("DB_Execucao");
  if (!sheet)
    return { success: false, error: "Aba DB_Execucao não encontrada." };
  var colA = sheet.getRange("A:A").getValues();
  var syncCount = 0;
  records.forEach(function (rec) {
    var existingRow = 0;
    for (var i = 1; i < colA.length; i++) {
      if (String(colA[i][0]).trim() === String(rec.id_sessao).trim()) {
        existingRow = i + 1;
        break;
      }
    }
    if (existingRow > 0) {
      sheet.getRange(existingRow, 5).setValue(rec.carga_absoluta);
      sheet.getRange(existingRow, 6).setValue(rec.reps_executadas);
      sheet.getRange(existingRow, 7).setValue(rec.rir);
      sheet.getRange(existingRow, 8).setValue(rec.rpe_sessao);
      sheet.getRange(existingRow, 9).setValue("clean");
    } else {
      sheet.appendRow([
        rec.id_sessao,
        rec.data_treino,
        rec.id_exercicio,
        rec.semana_referencia,
        rec.carga_absoluta,
        rec.reps_executadas,
        rec.rir,
        rec.rpe_sessao,
        "clean"]);
    }
    syncCount++;
  });
  return { success: true, synced: syncCount };
}

function clientGetPrescricao() {
  return getPrescricaoData();
}
function clientGetPrescriptionEditorData() {
  return getPrescriptionEditorData();
}
function clientSavePrescricaoTreino(payload) {
  return savePrescricaoTreino(payload);
}
function clientGetInitialData() {
  return getInitialAppData();
}
function clientGetAppStatus() {
  return getAppStatus();
}
function clientGetExecucao() {
  return getExecucaoData();
}
function clientGetHistorico() {
  return getExecucaoData();
}
function clientGetGestaoCarga() {
  return getGestaoCargaData({ updateSheet: false });
}
function clientSyncExecucao(records) {
  return syncExecucaoData(records);
}

function setupDatabase() {
  var ss = getSpreadsheet();
  Object.keys(MANAGED_SHEETS).forEach(function (sheetName) {
    ensureManagedSheet(ss, sheetName, MANAGED_SHEETS[sheetName]);
  });
  Logger.log(
    "Setup seguro concluido. Dados existentes e abas manuais foram preservados.");
}

function ensureManagedSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  ensureHeaders(sheet, headers);
  formatHeader(sheet, headers.length);
  return sheet;
}

function ensureHeaders(sheet, expectedHeaders) {
  var lastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length, 1);
  var currentHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });
  var currentLower = currentHeaders.map(function (h) {
    return h.toLowerCase();
  });
  var nextColumn = currentHeaders.length + 1;

  expectedHeaders.forEach(function (header) {
    if (currentLower.indexOf(String(header).toLowerCase()) === -1) {
      sheet.getRange(1, nextColumn).setValue(header);
      currentHeaders.push(header);
      currentLower.push(String(header).toLowerCase());
      nextColumn++;
    }
  });
}

function formatHeader(sheet, minColumns) {
  var lastColumn = Math.max(sheet.getLastColumn(), minColumns, 1);
  var headerRange = sheet.getRange(1, 1, 1, lastColumn);
  headerRange
    .setBackground("#000000")
    .setFontColor("#39FF14")
    .setFontWeight("bold")
    .setFontSize(10)
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  for (var i = 1; i <= lastColumn; i++) sheet.setColumnWidth(i, 150);
}

function setRowByHeaders(sheet, rowIndex, valuesByHeader, managedHeaders) {
  ensureHeaders(sheet, managedHeaders);
  var lastColumn = Math.max(sheet.getLastColumn(), managedHeaders.length, 1);
  var headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (h) {
      return String(h).trim().toLowerCase();
    });
  var rowValues = sheet.getRange(rowIndex, 1, 1, lastColumn).getValues()[0];

  for (var key in valuesByHeader) {
    var index = headers.indexOf(String(key).toLowerCase());
    if (index >= 0) rowValues[index] = valuesByHeader[key];
  }
  sheet.getRange(rowIndex, 1, 1, lastColumn).setValues([rowValues]);
}

function getCell(row, col, header, fallbackIndex) {
  if (col[header] !== undefined) return row[col[header]];
  return row[fallbackIndex];
}

function xsUniquePushServer(list, value) {
  if (value && list.indexOf(value) === -1) list.push(value);
}

function cleanText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function formatDateValue(value) {
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  return String(value || "");
}

function parsePtBrDate(value) {
  var parts = String(value || "").split("/");
  if (parts.length !== 3) return new Date(0);
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function sanitizeId(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseSessionId(idSessao) {
  var parts = String(idSessao || "").split("_");
  var result = {
    id_ficha: "",
    id_treino: "",
    id_exercicio: "",
    semana: "",
    data: "",
    serie: ""};
  if (parts.length >= 6) {
    result.id_ficha = parts[0];
    result.id_treino = parts[1];
    result.id_exercicio = parts.slice(2, parts.length - 3).join("_");
    result.semana = parts[parts.length - 3];
    result.data = parts[parts.length - 2];
    result.serie = parts[parts.length - 1];
  }
  return result;
}

// =====================================================================
// V2 tenant contract. The manager provisions these tabs before release.
// All reads are local to the student's spreadsheet.
// =====================================================================
var TENANT_FICHAS_HEADERS = [
  "ficha_id",
  "nome_ficha",
  "visibilidade_aluno",
  "estado_uso",
  "publicacao_id",
  "data_inicio",
  "data_fim",
  "observacoes",
  "updated_at"
];
var TENANT_CATALOGO_HEADERS = [
  "exercicio_id",
  "nome_exercicio",
  "grupo_muscular",
  "tipo_exercicio",
  "ativo",
  "versao_catalogo",
  "updated_at"
];
var TENANT_SUBSTITUTOS_HEADERS = [
  "substituto_id",
  "prescricao_item_id",
  "ficha_id",
  "treino_id",
  "exercicio_id_substituto",
  "ordem",
  "observacao",
  "ativo"
];
var TENANT_REFERENCIAS_HEADERS = [
  "referencia_id",
  "referencia_tipo",
  "ficha_id",
  "treino_id",
  "exercicio_id",
  "sessao_id",
  "ocorreu_em",
  "pse_sessao",
  "series_json",
  "updated_at"
];

PRESCRICAO_HEADERS = PRESCRICAO_HEADERS.concat([
  "prescricao_item_id",
  "publicacao_id",
  "estado_publicacao",
  "zona_rir",
  "nome_exercicio"
]);
EXECUCAO_HEADERS = EXECUCAO_HEADERS.concat([
  "id_operacao",
  "id_ficha",
  "id_treino",
  "publicacao_id",
  "prescricao_item_id",
  "exercicio_prescrito_id",
  "tipo_execucao",
  "estado_execucao",
  "ordem_exercicio",
  "serie",
  "pse_sessao",
  "updated_at"
]);
MANAGED_SHEETS.DB_Prescricao = PRESCRICAO_HEADERS;
MANAGED_SHEETS.DB_Execucao = EXECUCAO_HEADERS;
MANAGED_SHEETS.DB_Fichas = TENANT_FICHAS_HEADERS;
MANAGED_SHEETS.DB_Catalogo_Exercicios = TENANT_CATALOGO_HEADERS;
MANAGED_SHEETS.DB_Prescricao_Substitutos = TENANT_SUBSTITUTOS_HEADERS;
MANAGED_SHEETS.DB_Referencia_Exercicio = TENANT_REFERENCIAS_HEADERS;

function ensureTenantSchema() {
  var ss = getSpreadsheet();
  Object.keys(MANAGED_SHEETS).forEach(function (sheetName) {
    ensureManagedSheet(ss, sheetName, MANAGED_SHEETS[sheetName]);
  });
  return ss;
}

function tenantSheetRows(sheetName) {
  var ss = ensureTenantSchema();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (value) {
    return String(value || "").trim().toLowerCase();
  });
  return values.slice(1).filter(function (row) {
    return row.join("").trim() !== "";
  }).map(function (row) {
    var item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index];
    });
    return item;
  });
}

function tenantValue(record, name) {
  var value = record[String(name).toLowerCase()];
  return value === undefined || value === null ? "" : value;
}

function tenantText(record, name) {
  return String(tenantValue(record, name) || "").trim();
}

function tenantIsVisible(record) {
  var value = tenantText(record, "visibilidade_aluno").toLowerCase();
  return value === "visivel" || value === "visível" || value === "true" || value === "sim";
}

function tenantIsActive(record) {
  var value = tenantText(record, "estado_uso").toLowerCase();
  return value === "ativa" || value === "ativo" || value === "true";
}

function getVisibleFichas() {
  return tenantSheetRows("DB_Fichas").filter(tenantIsVisible).map(function (row) {
    return {
      ficha_id: tenantText(row, "ficha_id"),
      nome_ficha: tenantText(row, "nome_ficha"),
      publicacao_id: tenantText(row, "publicacao_id"),
      estado_uso: tenantText(row, "estado_uso"),
      data_inicio: tenantValue(row, "data_inicio"),
      data_fim: tenantValue(row, "data_fim"),
      observacoes: tenantText(row, "observacoes")
    };
  });
}

function getActiveFicha() {
  var active = getVisibleFichas().filter(function (ficha) {
    var value = String(ficha.estado_uso || "").toLowerCase();
    return value === "ativa" || value === "ativo" || value === "true";
  });
  if (active.length > 1) throw new Error("Há mais de uma ficha ativa. Peça ao treinador para corrigir a publicação.");
  return active.length === 1 ? active[0] : null;
}

function getTenantHistorico() {
  var rows = tenantSheetRows("DB_Execucao");
  var sessions = {};
  rows.forEach(function (row) {
    var state = tenantText(row, "estado_execucao").toLowerCase();
    if (state === "nao_realizado" || state === "não_realizado") return;
    var sessionId = tenantText(row, "id_sessao");
    if (!sessionId) return;
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        id_sessao: sessionId,
        data_treino: tenantValue(row, "data_treino"),
        ficha_id: tenantText(row, "id_ficha"),
        treino_id: tenantText(row, "id_treino"),
        pse: tenantValue(row, "pse_sessao") || tenantValue(row, "rpe_sessao"),
        total_series: 0,
        exercicios: {},
        volume_total: 0,
        records: []
      };
    }
    var session = sessions[sessionId];
    var exerciseId = tenantText(row, "id_exercicio");
    session.total_series++;
    session.exercicios[exerciseId] = true;
    session.volume_total += Number(tenantValue(row, "carga_absoluta") || 0) * Number(tenantValue(row, "reps_executadas") || 0);
    session.records.push(row);
  });
  return Object.keys(sessions).map(function (id) {
    var session = sessions[id];
    session.total_exercicios = Object.keys(session.exercicios).length;
    delete session.exercicios;
    return session;
  }).sort(function (a, b) {
    return new Date(b.data_treino).getTime() - new Date(a.data_treino).getTime();
  });
}

function getTenantBootstrap() {
  var fichas = getVisibleFichas();
  var catalog = tenantSheetRows("DB_Catalogo_Exercicios");
  var active = getActiveFicha();
  var treinos = [];
  if (active) tenantSheetRows("DB_Prescricao").forEach(function (row) {
    var treino = tenantText(row, "id_treino");
    if (tenantText(row, "id_ficha") === active.ficha_id && treino && treinos.indexOf(treino) === -1) treinos.push(treino);
  });
  var version = "";
  catalog.some(function (row) {
    version = tenantText(row, "versao_catalogo");
    return version !== "";
  });
  return {
    fichas: fichas,
    ficha_ativa: active,
    treinos_ativos: treinos,
    historico: getTenantHistorico().slice(0, 20),
    versao_catalogo: version,
    atualizado_em: new Date().toISOString()
  };
}

function tenantCurrentCycleValue(row, field, cycle) {
  var direct = tenantValue(row, field);
  if (direct !== "") return direct;
  return tenantValue(row, "semana_" + cycle + "_" + field);
}

function tenantCatalogMap() {
  var map = {};
  tenantSheetRows("DB_Catalogo_Exercicios").forEach(function (row) {
    map[tenantText(row, "exercicio_id")] = row;
  });
  return map;
}

function tenantReferencesFor(exerciseId, fichaId, treinoId) {
  var rows = tenantSheetRows("DB_Referencia_Exercicio").filter(function (row) {
    return tenantText(row, "exercicio_id") === String(exerciseId);
  }).sort(function (a, b) {
    return new Date(tenantValue(b, "ocorreu_em")).getTime() - new Date(tenantValue(a, "ocorreu_em")).getTime();
  });
  var comparable = rows.filter(function (row) {
    return tenantText(row, "ficha_id") === String(fichaId) && tenantText(row, "treino_id") === String(treinoId);
  })[0] || null;
  return { comparavel: comparable, exercicio: rows[0] || null };
}

function getTreinoSessionBootstrap(payload) {
  payload = payload || {};
  var active = getActiveFicha();
  if (!active) throw new Error("Não há ficha ativa para iniciar um treino.");
  var treinoId = String(payload.treino_id || "");
  if (!treinoId) throw new Error("Selecione um treino antes de iniciar.");
  var cycle = String(payload.ciclo || "1");
  var catalog = tenantCatalogMap();
  var prescriptions = tenantSheetRows("DB_Prescricao").filter(function (row) {
    return tenantText(row, "id_ficha") === active.ficha_id && tenantText(row, "id_treino") === treinoId;
  }).sort(function (a, b) {
    return Number(tenantValue(a, "ordem_exercicio") || 0) - Number(tenantValue(b, "ordem_exercicio") || 0);
  });
  var substitutes = tenantSheetRows("DB_Prescricao_Substitutos").filter(function (row) {
    var value = tenantText(row, "ativo").toLowerCase();
    return value !== "false" && value !== "nao" && value !== "não";
  });
  var items = prescriptions.map(function (row) {
    var itemId = tenantText(row, "prescricao_item_id") || tenantText(row, "id_exercicio") + "_" + treinoId;
    var exerciseId = tenantText(row, "id_exercicio");
    var catalogItem = catalog[exerciseId] || {};
    var allowed = substitutes.filter(function (sub) {
      return tenantText(sub, "prescricao_item_id") === itemId;
    }).map(function (sub) {
      var substituteExercise = catalog[tenantText(sub, "exercicio_id_substituto")] || {};
      return {
        exercicio_id: tenantText(sub, "exercicio_id_substituto"),
        nome_exercicio: tenantText(substituteExercise, "nome_exercicio"),
        observacao: tenantText(sub, "observacao")
      };
    });
    return {
      prescricao_item_id: itemId,
      exercicio_id: exerciseId,
      nome_exercicio: tenantText(row, "nome_exercicio") || tenantText(catalogItem, "nome_exercicio"),
      ordem_exercicio: Number(tenantValue(row, "ordem_exercicio") || 0),
      sets: tenantCurrentCycleValue(row, "sets", cycle),
      reps: tenantCurrentCycleValue(row, "reps", cycle),
      descanso: tenantCurrentCycleValue(row, "descanso", cycle),
      zona_rir: tenantCurrentCycleValue(row, "zona_rir", cycle),
      observacoes: tenantText(row, "observacoes"),
      substitutos: allowed,
      referencia: tenantReferencesFor(exerciseId, active.ficha_id, treinoId).comparavel
    };
  });
  return {
    ficha: active,
    treino_id: treinoId,
    ciclo: cycle,
    exercicios: items,
    catalogo: Object.keys(catalog).map(function (id) {
      var row = catalog[id];
      return {
        exercicio_id: id,
        nome_exercicio: tenantText(row, "nome_exercicio"),
        grupo_muscular: tenantText(row, "grupo_muscular")
      };
    })
  };
}

function tenantOperationExists(sheet, operationId) {
  if (!operationId || sheet.getLastRow() < 2) return false;
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (value) { return String(value).toLowerCase(); });
  var index = headers.indexOf("id_operacao");
  if (index < 0) return false;
  return values.slice(1).some(function (row) { return String(row[index]) === String(operationId); });
}

function appendTenantRows(sheet, headers, records) {
  if (records.length === 0) return;
  ensureHeaders(sheet, headers);
  var allHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (value) {
    return String(value).toLowerCase();
  });
  var rows = records.map(function (record) {
    return allHeaders.map(function (header) {
      return record[header] === undefined ? "" : record[header];
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, allHeaders.length).setValues(rows);
}

function syncTenantSession(payload) {
  payload = payload || {};
  var records = payload.records || [];
  var pse = payload.pse;
  if (!Array.isArray(records) || records.length === 0) return { success: false, error: "Nenhum exercício foi registrado." };
  if (pse === "" || pse === null || pse === undefined) return { success: false, error: "A PSE da sessão é obrigatória." };
  var active = getActiveFicha();
  if (!active || String(payload.ficha_id) !== String(active.ficha_id)) {
    return { success: false, error: "A ficha não está mais ativa. Atualize o aplicativo antes de finalizar." };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { success: false, error: "A sessão está sendo sincronizada. Tente novamente em alguns segundos." };
  try {
    var ss = ensureTenantSchema();
    var executionSheet = ss.getSheetByName("DB_Execucao");
    var operationId = String(payload.id_operacao || payload.id_sessao || "");
    if (!operationId) return { success: false, error: "Identificador da sessão ausente." };
    if (tenantOperationExists(executionSheet, operationId)) return { success: true, synced: 0, duplicate: true };
    var now = new Date().toISOString();
    var sessionId = String(payload.id_sessao || operationId);
    var date = payload.data_treino || now;
    var values = records.map(function (record, index) {
      return {
        id_sessao: sessionId,
        id_operacao: operationId,
        data_treino: date,
        id_ficha: active.ficha_id,
        id_treino: payload.treino_id || "",
        publicacao_id: active.publicacao_id,
        prescricao_item_id: record.prescricao_item_id || "",
        id_exercicio: record.exercicio_id || "",
        exercicio_prescrito_id: record.exercicio_prescrito_id || record.exercicio_id || "",
        tipo_execucao: record.tipo_execucao || "prescrito",
        estado_execucao: record.estado_execucao || "realizado",
        ordem_exercicio: record.ordem_exercicio || index + 1,
        serie: record.serie || "",
        carga_absoluta: record.carga_absoluta || "",
        reps_executadas: record.reps_executadas || "",
        rir: record.rir === undefined || record.rir === "" ? "-" : record.rir,
        pse_sessao: pse,
        rpe_sessao: pse,
        sync_status: "clean",
        updated_at: now
      };
    });
    appendTenantRows(executionSheet, EXECUCAO_HEADERS, values);
    var references = values.filter(function (record) {
      return record.estado_execucao === "realizado";
    }).map(function (record) {
      return {
        referencia_id: sessionId + "_" + record.id_exercicio + "_" + record.serie,
        referencia_tipo: record.tipo_execucao === "prescrito" ? "comparavel" : "exercicio",
        ficha_id: record.id_ficha,
        treino_id: record.id_treino,
        exercicio_id: record.id_exercicio,
        sessao_id: sessionId,
        ocorreu_em: date,
        pse_sessao: pse,
        series_json: JSON.stringify({ carga: record.carga_absoluta, reps: record.reps_executadas, rir: record.rir }),
        updated_at: now
      };
    });
    appendTenantRows(ss.getSheetByName("DB_Referencia_Exercicio"), TENANT_REFERENCIAS_HEADERS, references);
    return { success: true, synced: values.length, id_sessao: sessionId };
  } finally {
    lock.releaseLock();
  }
}

function calculateBrzyckiE1rm(carga, repeticoes, rir) {
  if (rir === "-" || rir === "6+" || rir === "" || rir === null || rir === undefined) return null;
  var load = Number(carga);
  var reps = Number(repeticoes);
  var rirValue = Number(rir);
  var effectiveReps = reps + rirValue;
  if (!isFinite(load) || !isFinite(reps) || !isFinite(rirValue) || load <= 0 || rirValue < 0 || rirValue > 5 || effectiveReps < 1 || effectiveReps > 10) return null;
  return load / (1.0278 - 0.0278 * effectiveReps);
}

function getProgressData(payload) {
  payload = payload || {};
  var rows = tenantSheetRows("DB_Execucao").filter(function (row) {
    return tenantText(row, "estado_execucao") === "realizado";
  });
  var bySession = {};
  var byExercise = {};
  rows.forEach(function (row) {
    var sessionId = tenantText(row, "id_sessao");
    if (!bySession[sessionId]) bySession[sessionId] = row;
    var exerciseId = tenantText(row, "id_exercicio");
    var e1rm = calculateBrzyckiE1rm(tenantValue(row, "carga_absoluta"), tenantValue(row, "reps_executadas"), tenantValue(row, "rir"));
    if (e1rm !== null) {
      if (!byExercise[exerciseId]) byExercise[exerciseId] = [];
      byExercise[exerciseId].push({ data: tenantValue(row, "data_treino"), e1rm: e1rm, sessao_id: sessionId });
    }
  });
  var series = Object.keys(byExercise).map(function (exerciseId) {
    var bestBySession = {};
    byExercise[exerciseId].forEach(function (point) {
      if (!bestBySession[point.sessao_id] || point.e1rm > bestBySession[point.sessao_id].e1rm) bestBySession[point.sessao_id] = point;
    });
    return { exercicio_id: exerciseId, pontos: Object.keys(bestBySession).map(function (id) { return bestBySession[id]; }) };
  });
  return { sessoes: Object.keys(bySession).length, e1rm_por_exercicio: series };
}
