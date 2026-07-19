// XSTeam V2 — PWA Gerenciador (fundação)

var MANAGER_SHEETS = [
  { name: "Alunos", headers: ["aluno_id", "nome", "telefone_e164", "status", "observacoes_gestao", "created_at", "updated_at"] },
  { name: "Instancias", headers: ["instancia_id", "aluno_id", "status_provisionamento", "folder_id", "spreadsheet_id", "script_id", "deployment_id", "pwa_url", "versao_template", "created_at", "updated_at", "erro_resumo"] },
  { name: "Fichas", headers: ["ficha_id", "aluno_id", "nome_ficha", "visibilidade_aluno", "estado_uso", "publicacao_atual_id", "data_inicio", "data_fim", "created_at", "updated_at"] },
  { name: "Prescricoes", headers: ["prescricao_id", "ficha_id", "aluno_id", "versao", "status_edicao", "created_at", "updated_at"] },
  { name: "Prescricao_Itens", headers: ["prescricao_item_id", "prescricao_id", "ficha_id", "aluno_id", "treino_id", "nome_treino", "exercicio_id", "ordem", "semana_1_series", "semana_1_repeticoes", "semana_1_descanso_segundos", "semana_1_zona_rir", "semana_2_series", "semana_2_repeticoes", "semana_2_descanso_segundos", "semana_2_zona_rir", "semana_3_series", "semana_3_repeticoes", "semana_3_descanso_segundos", "semana_3_zona_rir", "semana_4_series", "semana_4_repeticoes", "semana_4_descanso_segundos", "semana_4_zona_rir", "observacoes", "created_at", "updated_at"] },
  { name: "Catalogo_Exercicios", headers: ["exercicio_id", "nome_exercicio", "grupo_muscular", "tipo_exercicio", "coef_gluteos", "coef_posterior_coxa", "coef_quadriceps", "coef_panturrilha", "coef_peitoral", "coef_dorsal", "coef_deltoide_anterior", "coef_deltoide_posterior", "coef_biceps", "coef_triceps", "coef_antebraco", "coef_abdomen", "coef_eretores", "ativo", "versao_catalogo", "created_at", "updated_at"] },
  { name: "Publicacoes", headers: ["publicacao_id", "ficha_id", "aluno_id", "prescricao_id", "versao_prescricao", "status", "publicado_em", "ocultado_em", "created_at", "updated_at"] },
  { name: "Sessoes_Monitoradas", headers: ["sessao_id", "aluno_id", "instancia_id", "ficha_id", "treino_id", "ocorreu_em", "exercicios_planejados", "exercicios_concluidos", "series_executadas", "volume_total", "rpe_sessao", "created_at", "updated_at"] },
  { name: "Eventos_Observabilidade", headers: ["event_id", "ocorreu_em", "aluno_id", "instancia_id", "tipo", "resultado", "tela", "acao", "codigo_erro", "mensagem_sanitizada", "duracao_ms", "versao_app", "created_at"] },
  { name: "Resumo_Uso_Diario", headers: ["data", "aluno_id", "instancia_id", "versao_app", "aberturas", "sync_sucesso", "sync_falha", "erros_controlados", "sessoes_salvas", "updated_at"] },
  { name: "Fila_Operacoes", headers: ["operacao_id", "tipo", "aluno_id", "instancia_id", "referencia_id", "status", "tentativas", "payload_json", "erro_resumo", "criado_em", "iniciado_em", "concluido_em", "updated_at"] }
];

function doGet(e) {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("XSTeam — Gerenciador")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function routeManagerAction(payload) {
  var action = payload && payload.action ? String(payload.action) : "";
  var data = payload && payload.data ? payload.data : payload || {};
  if (action === "getBootstrap") return getManagerBootstrap();
  if (action === "setupDatabase") return setupManagerDatabase();
  if (action === "listAlunos") return { success: true, alunos: listAlunos() };
  if (action === "saveAluno") return saveAluno(data);
  if (action === "getAlunoProfile") return getAlunoProfile(data.aluno_id);
  if (action === "listCatalogoExercicios") return { success: true, catalogo: listCatalogoExercicios() };
  if (action === "saveCatalogoExercicio") return saveCatalogoExercicio(data);
  if (action === "createFicha") return createFicha(data.aluno_id, data.nome_ficha);
  if (action === "listFichas") return { success: true, fichas: listFichas(data.aluno_id) };
  if (action === "getPrescricaoEditorData") return getPrescricaoEditorData(data.ficha_id);
  if (action === "savePrescricaoDraft") return savePrescricaoDraft(data);
  if (action === "queuePublication") return queuePublication(data.ficha_id);
  if (action === "publishFicha") return publishFicha(data.publicacao_id);
  if (action === "setFichaVisibility") return setFichaVisibility(data.ficha_id, data.visible);
  if (action === "activateFicha") return activateFicha(data.ficha_id);
  return { success: false, error: "Ação desconhecida" };
}

function getManagerBootstrap() {
  return {
    success: true,
    data: {
      appName: "XSTeam Gerenciador",
      pages: ["alunos", "prescricoes", "acompanhamento", "saude"],
      alunos: listAlunos()
    }
  };
}

function getManagerSpreadsheet() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty("MANAGER_SPREADSHEET_ID");
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!activeSpreadsheet) throw new Error("Defina MANAGER_SPREADSHEET_ID nas propriedades do script.");
  return activeSpreadsheet;
}

function setupManagerDatabase() {
  var ss = getManagerSpreadsheet();
  var result = [];
  for (var i = 0; i < MANAGER_SHEETS.length; i += 1) {
    result.push(ensureManagerSheet(ss, MANAGER_SHEETS[i].name, MANAGER_SHEETS[i].headers));
  }
  return { success: true, sheets: result };
}

function ensureManagerSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  var created = false;
  if (!sheet) {
    sheet = ss.insertSheet(name);
    created = true;
  }
  var lastColumn = sheet.getLastColumn();
  var existingHeaders = lastColumn > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  var missingHeaders = [];
  for (var i = 0; i < headers.length; i += 1) {
    if (existingHeaders.indexOf(headers[i]) === -1) missingHeaders.push(headers[i]);
  }
  if (missingHeaders.length) {
    sheet.getRange(1, existingHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  return { name: name, created: created, missingHeaders: missingHeaders };
}
function getManagerSheetDefinition(name) {
  for (var i = 0; i < MANAGER_SHEETS.length; i += 1) {
    if (MANAGER_SHEETS[i].name === name) return MANAGER_SHEETS[i];
  }
  throw new Error("Aba central não reconhecida: " + name);
}

function getManagerSheet(name) {
  var ss = getManagerSpreadsheet();
  var definition = getManagerSheetDefinition(name);
  ensureManagerSheet(ss, definition.name, definition.headers);
  return ss.getSheetByName(definition.name);
}

function objectFromRow(headers, row) {
  var result = {};
  for (var i = 0; i < headers.length; i += 1) result[headers[i]] = row[i] === undefined ? "" : row[i];
  return result;
}

function getManagerRecords(name) {
  var sheet = getManagerSheet(name);
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];
  var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  var records = [];
  for (var i = 1; i < values.length; i += 1) records.push(objectFromRow(values[0], values[i]));
  return records;
}

function makeManagerRow(headers, record) {
  var row = [];
  for (var i = 0; i < headers.length; i += 1) row.push(record[headers[i]] === undefined ? "" : record[headers[i]]);
  return row;
}

function normalizePhoneE164(phone) {
  var digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!/^55\d{10,11}$/.test(digits)) throw new Error("Informe um telefone brasileiro válido com DDD.");
  return digits;
}

function buildWhatsAppUrl(phone, message) {
  var normalized = normalizePhoneE164(phone);
  var url = "https://wa.me/" + normalized;
  return message ? url + "?text=" + encodeURIComponent(String(message)) : url;
}

function listAlunos() {
  var alunos = getManagerRecords("Alunos");
  for (var i = 0; i < alunos.length; i += 1) {
    alunos[i].whatsapp_url = buildWhatsAppUrl(alunos[i].telefone_e164);
  }
  alunos.sort(function (a, b) {
    return String(a.nome).toLowerCase() > String(b.nome).toLowerCase() ? 1 : -1;
  });
  return alunos;
}

function getAlunoProfile(alunoId) {
  var alunoIdText = String(alunoId || "");
  var alunos = listAlunos();
  var aluno = null;
  for (var i = 0; i < alunos.length; i += 1) {
    if (String(alunos[i].aluno_id) === alunoIdText) {
      aluno = alunos[i];
      break;
    }
  }
  if (!aluno) return { success: false, error: "Aluno não encontrado" };
  var instances = getManagerRecords("Instancias");
  var instancia = null;
  for (var j = 0; j < instances.length; j += 1) {
    if (String(instances[j].aluno_id) === alunoIdText) {
      instancia = instances[j];
      break;
    }
  }
  return { success: true, aluno: aluno, instancia: instancia };
}

function saveAluno(payload) {
  var data = payload || {};
  var nome = String(data.nome || "").trim();
  if (!nome) return { success: false, error: "Informe o nome do aluno." };
  var telefone;
  try {
    telefone = normalizePhoneE164(data.telefone_e164);
  } catch (error) {
    return { success: false, error: error.message };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: "Não foi possível salvar agora. Tente novamente." };
  try {
    var alunosSheet = getManagerSheet("Alunos");
    var definition = getManagerSheetDefinition("Alunos");
    var now = new Date().toISOString();
    var alunoId = String(data.aluno_id || "");
    var existingRow = 0;
    if (alunoId) {
      var alunoRows = getManagerRecords("Alunos");
      for (var i = 0; i < alunoRows.length; i += 1) {
        if (String(alunoRows[i].aluno_id) === alunoId) {
          existingRow = i + 2;
          break;
        }
      }
      if (!existingRow) return { success: false, error: "Aluno não encontrado para atualização." };
    } else {
      alunoId = Utilities.getUuid();
    }

    var record = {
      aluno_id: alunoId,
      nome: nome,
      telefone_e164: telefone,
      status: String(data.status || "ativo"),
      observacoes_gestao: String(data.observacoes_gestao || ""),
      created_at: existingRow ? getManagerRecords("Alunos")[existingRow - 2].created_at : now,
      updated_at: now
    };
    if (existingRow) {
      alunosSheet.getRange(existingRow, 1, 1, definition.headers.length).setValues([makeManagerRow(definition.headers, record)]);
    } else {
      alunosSheet.appendRow(makeManagerRow(definition.headers, record));
      var instanceDefinition = getManagerSheetDefinition("Instancias");
      getManagerSheet("Instancias").appendRow(makeManagerRow(instanceDefinition.headers, {
        instancia_id: Utilities.getUuid(),
        aluno_id: alunoId,
        status_provisionamento: "nao_provisionada",
        created_at: now,
        updated_at: now
      }));
    }
    return { success: true, aluno: { aluno_id: alunoId, nome: nome, telefone_e164: telefone, status: record.status } };
  } finally {
    lock.releaseLock();
  }
}
var COEFFICIENT_HEADERS = ["coef_gluteos", "coef_posterior_coxa", "coef_quadriceps", "coef_panturrilha", "coef_peitoral", "coef_dorsal", "coef_deltoide_anterior", "coef_deltoide_posterior", "coef_biceps", "coef_triceps", "coef_antebraco", "coef_abdomen", "coef_eretores"];

function getRecordWithRow(name, idField, idValue) {
  var records = getManagerRecords(name);
  for (var i = 0; i < records.length; i += 1) {
    if (String(records[i][idField]) === String(idValue)) return { record: records[i], row: i + 2 };
  }
  return null;
}

function appendManagerRecord(name, record) {
  var definition = getManagerSheetDefinition(name);
  getManagerSheet(name).appendRow(makeManagerRow(definition.headers, record));
}

function updateManagerRecord(name, row, record) {
  var definition = getManagerSheetDefinition(name);
  getManagerSheet(name).getRange(row, 1, 1, definition.headers.length).setValues([makeManagerRow(definition.headers, record)]);
}

function numericValue(value) {
  var parsed = Number(value);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function getCurrentCatalogVersion() {
  var catalog = getManagerRecords("Catalogo_Exercicios");
  var version = 0;
  for (var i = 0; i < catalog.length; i += 1) version = Math.max(version, Number(catalog[i].versao_catalogo) || 0);
  return version;
}

function listCatalogoExercicios() {
  var catalog = getManagerRecords("Catalogo_Exercicios");
  catalog.sort(function (a, b) { return String(a.nome_exercicio) > String(b.nome_exercicio) ? 1 : -1; });
  return catalog;
}

function queueCatalogRecalculation(version) {
  appendManagerRecord("Fila_Operacoes", {
    operacao_id: Utilities.getUuid(),
    tipo: "recalcular_catalogo",
    referencia_id: String(version),
    status: "pendente",
    tentativas: 0,
    payload_json: JSON.stringify({ versao_catalogo: version }),
    criado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

function saveCatalogoExercicio(payload) {
  var data = payload || {};
  var nome = String(data.nome_exercicio || "").trim();
  var grupo = String(data.grupo_muscular || "").trim();
  var tipo = String(data.tipo_exercicio || "").trim();
  if (!nome || !grupo || !tipo) return { success: false, error: "Informe nome, grupo muscular e tipo do exercício." };
  var existing = data.exercicio_id ? getRecordWithRow("Catalogo_Exercicios", "exercicio_id", data.exercicio_id) : null;
  var now = new Date().toISOString();
  var version = getCurrentCatalogVersion();
  var coefficientsChanged = false;
  for (var i = 0; i < COEFFICIENT_HEADERS.length; i += 1) {
    var key = COEFFICIENT_HEADERS[i];
    if (existing && Number(existing.record[key] || 0) !== numericValue(data[key])) coefficientsChanged = true;
  }
  if (existing && coefficientsChanged) version += 1;
  if (!existing && version < 1) version = 1;
  var record = {
    exercicio_id: existing ? existing.record.exercicio_id : Utilities.getUuid(),
    nome_exercicio: nome,
    grupo_muscular: grupo,
    tipo_exercicio: tipo,
    ativo: data.ativo === false || data.ativo === "false" ? "false" : "true",
    versao_catalogo: existing && !coefficientsChanged ? existing.record.versao_catalogo : version,
    created_at: existing ? existing.record.created_at : now,
    updated_at: now
  };
  for (var j = 0; j < COEFFICIENT_HEADERS.length; j += 1) record[COEFFICIENT_HEADERS[j]] = numericValue(data[COEFFICIENT_HEADERS[j]]);
  if (existing) updateManagerRecord("Catalogo_Exercicios", existing.row, record);
  else appendManagerRecord("Catalogo_Exercicios", record);
  if (coefficientsChanged) queueCatalogRecalculation(version);
  return { success: true, exercicio: record, recalculo_enfileirado: coefficientsChanged };
}

function listFichas(alunoId) {
  var fichas = getManagerRecords("Fichas").filter(function (ficha) { return String(ficha.aluno_id) === String(alunoId || ""); });
  fichas.sort(function (a, b) { return String(b.updated_at) > String(a.updated_at) ? 1 : -1; });
  return fichas;
}

function createFicha(alunoId, name) {
  var aluno = getRecordWithRow("Alunos", "aluno_id", alunoId);
  var nomeFicha = String(name || "").trim();
  if (!aluno) return { success: false, error: "Selecione um aluno válido antes de criar a ficha." };
  if (!nomeFicha) return { success: false, error: "Informe o nome da ficha." };
  var now = new Date().toISOString();
  var ficha = {
    ficha_id: Utilities.getUuid(),
    aluno_id: aluno.record.aluno_id,
    nome_ficha: nomeFicha,
    visibilidade_aluno: "oculta",
    estado_uso: "inativa",
    created_at: now,
    updated_at: now
  };
  var prescricao = {
    prescricao_id: Utilities.getUuid(),
    ficha_id: ficha.ficha_id,
    aluno_id: ficha.aluno_id,
    versao: 1,
    status_edicao: "rascunho",
    created_at: now,
    updated_at: now
  };
  appendManagerRecord("Fichas", ficha);
  appendManagerRecord("Prescricoes", prescricao);
  return { success: true, ficha: ficha, prescricao: prescricao };
}

function getLatestPrescricao(fichaId) {
  var prescriptions = getManagerRecords("Prescricoes").filter(function (item) { return String(item.ficha_id) === String(fichaId); });
  prescriptions.sort(function (a, b) { return (Number(b.versao) || 0) - (Number(a.versao) || 0); });
  return prescriptions.length ? prescriptions[0] : null;
}

function calculatePlannedDemandPreview(items, catalog) {
  var catalogById = {};
  for (var i = 0; i < catalog.length; i += 1) catalogById[String(catalog[i].exercicio_id)] = catalog[i];
  var preview = { semana_1: {}, semana_2: {}, semana_3: {}, semana_4: {} };
  for (var week = 1; week <= 4; week += 1) {
    for (var c = 0; c < COEFFICIENT_HEADERS.length; c += 1) preview["semana_" + week][COEFFICIENT_HEADERS[c]] = 0;
  }
  for (var itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    var exercise = catalogById[String(items[itemIndex].exercicio_id)];
    if (!exercise) continue;
    for (var w = 1; w <= 4; w += 1) {
      var series = numericValue(items[itemIndex]["semana_" + w + "_series"]);
      for (var coefIndex = 0; coefIndex < COEFFICIENT_HEADERS.length; coefIndex += 1) {
        var coefficient = COEFFICIENT_HEADERS[coefIndex];
        preview["semana_" + w][coefficient] += numericValue(exercise[coefficient]) * series;
      }
    }
  }
  return preview;
}

function getPrescricaoEditorData(fichaId) {
  var fichaLookup = getRecordWithRow("Fichas", "ficha_id", fichaId);
  if (!fichaLookup) return { success: false, error: "Ficha não encontrada." };
  var prescricao = getLatestPrescricao(fichaId);
  var itens = prescricao ? getManagerRecords("Prescricao_Itens").filter(function (item) { return String(item.prescricao_id) === String(prescricao.prescricao_id); }) : [];
  var catalogo = listCatalogoExercicios().filter(function (item) { return String(item.ativo) !== "false"; });
  return { success: true, ficha: fichaLookup.record, prescricao: prescricao, itens: itens, catalogo: catalogo, demanda_planejada: calculatePlannedDemandPreview(itens, catalogo) };
}

function normalizeDraftItem(item, prescricao, order) {
  var source = item || {};
  if (!source.exercicio_id) throw new Error("Cada item precisa de um exercício do catálogo.");
  var normalized = {
    prescricao_item_id: Utilities.getUuid(),
    prescricao_id: prescricao.prescricao_id,
    ficha_id: prescricao.ficha_id,
    aluno_id: prescricao.aluno_id,
    treino_id: String(source.treino_id || "treino-principal"),
    nome_treino: String(source.nome_treino || "Treino principal"),
    exercicio_id: String(source.exercicio_id),
    ordem: order,
    observacoes: String(source.observacoes || ""),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  for (var week = 1; week <= 4; week += 1) {
    normalized["semana_" + week + "_series"] = numericValue(source["semana_" + week + "_series"]);
    normalized["semana_" + week + "_repeticoes"] = String(source["semana_" + week + "_repeticoes"] || "");
    normalized["semana_" + week + "_descanso_segundos"] = numericValue(source["semana_" + week + "_descanso_segundos"]);
    normalized["semana_" + week + "_zona_rir"] = String(source["semana_" + week + "_zona_rir"] || "");
  }
  return normalized;
}

function savePrescricaoDraft(payload) {
  var data = payload || {};
  var fichaLookup = getRecordWithRow("Fichas", "ficha_id", data.ficha_id);
  if (!fichaLookup) return { success: false, error: "Ficha não encontrada." };
  var itens = data.itens instanceof Array ? data.itens : [];
  var current = getLatestPrescricao(data.ficha_id);
  var now = new Date().toISOString();
  var prescricao = {
    prescricao_id: Utilities.getUuid(),
    ficha_id: fichaLookup.record.ficha_id,
    aluno_id: fichaLookup.record.aluno_id,
    versao: current ? (Number(current.versao) || 0) + 1 : 1,
    status_edicao: "rascunho",
    created_at: now,
    updated_at: now
  };
  var catalogIds = {};
  var catalog = listCatalogoExercicios().filter(function (item) { return String(item.ativo) !== "false"; });
  for (var i = 0; i < catalog.length; i += 1) catalogIds[String(catalog[i].exercicio_id)] = true;
  var rows = [];
  try {
    for (var itemIndex = 0; itemIndex < itens.length; itemIndex += 1) {
      if (!catalogIds[String(itens[itemIndex].exercicio_id)]) return { success: false, error: "Um exercício do rascunho não está ativo no catálogo." };
      rows.push(normalizeDraftItem(itens[itemIndex], prescricao, itemIndex + 1));
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
  appendManagerRecord("Prescricoes", prescricao);
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) appendManagerRecord("Prescricao_Itens", rows[rowIndex]);
  return { success: true, prescricao_id: prescricao.prescricao_id, versao: prescricao.versao, demanda_planejada: calculatePlannedDemandPreview(rows, catalog) };
}
function queuePublication(fichaId) {
  var fichaLookup = getRecordWithRow("Fichas", "ficha_id", fichaId);
  var prescricao = getLatestPrescricao(fichaId);
  if (!fichaLookup || !prescricao) return { success: false, error: "Ficha ou rascunho não encontrado." };
  var now = new Date().toISOString();
  var publication = {
    publicacao_id: Utilities.getUuid(),
    ficha_id: fichaLookup.record.ficha_id,
    aluno_id: fichaLookup.record.aluno_id,
    prescricao_id: prescricao.prescricao_id,
    versao_prescricao: prescricao.versao,
    status: "pendente",
    created_at: now,
    updated_at: now
  };
  appendManagerRecord("Publicacoes", publication);
  appendManagerRecord("Fila_Operacoes", {
    operacao_id: Utilities.getUuid(),
    tipo: "publicar_ficha",
    aluno_id: publication.aluno_id,
    referencia_id: publication.publicacao_id,
    status: "pendente",
    tentativas: 0,
    payload_json: JSON.stringify({ publicacao_id: publication.publicacao_id }),
    criado_em: now,
    updated_at: now
  });
  return { success: true, publicacao: publication };
}

function publishFicha(publicacaoId) {
  var publicationLookup = getRecordWithRow("Publicacoes", "publicacao_id", publicacaoId);
  if (!publicationLookup) return { success: false, error: "Publicação não encontrada." };
  var publication = publicationLookup.record;
  var fichaLookup = getRecordWithRow("Fichas", "ficha_id", publication.ficha_id);
  if (!fichaLookup) return { success: false, error: "Ficha não encontrada." };
  if (publication.status === "publicada") return { success: true, publicacao: publication, duplicate: true };
  var now = new Date().toISOString();
  publication.status = "publicada";
  publication.publicado_em = now;
  publication.updated_at = now;
  updateManagerRecord("Publicacoes", publicationLookup.row, publication);
  fichaLookup.record.visibilidade_aluno = "visivel";
  fichaLookup.record.publicacao_atual_id = publication.publicacao_id;
  fichaLookup.record.updated_at = now;
  updateManagerRecord("Fichas", fichaLookup.row, fichaLookup.record);
  return { success: true, publicacao: publication, ficha: fichaLookup.record };
}

function setFichaVisibility(fichaId, visible) {
  var fichaLookup = getRecordWithRow("Fichas", "ficha_id", fichaId);
  if (!fichaLookup) return { success: false, error: "Ficha não encontrada." };
  var ficha = fichaLookup.record;
  if (!visible && String(ficha.estado_uso) === "ativa") return { success: false, error: "Desative a ficha antes de ocultá-la." };
  ficha.visibilidade_aluno = visible ? "visivel" : "oculta";
  ficha.updated_at = new Date().toISOString();
  updateManagerRecord("Fichas", fichaLookup.row, ficha);
  return { success: true, ficha: ficha };
}

function activateFicha(fichaId) {
  var fichaLookup = getRecordWithRow("Fichas", "ficha_id", fichaId);
  if (!fichaLookup) return { success: false, error: "Ficha não encontrada." };
  var ficha = fichaLookup.record;
  if (String(ficha.visibilidade_aluno) !== "visivel") return { success: false, error: "Publique a ficha visivel antes de ativá-la." };
  var fichas = listFichas(ficha.aluno_id);
  var now = new Date().toISOString();
  for (var i = 0; i < fichas.length; i += 1) {
    if (String(fichas[i].estado_uso) === "ativa") {
      var previous = getRecordWithRow("Fichas", "ficha_id", fichas[i].ficha_id);
      previous.record.estado_uso = "inativa";
      previous.record.updated_at = now;
      updateManagerRecord("Fichas", previous.row, previous.record);
    }
  }
  ficha.estado_uso = "ativa";
  ficha.updated_at = now;
  updateManagerRecord("Fichas", fichaLookup.row, ficha);
  return { success: true, ficha: ficha };
}
