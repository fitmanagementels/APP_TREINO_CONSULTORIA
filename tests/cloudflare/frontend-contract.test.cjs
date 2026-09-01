const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const script = fs.readFileSync(path.join(root, "app", "script.html"), "utf8");
const index = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const wranglerExample = fs.readFileSync(path.join(root, "wrangler.jsonc.example"), "utf8");

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

test("Prescrever offers a same-origin reference catalog update without browser sheet access", () => {
  assert.match(index, /id="prescrever-sync-catalog-btn"/);
  assert.match(index, /id="prescrever-catalog-sync-status"/);
  assert.match(script, /getCatalogStatus:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/catalog\/status"/);
  assert.match(script, /syncCatalog:\s*\{\s*method:\s*"POST",\s*path:\s*"\/api\/catalog\/sync"/);
  assert.match(script, /syncCatalogFromReference:\s*function/);
  assert.doesNotMatch(script, /docs\.google\.com\/spreadsheets/);
});

test("PWA starts only after a Google-backed Worker session is confirmed", () => {
  assert.match(index, /id="google-login-overlay"/);
  assert.match(index, /id="google-login-button"/);
  assert.match(script, /var Auth\s*=/);
  assert.match(script, /\/api\/auth\/session/);
  assert.match(script, /\/api\/auth\/config/);
  assert.match(script, /\/api\/auth\/google/);
  assert.match(index, /Auth\.logout\(\)/);
  assert.match(script, /logout:\s*function/);
  assert.match(script, /bootInitialized:\s*false/);
  assert.match(script, /if \(this\.bootInitialized\)/);
  assert.match(script, /google\.accounts\.id\.initialize/);
  assert.match(script, /Auth\.init\(\)\.then/);
});

test("only the public Google client id belongs in the Worker config template", () => {
  assert.match(wranglerExample, /GOOGLE_CLIENT_ID/);
  assert.doesNotMatch(wranglerExample, /ALLOWED_GOOGLE_EMAIL|SESSION_SECRET/);
});

test("Treino has explicit start and active session states", () => {
  assert.match(index, /id="treino-start-panel"/);
  assert.match(index, /id="treino-mode-prescribed"/);
  assert.match(index, /id="treino-mode-free"/);
  assert.match(index, /id="treino-start-btn"/);
  assert.match(index, /id="treino-active-panel"/);
  assert.match(index, /id="treino-active-summary"/);
  assert.match(script, /getActiveTrainingSession:\s*\{\s*method:\s*"GET"/);
  assert.match(script, /startTrainingSession:\s*\{\s*method:\s*"POST"/);
  assert.match(script, /activeTrainingSession:\s*null/);
  assert.match(script, /trainingMode:\s*"prescribed"/);
  assert.match(script, /renderTrainingStart:\s*function/);
  assert.match(script, /renderActiveTrainingSession:\s*function/);
  assert.match(script, /loadActiveTrainingSession:\s*function/);
});

test("training start orders mode, prescribed context, date navigator and CTA", () => {
  const mode = index.indexOf('class="training-mode-selector"');
  const context = index.indexOf('id="training-prescribed-context"');
  const date = index.indexOf('id="training-date-navigator"');
  const start = index.indexOf('id="treino-start-btn"');
  assert.ok(mode > -1);
  assert.ok(context > mode);
  assert.ok(date > context);
  assert.ok(start > date);
  assert.match(index, /id="training-ficha-trigger"/);
  assert.match(index, /id="training-treino-trigger"/);
  assert.match(index, /id="training-cycle-trigger"/);
  assert.match(index, /id="training-date-previous"/);
  assert.match(index, /id="training-date-open"/);
  assert.match(index, /id="training-date-next"/);
});

test("active training sessions save offline drafts with RER and complete through PSE", () => {
  assert.match(script, /saveActiveTrainingDraftLocal:\s*function/);
  assert.match(script, /writeCache\("xs_active_training_session"/);
  assert.match(script, /scheduleTrainingDraftSync:\s*function/);
  assert.match(script, /flushTrainingDraft:\s*function/);
  assert.match(script, /catalogMode\s*=\s*"training-session"/);
  assert.match(script, /step="0\.5"[^\n]*placeholder="RER"/);
  assert.match(index, /id="training-complete-modal"/);
  assert.match(index, /id="training-session-pse"/);
  assert.match(index, /id="training-completion-review"/);
  assert.match(script, /completeActiveTrainingSession:\s*function/);
  assert.match(script, /cancelActiveTrainingSession:\s*function/);
  assert.match(script, /reconcileTrainingSession:\s*function/);
});
