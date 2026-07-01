// =====================================================================
// Code.gs — XSTeam Wellness V2.0 | Single-Tenant
// DB_Prescricao: id_ficha|id_treino|id_exercicio|observacoes|ordem_exercicio
//   semana_1_* ate semana_4_*
// =====================================================================
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
  "semana_4_descanso",
];

var EXECUCAO_HEADERS = [
  "id_sessao",
  "data_treino",
  "id_exercicio",
  "semana_referencia",
  "carga_absoluta",
  "reps_executadas",
  "rir",
  "rpe_sessao",
  "sync_status",
];

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
  "updated_at",
];

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
  "updated_at",
];

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
  "updated_at",
];

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
  "created_at",
];

var MANAGED_SHEETS = {
  DB_Prescricao: PRESCRICAO_HEADERS,
  DB_Execucao: EXECUCAO_HEADERS,
  DB_GestaoCarga: GESTAO_CARGA_HEADERS,
  DB_MemoriaBase: MEMORIA_BASE_HEADERS,
  DB_MemoriaExercicio: MEMORIA_EXERCICIO_HEADERS,
  DB_Insights: INSIGHTS_HEADERS,
};

function doGet(e) {
  var p = e ? e.parameter : {};
  if (p.action) {
    return ContentService.createTextOutput(
      JSON.stringify(routeAction(p)),
    ).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("XSTeam Wellness V2.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag(
      "viewport",
      "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no",
    );
}

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    return ContentService.createTextOutput(
      JSON.stringify(routeAction(p)),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function include(f) {
  return HtmlService.createHtmlOutputFromFile(f).getContent();
}

function routeAction(p) {
  try {
    switch (p.action) {
      case "getPrescricao":
        return { success: true, data: getPrescricaoData() };
      case "getExecucao":
        return { success: true, data: getExecucaoData() };
      case "getHistorico":
        return { success: true, data: getExecucaoData() };
      case "getGestaoCarga":
        return {
          success: true,
          data: getGestaoCargaData({
            updateSheet: p.updateSheet === true || p.updateSheet === "true",
          }),
        };
      case "syncExecucao":
        return syncExecucaoData(p.records || p.data);
      case "setupDatabase":
        var setupResult = setupDatabase();
        return { success: true, data: setupResult || null };
      default:
        return { success: false, error: "Ação desconhecida: " + p.action };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getPrescricaoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("DB_Prescricao");
  if (!sheet) return { rows: [] };
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  var col = getColumnMap(data);
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var idEx = col["id_exercicio"] !== undefined ? r[col["id_exercicio"]] : r[1];
    if (!idEx) continue;
    rows.push({
      id_ficha: col["id_ficha"] !== undefined ? r[col["id_ficha"]] : "",
      id_treino: col["id_treino"] !== undefined ? r[col["id_treino"]] : r[0],
      id_exercicio: idEx,
      nome_exercicio: idEx,
      observacoes: col["observacoes"] !== undefined ? r[col["observacoes"]] : r[2],
      ordem_exercicio:
        col["ordem_exercicio"] !== undefined ? r[col["ordem_exercicio"]] : r[3],
      semana_1_sets:
        col["semana_1_sets"] !== undefined ? r[col["semana_1_sets"]] : r[4],
      semana_1_reps:
        col["semana_1_reps"] !== undefined ? r[col["semana_1_reps"]] : r[5],
      semana_1_descanso:
        col["semana_1_descanso"] !== undefined ? r[col["semana_1_descanso"]] : r[6],
      semana_2_sets:
        col["semana_2_sets"] !== undefined ? r[col["semana_2_sets"]] : r[7],
      semana_2_reps:
        col["semana_2_reps"] !== undefined ? r[col["semana_2_reps"]] : r[8],
      semana_2_descanso:
        col["semana_2_descanso"] !== undefined ? r[col["semana_2_descanso"]] : r[9],
      semana_3_sets:
        col["semana_3_sets"] !== undefined ? r[col["semana_3_sets"]] : r[10],
      semana_3_reps:
        col["semana_3_reps"] !== undefined ? r[col["semana_3_reps"]] : r[11],
      semana_3_descanso:
        col["semana_3_descanso"] !== undefined ? r[col["semana_3_descanso"]] : r[12],
      semana_4_sets:
        col["semana_4_sets"] !== undefined ? r[col["semana_4_sets"]] : r[13],
      semana_4_reps:
        col["semana_4_reps"] !== undefined ? r[col["semana_4_reps"]] : r[14],
      semana_4_descanso:
        col["semana_4_descanso"] !== undefined ? r[col["semana_4_descanso"]] : r[15],
    });
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
      id_treino: meta.id_treino,
    });
  }
  return { rows: rows };
}

function getGestaoCargaData(options) {
  options = options || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
    var idEx = String(getCell(r, execCol, "id_exercicio", 2) || meta.id_exercicio || "");
    if (!idEx) continue;

    var carga = parseFloat(getCell(r, execCol, "carga_absoluta", 4)) || 0;
    var reps = parseInt(getCell(r, execCol, "reps_executadas", 5), 10) || 0;
    var rpe = parseFloat(getCell(r, execCol, "rpe_sessao", 7)) || 0;
    var nomeEx = rxMap[idEx] || idEx;
    var groupKey = [dateStr, meta.id_ficha || "SEM_FICHA", meta.id_treino || "SEM_TREINO"].join("|");
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
        exercicios: [],
      };
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
      rpe: rpe,
    });
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
        sessao.countRPE > 0 ? Math.round((sessao.totalRPE / sessao.countRPE) * 10) / 10 : 0,
      exercicioPrincipal: principal.nome,
      melhorE1rmSessao: Math.round(best.e1rm * 10) / 10,
      maiorCargaSessao: best.carga,
      duracaoEstimadaMin: sessao.totalSeries * 3,
      origemDados: "DB_Execucao",
      updatedAt: new Date(),
      exercicios: sessao.exercicios,
    });
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
        carga: ex.carga,
      });
    });
  });

  if (options.updateSheet) updateGestaoCargaSheet(ss, sessoes);
  return {
    sessoes: sessoes,
    e1rmByExercise: e1rmByExercise,
    exercicios: Object.keys(exercicioSet),
  };
}

function buildExerciseNameMap(sheetRx) {
  var rxMap = {};
  if (!sheetRx) return rxMap;
  var rxData = sheetRx.getDataRange().getValues();
  var rxCol = getColumnMap(rxData);
  for (var i = 1; i < rxData.length; i++) {
    var idIndex = rxCol["id_exercicio"] !== undefined ? rxCol["id_exercicio"] : 2;
    var idExercicio = rxData[i][idIndex];
    if (idExercicio) rxMap[String(idExercicio)] = String(idExercicio);
  }
  return rxMap;
}

function pickPrincipalExercise(exercicios) {
  return exercicios.reduce(function (a, b) {
    return a.volumeLoad > b.volumeLoad ? a : b;
  }, { nome: "-", volumeLoad: 0 });
}

function pickBestE1rm(exercicios) {
  return exercicios.reduce(function (a, b) {
    return a.e1rm > b.e1rm ? a : b;
  }, { e1rm: 0, carga: 0 });
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
      updated_at: s.updatedAt,
    };
    var rowIndex = existingRows[String(s.idResumoSessao)] || sheet.getLastRow() + 1;
    setRowByHeaders(sheet, rowIndex, valuesByHeader, GESTAO_CARGA_HEADERS);
    existingRows[String(s.idResumoSessao)] = rowIndex;
  });
}

function syncExecucaoData(records) {
  if (!records || !Array.isArray(records) || records.length === 0)
    return { success: false, error: "Nenhum registro." };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
        "clean",
      ]);
    }
    syncCount++;
  });
  return { success: true, synced: syncCount };
}

function clientGetPrescricao() {
  return getPrescricaoData();
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(MANAGED_SHEETS).forEach(function (sheetName) {
    ensureManagedSheet(ss, sheetName, MANAGED_SHEETS[sheetName]);
  });
  Logger.log("Setup seguro concluido. Dados existentes e abas manuais foram preservados.");
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
  var currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (h) {
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
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (h) {
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
    serie: "",
  };
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