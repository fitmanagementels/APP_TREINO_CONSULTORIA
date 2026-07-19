const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
const style = fs.readFileSync(path.join(root, "app", "style.html"), "utf8");

const tests = [
  ["student PWA keeps the dark athletic visual system", () => {
    ["--neon:", "--blue:", "--purple:", "--red:"].forEach((token) => assert.match(style, new RegExp(token)));
    assert.match(style, /radial-gradient/);
    assert.match(style, /linear-gradient\(90deg,var\(--blue\),var\(--purple\),var\(--red\)\)/);
  }],
  ["student navigation and cards have mobile-safe styling", () => {
    [".student-nav", ".exercise-card", ".history-card", ".modal-backdrop"].forEach((selector) => assert.match(style, new RegExp(selector.replace(".", "\\."))));
    assert.match(style, /max-width:560px/);
  }],
  ["read-only fiche and history details remain touch-friendly", () => {
    [".history-button", ".history-detail-exercise", ".ficha-readonly", ".ficha-exercise"].forEach((selector) => assert.match(style, new RegExp(selector.replace(".", "\\."))));
  }],

  ["PSE and RIR controls use a compact intensity scale", () => {
    assert.match(script, /pse-range/);
    assert.match(script, /RIR_OPTIONS/);
    assert.match(style, /input\[type=range\]/);
  }]
];

let failed = 0;
tests.forEach(([name, run]) => {
  try { run(); console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name); console.error(error.message); }
});
if (failed) process.exit(1);
