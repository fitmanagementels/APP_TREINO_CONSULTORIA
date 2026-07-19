// XSTeam V2 — PWA Gerenciador (fundação)

var MANAGER_SHEETS = [
  { name: "Alunos", headers: ["aluno_id", "nome", "telefone_e164", "status", "observacoes_gestao", "created_at", "updated_at"] },
  { name: "Instancias", headers: ["instancia_id", "aluno_id", "status_provisionamento", "folder_id", "spreadsheet_id", "script_id", "deployment_id", "pwa_url", "versao_template", "created_at", "updated_at", "erro_resumo"] },
  { name: "Fichas", headers: ["ficha_id", "aluno_id", "nome_ficha", "visibilidade_aluno", "estado_uso", "publicacao_atual_id", "data_inicio", "data_fim", "created_at", "updated_at"] },
  { name: "Prescricoes", headers: ["prescricao_id", "ficha_id", "aluno_id", "versao", "status_edicao", "created_at", "updated_at"] },
  { name: "Prescricao_Itens", headers: ["prescricao_item_id", "prescricao_id", "ficha_id", "aluno_id", "exercicio_id", "ordem", "semana_1_series", "semana_1_repeticoes", "semana_1_descanso_segundos", "semana_1_zona_rir", "semana_2_series", "semana_2_repeticoes", "semana_2_descanso_segundos", "semana_2_zona_rir", "semana_3_series", "semana_3_repeticoes", "semana_3_descanso_segundos", "semana_3_zona_rir", "semana_4_series", "semana_4_repeticoes", "semana_4_descanso_segundos", "semana_4_zona_rir", "observacoes", "created_at", "updated_at"] },
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