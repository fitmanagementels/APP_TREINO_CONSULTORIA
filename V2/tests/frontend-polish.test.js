const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
const style = fs.readFileSync(path.join(root, "app", "style.html"), "utf8");

const tests = [
  [
    "main app stylesheet should include premium athletic polish tokens",
    () => {
      assert.match(style, /--surface-gradient:/);
      assert.match(style, /--shadow-elevated:/);
      assert.match(style, /--brand-light-ray:/);
      assert.match(style, /body::before/);
      assert.match(
        style,
        /linear-gradient\(135deg,\s*var\(--neon\),\s*var\(--neon-soft\)/,
      );
    },
  ],
  [
    "background light should vary by active tab",
    () => {
      assert.match(script, /document\.body\.setAttribute\("data-screen", screenId\)/);
      ["treino", "prescricao", "prescrever", "historico", "carga"].forEach(
        (screen) => {
          assert.match(
            style,
            new RegExp('body\\[data-screen="' + screen + '"\\]'),
          );
        },
      );
      assert.match(style, /--ambient-light:/);
      assert.match(style, /background:\s*var\(--ambient-light\)/);
    },
  ],
];

let failed = 0;
for (const testCase of tests) {
  const name = testCase[0];
  const run = testCase[1];
  try {
    run();
    console.log("PASS " + name);
  } catch (error) {
    failed++;
    console.error("FAIL " + name);
    console.error(error.message);
  }
}

if (failed > 0) process.exit(1);
