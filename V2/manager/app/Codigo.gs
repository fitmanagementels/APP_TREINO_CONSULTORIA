// XSTeam V2 — PWA Gerenciador (fundação)

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
  if (action === "getBootstrap") {
    return getManagerBootstrap();
  }
  if (action === "setupDatabase") {
    return setupManagerDatabase();
  }
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

function setupManagerDatabase() {
  return { success: true, sheets: [] };
}
