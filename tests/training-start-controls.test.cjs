const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs
  .readFileSync(path.join(root, "app", "script.html"), "utf8")
  .replace(/^\s*<script>\s*/, "")
  .replace(/\s*<\/script>\s*$/, "");
const context = {
  console,
  setTimeout,
  clearTimeout,
  document: {
    readyState: "loading",
    addEventListener() {},
  },
};
vm.createContext(context);
vm.runInContext(source, context);

test("date helpers cross month and year without UTC drift", () => {
  assert.equal(context.xsShiftDateKey("2026-01-31", 1), "2026-02-01");
  assert.equal(context.xsShiftDateKey("2026-01-01", -1), "2025-12-31");
  assert.equal(
    context.xsDateKey(context.xsParseDateKey("2026-09-01")),
    "2026-09-01",
  );
});
