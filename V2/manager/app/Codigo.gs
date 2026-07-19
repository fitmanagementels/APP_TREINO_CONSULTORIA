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
  if (action === "getBootstrap") return getManagerBootstrap();
  if (action === "setupDatabase") return setupManagerDatabase();
  return { success: false, error: "Ação desconhecida" };
}

function getManagerBootstrap() {
  return {
    success: true,
    data: {
      appName: "XSTeam Gerenciador",
      pages: ["alunos", "prescricoes", "acompanhamento", "saude"]
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