const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "app", "Codigo.gs"), "utf8");
const index = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const manifest = fs.readFileSync(path.join(root, "app", "appscript.json"), "utf8");
const style = fs.readFileSync(path.join(root, "app", "style.html"), "utf8");
const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
function bodyOf(source, name) {
  const match = new RegExp("function\\s+" + name + "\\s*\\(").exec(source);
  assert.ok(match, name + " should exist");
  const start = match.index;
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error("Could not read body for " + name);
}

const tests = [
  [
    "manager backend exposes the required entry points",
    function () {
      assert.match(code, /function\s+doGet\s*\(/);
      assert.match(code, /function\s+routeManagerAction\s*\(/);
      assert.match(code, /function\s+getManagerBootstrap\s*\(/);
      assert.match(code, /function\s+setupManagerDatabase\s*\(/);
    },
  ],
  [
    "manager manifest starts private to the trainer",
    function () {
      assert.match(manifest, /"executeAs"\s*:\s*"USER_DEPLOYING"/);
      assert.match(manifest, /"access"\s*:\s*"MYSELF"/);
    },
  ],
  [
    "manager shell exposes the four approved pages",
    function () {
      ["Alunos", "Prescrições", "Acompanhamento", "Saúde do App"].forEach(function (label) {
        assert.match(index, new RegExp(label));
      });
      assert.match(index, /id="app-root"/);
      assert.match(index, /id="global-loader"/);
    },
  ],
  [
    "manager schema includes every approved central tab without destructive setup",
    function () {
      ["Alunos", "Instancias", "Fichas", "Prescricoes", "Prescricao_Itens", "Catalogo_Exercicios", "Publicacoes", "Sessoes_Monitoradas", "Eventos_Observabilidade", "Resumo_Uso_Diario", "Fila_Operacoes"].forEach(function (name) {
        assert.match(code, new RegExp(name));
      });
      assert.match(code, /function\s+getManagerSpreadsheet\s*\(/);
      assert.match(code, /function\s+ensureManagerSheet\s*\(/);
      assert.match(code, /aluno_id/);
      assert.match(code, /semana_1_zona_rir/);
      assert.match(code, /semana_4_zona_rir/);
      assert.doesNotMatch(bodyOf(code, "setupManagerDatabase"), /deleteSheet|clear\s*\(/);
    },
  ],
  [
    "manager profiles validate contact data and provide a WhatsApp action",
    function () {
      assert.match(code, /function\s+listAlunos\s*\(/);
      assert.match(code, /function\s+saveAluno\s*\(/);
      assert.match(code, /function\s+getAlunoProfile\s*\(/);
      assert.match(code, /function\s+buildWhatsAppUrl\s*\(/);
      assert.match(code, /wa\.me/);
      assert.match(code, /telefone_e164/);
    },
  ],
  [
    "manager catalog and drafts support RIR zones and catalog versions",
    function () {
      assert.match(code, /function\s+listCatalogoExercicios\s*\(/);
      assert.match(code, /function\s+saveCatalogoExercicio\s*\(/);
      assert.match(code, /function\s+createFicha\s*\(/);
      assert.match(code, /function\s+savePrescricaoDraft\s*\(/);
      assert.match(code, /function\s+getPrescricaoEditorData\s*\(/);
      assert.match(code, /semana_1_zona_rir/);
      assert.match(code, /semana_4_zona_rir/);
      assert.match(code, /versao_catalogo/);
      assert.match(code, /recalcular_catalogo/);
    },
  ],
  [
    "manager publication contract protects visibility and one active fiche",
    function () {
      ["queuePublication", "publishFicha", "setFichaVisibility", "activateFicha"].forEach(function (name) {
        assert.match(code, new RegExp("function\\s+" + name + "\\s*\\("));
      });
      assert.match(code, /publicacao_id/);
      assert.match(code, /status.*pendente/);
      assert.match(bodyOf(code, "activateFicha"), /visivel/);
      assert.match(bodyOf(code, "activateFicha"), /inativa/);
    },
  ],

  [
    "manager replicates published fichas only to the tenant spreadsheet",
    function () {
      ["ensureTenantPublicationSheet", "replicatePublishedFichaToTenant"].forEach(function (name) {
        assert.match(code, new RegExp("function\\s+" + name + "\\s*\\("));
      });
      const replication = bodyOf(code, "replicatePublishedFichaToTenant");
      assert.match(replication, /spreadsheet_id/);
      assert.match(replication, /DB_Fichas/);
      assert.match(replication, /DB_Prescricao/);
    },
  ],

  [
    "tenant replication is idempotent and includes per-item substitutes",
    function () {
      assert.match(code, /Prescricao_Substitutos/);
      const replication = bodyOf(code, "replicatePublishedFichaToTenant");
      assert.match(replication, /upsertTenantPublicationRecord/);
      assert.match(replication, /DB_Prescricao_Substitutos/);
    },
  ],

  [
    "visibility and activation synchronize the tenant fiche states",
    function () {
      assert.match(code, /function\s+syncTenantFichaStates\s*\(/);
      assert.match(code, /function\s+setFichaVisibility[\s\S]*syncTenantFichaStates/);
      assert.match(code, /function\s+activateFicha[\s\S]*syncTenantFichaStates/);
    },
  ],
  [
    "manager shell provides XSTEAM responsive navigation",
    function () {
      assert.match(index, /id="app-sidebar"/);
      assert.match(index, /id="sidebar-toggle"/);
      assert.match(index, /id="contextual-bar"/);
      assert.match(index, /aria-controls="app-sidebar"/);
      assert.match(index, /XS-Team-Alternativa-Horizontal-Cor\.svg/);
      assert.match(index, /XS-Team-Símbolo-Principal-Cor\.svg/);
      assert.match(style, /#D9FF2F/i);
      assert.match(style, /@media\s*\(max-width:\s*1023px\)/);
      assert.match(style, /@media\s*\(max-width:\s*700px\)/);
      assert.match(script, /function\s+toggleSidebar\s*\(/);
      assert.match(script, /function\s+setContextualPage\s*\(/);
      ["--type-display", "--type-title", "--type-body", "--type-meta"].forEach(function (token) {
        assert.match(style, new RegExp(token));
      });
      assert.match(style, /\.section-heading h2\s*\{[^}]*font-size:\s*var\(--type-title\)/);
    },
  ],
];

let failures = 0;
tests.forEach(function (test) {
  try {
    test[1]();
    console.log("PASS " + test[0]);
  } catch (error) {
    failures += 1;
    console.error("FAIL " + test[0]);
    console.error(error.message);
  }
});

process.exitCode = failures ? 1 : 0;
