const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
const index = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");

test("active PWA source uses only same-origin Cloudflare API routes", () => {
  assert.doesNotMatch(script, /google\.script/);
  assert.doesNotMatch(script, /buildActionUrl/);
  assert.match(script, /getInitialData:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/bootstrap"/);
  assert.match(script, /getAppStatus:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/status"/);
  assert.match(script, /getPrescricao:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/prescriptions"/);
  assert.match(script, /getPrescriptionEditorData:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/prescription-editor"/);
  assert.match(script, /getExecucao:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/executions"/);
  assert.match(script, /getGestaoCarga:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/load"/);
  assert.match(script, /syncExecucao:\s*\{\s*method:\s*"POST",\s*path:\s*"\/api\/executions\/sync"/);
  assert.match(script, /savePrescricaoTreino/);
  assert.match(script, /callApi:\s*function callApi/);
  assert.doesNotMatch(script, /callServer/);
  assert.match(script, /credentials:\s*"same-origin"/);
  assert.match(index, /window\.__XS_BOOTSTRAP__ = null;/);
  assert.doesNotMatch(index, /getInitialAppDataJson\(\)/);
  assert.doesNotMatch(index, /include\('/);
});
