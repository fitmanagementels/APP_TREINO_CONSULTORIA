const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "app", "Codigo.gs"), "utf8");
const index = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const manifest = fs.readFileSync(path.join(root, "app", "appscript.json"), "utf8");

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
