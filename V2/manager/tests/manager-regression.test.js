const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "app", "Codigo.gs"), "utf8");
const index = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const manifest = fs.readFileSync(path.join(root, "app", "appscript.json"), "utf8");
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
  ],];

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
