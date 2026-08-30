# Reference Exercise Catalog Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public exercise-reference sheet the exclusive catalog source, mirrored into D1 through a manual authenticated action and a daily Cloudflare schedule.

**Architecture:** A focused Worker module downloads and validates the fixed public CSV, hashes it, and atomically mirrors valid rows into D1. The PWA and all prescription validation continue to read only D1; a Prescrever control invokes the same synchronizer used by the daily `scheduled` handler.

**Tech Stack:** Cloudflare Workers, D1, Cron Triggers, Web Crypto SHA-256, public Google Sheets CSV export, Vitest/Miniflare, existing static HTML/CSS/JavaScript PWA.

## Global Constraints

- The source is read-only and fixed to the approved public CSV export; never add Google credentials or a browser-selected source URL.
- Keep Google Sheets out of the PWA runtime and out of the operational data path; only Worker synchronization reads it.
- Catalog records absent from a valid source are inactivated, never physically deleted.
- Only `is_active = 1` exercises may be selected or saved in current prescriptions.
- Preserve every `execution_records` row exactly as stored.
- Apply only these approved one-time prescription substitutions on the first successful source synchronization:
  - `Agachamento livre com barra nas costas` → `Agachamento com barra livre`
  - `Desenvolvimento com halter` → `Desenvolvimento com halteres sentado`
- A malformed, duplicate, incomplete, or out-of-range source must leave the prior active catalog intact.
- All new `/api/*` routes inherit the existing Google-session protection.
- Keep the Worker under the free-plan workload: daily cron, hash no-op on unchanged source, and no catalog work during app boot.
- Use `bash scripts/git-workspace.sh` for every Git action; local `wrangler.jsonc` remains ignored and never gets committed.
- Use Node `24.19.0` via `/home/elohimlima/.nvm/nvm.sh` for Wrangler and tests.

## File Structure

| File | Responsibility |
| --- | --- |
| `worker/migrations/0002_reference_catalog.sql` | Adds source metadata, active status and one-row synchronization state. |
| `worker/src/catalog.js` | Parses the public CSV, validates it, hashes it, updates D1 and returns status. |
| `worker/src/prescriptions.js` | Reads and validates only active catalog exercises. |
| `worker/src/index.js` | Exposes authenticated catalog routes and the daily scheduled handler. |
| `wrangler.jsonc` (ignored) | Adds the real daily cron trigger to the deployed Worker. |
| `wrangler.jsonc.example` | Documents the same cron shape without database ID or secrets. |
| `wrangler.test.json` | Uses the migration in Miniflare tests. |
| `app/index.html`, `app/script.html`, `app/style.html` | Adds the Prescrever sync control and status feedback. |
| `tests/cloudflare/catalog.test.mjs` | Parser, hash, atomic sync, mapping and inactivation tests. |
| `tests/cloudflare/prescriptions-*.test.mjs` | Active-only catalog read/write regression tests. |
| `tests/cloudflare/catalog-routes.test.mjs` | Session-protected manual route and scheduled handler tests. |
| `tests/cloudflare/frontend-contract.test.cjs` | Static PWA control and same-origin route contract. |
| `docs/guias-operacionais/07-catalogo-referencia-exercicios.md` | Operator instructions and failure recovery. |

---

### Task 1: Add D1 support for a source-controlled catalog

**Files:**
- Create: `worker/migrations/0002_reference_catalog.sql`
- Modify: `wrangler.test.json`
- Modify: `tests/cloudflare/schema.test.mjs`

**Interfaces:**
- Produces columns `video_url`, `categoria_articular`, `is_active`, `source_updated_at` on `exercise_catalog`.
- Produces `catalog_sync_state` with singleton row `id = 1`.

- [ ] **Step 1: Write the failing schema test.**

```js
it("stores catalog source metadata and one synchronization state row", async () => {
  const state = await env.DB.prepare("SELECT id, source_hash, active_exercise_count FROM catalog_sync_state WHERE id = 1").first();
  await env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio, video_url, categoria_articular, is_active, source_updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind("Supino reto", "https://video.example/supino", "Multiarticular", 1, "2026-08-30T00:00:00.000Z").run();
  const row = await env.DB.prepare("SELECT video_url, categoria_articular, is_active FROM exercise_catalog WHERE id_exercicio = ?").bind("Supino reto").first();
  expect(state).toEqual(expect.objectContaining({ id: 1, source_hash: "", active_exercise_count: 0 }));
  expect(row).toEqual({ video_url: "https://video.example/supino", categoria_articular: "Multiarticular", is_active: 1 });
});
```

- [ ] **Step 2: Run the schema test and confirm it fails because the columns/table do not exist.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/schema.test.mjs
```

Expected: FAIL with `no such table: catalog_sync_state` or a missing-column error.

- [ ] **Step 3: Add the migration.**

```sql
ALTER TABLE exercise_catalog ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
ALTER TABLE exercise_catalog ADD COLUMN categoria_articular TEXT NOT NULL DEFAULT '';
ALTER TABLE exercise_catalog ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE exercise_catalog ADD COLUMN source_updated_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_exercise_catalog_active_name
  ON exercise_catalog (is_active, id_exercicio COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS catalog_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source_hash TEXT NOT NULL DEFAULT '',
  last_attempt_at TEXT NOT NULL DEFAULT '',
  last_success_at TEXT NOT NULL DEFAULT '',
  active_exercise_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO catalog_sync_state (id) VALUES (1);
```

Keep `wrangler.test.json` pointed at `worker/migrations`; `applyD1Migrations` in `tests/cloudflare/setup.mjs` will apply the new file automatically.

- [ ] **Step 4: Run the focused test and then the Worker suite.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/schema.test.mjs && npm test
```

Expected: PASS, including all existing Worker tests.

- [ ] **Step 5: Commit.**

```bash
bash scripts/git-workspace.sh add worker/migrations/0002_reference_catalog.sql tests/cloudflare/schema.test.mjs
bash scripts/git-workspace.sh commit -m "feat: add source catalog schema"
```

### Task 2: Build and test the catalog parser and synchronizer

**Files:**
- Create: `worker/src/catalog.js`
- Create: `tests/cloudflare/catalog.test.mjs`

**Interfaces:**
- Exports `REFERENCE_CATALOG_CSV_URL` with the fixed approved CSV export URL.
- Exports `CatalogSyncError` with `{ code, message }`.
- Exports `parseReferenceCatalogCsv(csvText): Array<{ id_exercicio, video_url, grupo_principal, categoria_articular, tipo, demands }>`.
- Exports `syncReferenceCatalog({ db, fetchReference, now }): Promise<{ changed, activeExerciseCount, substitutionsApplied, lastSuccessAt }>`.
- Exports `getCatalogSyncStatus(db): Promise<{ lastAttemptAt, lastSuccessAt, activeExerciseCount, lastError }>`.

- [ ] **Step 1: Write failing parser/sync tests.**

Create a fixture in the test file with the exact source headers and two rows, including `"0,5"` demand values and an empty `Tipo`.

```js
it("normalizes the public sheet columns and Brazilian decimal demands", () => {
  expect(parseReferenceCatalogCsv(csvFixture)).toEqual([
    expect.objectContaining({
      id_exercicio: "Agachamento com barra livre",
      grupo_principal: "Quadríceps",
      categoria_articular: "Multiarticular",
      tipo: "",
      demands: expect.objectContaining({ Glúteos: 1, Quadríceps: 1, Eretores: 0.25 }),
    }),
  ]);
});

it("rejects duplicate names and leaves D1 unchanged", async () => {
  await expect(syncReferenceCatalog({ db: env.DB, fetchReference: async () => csvResponse(duplicateFixture), now: fixedNow }))
    .rejects.toMatchObject({ code: "INVALID_REFERENCE_CATALOG" });
  expect(await activeCatalogNames()).toEqual(["Catálogo anterior"]);
});

it("maps the approved first-sync prescription names, inactivates absent catalog rows, and preserves executions", async () => {
  await seedOldCatalogAndRecords();
  const result = await syncReferenceCatalog({ db: env.DB, fetchReference: async () => csvResponse(csvFixture), now: fixedNow });
  expect(result).toMatchObject({ changed: true, activeExerciseCount: 2, substitutionsApplied: 2 });
  expect(await prescriptionNames()).toContain("Agachamento com barra livre");
  expect(await inactiveCatalogNames()).toContain("Exercício removido");
  expect(await executionNames()).toContain("Agachamento livre com barra nas costas");
});

it("does not write catalog rows when the source hash is unchanged", async () => {
  await syncReferenceCatalog({ db: env.DB, fetchReference: async () => csvResponse(csvFixture), now: fixedNow });
  const second = await syncReferenceCatalog({ db: env.DB, fetchReference: async () => csvResponse(csvFixture), now: laterNow });
  expect(second.changed).toBe(false);
  expect((await getCatalogSyncStatus(env.DB)).lastSuccessAt).toBe(fixedNow.toISOString());
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because `catalog.js` is absent.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/catalog.test.mjs
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement strict CSV parsing and validation in `worker/src/catalog.js`.**

Implement a character-by-character CSV parser compatible with quoted Google export cells. Normalize headers by removing BOM, accents and punctuation. Require `exercicio`, `grupo_muscular`, `n_articulacao`; accept `tipo` and `link_do_video` as optional. Treat every header after the five metadata columns as a muscle, parse `0,5` as `0.5`, and reject values outside `0..1`.

Use this fixed constant:

```js
export const REFERENCE_CATALOG_CSV_URL = "https://docs.google.com/spreadsheets/d/1ukUCtws2hV2_PW7JzduQV4cr_EcqVC6-EoHzut1KS0Y/export?format=csv&gid=139666673";
```

Hash the exact CSV text using Web Crypto:

```js
async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
```

Before a changed-source batch, update only the two approved old prescription names when `last_success_at` is empty. Then mark every catalog row inactive, upsert all validated source rows with `is_active = 1`, delete/reinsert each active row's muscle-demand rows, and update `catalog_sync_state` with the new hash and success data in one `db.batch`. On validation/fetch failure, write only `last_attempt_at` and `last_error` in a separate statement, then throw `CatalogSyncError`; do not touch catalog/prescription rows.

- [ ] **Step 4: Run focused tests and the whole Worker suite.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/catalog.test.mjs && npm test
```

Expected: PASS, including the unchanged-hash, first-sync mapping and invalid-source cases.

- [ ] **Step 5: Commit.**

```bash
bash scripts/git-workspace.sh add worker/src/catalog.js tests/cloudflare/catalog.test.mjs
bash scripts/git-workspace.sh commit -m "feat: sync reference exercise catalog into D1"
```

### Task 3: Make prescriptions and editor data active-catalog only

**Files:**
- Modify: `worker/src/prescriptions.js`
- Modify: `tests/cloudflare/prescriptions-read.test.mjs`
- Modify: `tests/cloudflare/prescriptions-write.test.mjs`

**Interfaces:**
- `getDemandaMuscularData(db)` returns only active rows and includes `video_url` and `categoria_articular` in each catalog row.
- `getPrescricaoData(db)` excludes prescription rows whose catalog entry is inactive.
- `savePrescricaoTreino(...)` rejects catalog rows where `is_active = 0` with existing `INVALID_EXERCISE` response.

- [ ] **Step 1: Add failing active/inactive regression tests.**

```js
it("does not expose inactive catalog or prescription rows", async () => {
  await env.DB.prepare("UPDATE exercise_catalog SET is_active = 0 WHERE id_exercicio = ?").bind("Crucifixo").run();
  const { body } = await request("/api/prescription-editor");
  expect(body.data.catalogo.rows.map((row) => row.id_exercicio)).toEqual(["Supino reto"]);
  expect(body.data.prescricao.rows.map((row) => row.id_exercicio)).toEqual(["Supino reto"]);
});

it("rejects an inactive source exercise without replacing the current treino", async () => {
  await env.DB.prepare("UPDATE exercise_catalog SET is_active = 0 WHERE id_exercicio = ?").bind("Crucifixo").run();
  const result = await save("Ficha A", "Treino A", [{ id_exercicio: "Crucifixo" }]);
  expect(result.status).toBe(422);
  expect(result.body.code).toBe("INVALID_EXERCISE");
});
```

- [ ] **Step 2: Run the focused tests and confirm they fail.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/prescriptions-read.test.mjs tests/cloudflare/prescriptions-write.test.mjs
```

Expected: FAIL because the current queries do not filter `is_active`.

- [ ] **Step 3: Update read and save queries.**

Use an inner join for visible prescription rows:

```sql
FROM prescription_exercises AS prescription
INNER JOIN exercise_catalog AS catalog
  ON catalog.id_exercicio = prescription.id_exercicio
 AND catalog.is_active = 1
```

For `getDemandaMuscularData`, add `WHERE is_active = 1` to the catalog query and select `video_url, categoria_articular`; add those two fields to every returned catalog row. For `savePrescricaoTreino`, change catalog lookup to:

```sql
SELECT id_exercicio FROM exercise_catalog
WHERE is_active = 1 AND id_exercicio IN (?, ...)
```

- [ ] **Step 4: Run focused and full Worker tests.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/prescriptions-read.test.mjs tests/cloudflare/prescriptions-write.test.mjs && npm test
```

Expected: PASS with inactive records unavailable for current prescription and editor.

- [ ] **Step 5: Commit.**

```bash
bash scripts/git-workspace.sh add worker/src/prescriptions.js tests/cloudflare/prescriptions-read.test.mjs tests/cloudflare/prescriptions-write.test.mjs
bash scripts/git-workspace.sh commit -m "feat: restrict prescriptions to active catalog"
```

### Task 4: Add protected routes and scheduled synchronization

**Files:**
- Modify: `worker/src/index.js`
- Create: `tests/cloudflare/catalog-routes.test.mjs`
- Modify: `wrangler.test.json`
- Modify: `wrangler.jsonc.example`
- Modify: `wrangler.jsonc` (ignored; local deploy configuration only)

**Interfaces:**
- `POST /api/catalog/sync` returns `{ success: true, data: SyncResult }` only with a valid Google session.
- `GET /api/catalog/status` returns `{ success: true, data: CatalogSyncStatus }` only with a valid Google session.
- `worker.scheduled(controller, env, ctx)` calls `syncReferenceCatalog({ db: env.DB })` and forwards the promise to `ctx.waitUntil`.
- Daily cron expression is `0 4 * * *` (04:00 UTC).

- [ ] **Step 1: Write failing route and schedule tests.**

Use `createWorker({ syncReferenceCatalog: fakeSync, getCatalogSyncStatus: fakeStatus })` so no test contacts Google.

```js
it("blocks catalog sync before authentication", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/catalog/sync", { method: "POST" }), env, {});
  expect(response.status).toBe(401);
});

it("runs the same synchronizer from the manual route and daily handler", async () => {
  const syncReferenceCatalog = vi.fn().mockResolvedValue({ changed: true, activeExerciseCount: 2 });
  const testWorker = createWorker({ syncReferenceCatalog, getCatalogSyncStatus: vi.fn() });
  const response = await testWorker.fetch(authenticatedPost("/api/catalog/sync"), env, {});
  const waitUntil = vi.fn();
  await testWorker.scheduled({}, env, { waitUntil });
  expect(response.status).toBe(200);
  expect(syncReferenceCatalog).toHaveBeenCalledTimes(2);
  expect(waitUntil).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the test and confirm it fails because routes/scheduled are absent.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/catalog-routes.test.mjs
```

Expected: FAIL with route `NOT_FOUND` and missing `scheduled` handler.

- [ ] **Step 3: Wire dependency injection, routes and cron configuration.**

Extend `createWorker(options = {})` with `syncCatalog = options.syncReferenceCatalog || syncReferenceCatalog` and `catalogStatus = options.getCatalogSyncStatus || getCatalogSyncStatus`. Add the authenticated `GET /api/catalog/status` and `POST /api/catalog/sync` branches after authentication middleware. Return the existing JSON envelope and let `CatalogSyncError` use a 422 envelope with its code/message.

Return a `scheduled` function from the Worker object:

```js
scheduled(controller, env, ctx) {
  ctx.waitUntil(syncCatalog({ db: env.DB }));
},
```

Add this object to both configuration files; in ignored `wrangler.jsonc` preserve all existing bindings, real database ID and Google client ID:

```json
"triggers": {
  "crons": ["0 4 * * *"]
},
```

- [ ] **Step 4: Run focused and full Worker tests.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/catalog-routes.test.mjs && npm test
```

Expected: PASS; a missing session remains a 401 and schedule calls the shared synchronizer.

- [ ] **Step 5: Commit only versioned files.**

```bash
bash scripts/git-workspace.sh add worker/src/index.js tests/cloudflare/catalog-routes.test.mjs wrangler.test.json wrangler.jsonc.example
bash scripts/git-workspace.sh commit -m "feat: add catalog sync API and daily schedule"
```

### Task 5: Add the lightweight Prescrever sync control

**Files:**
- Modify: `app/index.html`
- Modify: `app/script.html`
- Modify: `app/style.html`
- Modify: `tests/cloudflare/frontend-contract.test.cjs`
- Modify: `tests/app-regression.test.js`

**Interfaces:**
- `SERVER_ROUTES.getCatalogStatus` is `GET /api/catalog/status`.
- `SERVER_ROUTES.syncCatalog` is `POST /api/catalog/sync`.
- `App.loadCatalogSyncStatus()`, `App.renderCatalogSyncStatus()` and `App.syncCatalogFromReference()` operate only from Prescrever.

- [ ] **Step 1: Add failing static-source assertions.**

```js
test("Prescrever offers a same-origin reference catalog update without adding sheet access to the browser", () => {
  assert.match(index, /id="prescrever-sync-catalog-btn"/);
  assert.match(index, /id="prescrever-catalog-sync-status"/);
  assert.match(script, /getCatalogStatus:\s*\{\s*method:\s*"GET",\s*path:\s*"\/api\/catalog\/status"/);
  assert.match(script, /syncCatalog:\s*\{\s*method:\s*"POST",\s*path:\s*"\/api\/catalog\/sync"/);
  assert.match(script, /syncCatalogFromReference:\s*function/);
  assert.doesNotMatch(script, /docs\.google\.com\/spreadsheets/);
});
```

- [ ] **Step 2: Run source tests and confirm they fail.**

Run:

```bash
node tests/cloudflare/frontend-contract.test.cjs && node tests/app-regression.test.js
```

Expected: FAIL because the control/routes are absent.

- [ ] **Step 3: Implement the control without changing boot.**

Add a compact button adjacent to **Salvar treino** and a small status line in `#screen-prescrever`. Add `catalogSyncStatus: null` and `catalogSyncInProgress: false` to `App`.

`loadPrescrever` must call `loadCatalogSyncStatus()` only after the existing editor payload path; never call it during `App.init` or `fetchInitialData`. `syncCatalogFromReference` disables the button, calls `callApi("syncCatalog")`, then reloads status and editor data, refreshes `catalogoCache`, `prescricaoCache`, filters and the editor view. On failure it preserves current cache and shows `showToast(error.message || "Não foi possível atualizar o catálogo", "error")`.

Render text as `Catálogo atualizado em DD/MM/AAAA HH:MM` when there is success, `Catálogo ainda não sincronizado` before the first success, and an error note only when `lastError` is nonempty. Keep the frontend's conservative syntax: `var`, function expressions, no optional chaining, no template literals and no trailing commas.

- [ ] **Step 4: Build assets and run all frontend tests.**

Run:

```bash
npm run assets:build && node tests/cloudflare/frontend-contract.test.cjs && node tests/app-regression.test.js && node tests/frontend-polish.test.js && node tests/cloudflare/assets-build.test.cjs
```

Expected: PASS; generated `worker/public` remains ignored.

- [ ] **Step 5: Commit.**

```bash
bash scripts/git-workspace.sh add app/index.html app/script.html app/style.html tests/cloudflare/frontend-contract.test.cjs tests/app-regression.test.js
bash scripts/git-workspace.sh commit -m "feat: add reference catalog sync control"
```

### Task 6: Deploy safely, perform first sync and document operation

**Files:**
- Create: `docs/guias-operacionais/07-catalogo-referencia-exercicios.md`
- Modify: `docs/RESUMO_PROJETO.md`

**Interfaces:**
- The guide gives the public-source URL, expected first-sync results, manual retry and the rule that only the reference sheet may define new exercises.

- [ ] **Step 1: Write the operator guide before deploy.**

Document these exact actions:

1. Do not edit D1 directly to add catalog exercises.
2. Edit the public reference sheet and wait for the daily job, or open Prescrever and click **Atualizar catálogo** for immediate import.
3. Confirm last-update status and that the new exercise appears in the selector.
4. If an import fails, keep the sheet public, correct duplicate/header/demand data and retry; do not delete D1 data.
5. On first sync, confirm the two approved substitutions and that the execution history retains original names.

- [ ] **Step 2: Apply the migration to the remote D1 before deploying Worker code.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npx wrangler d1 migrations apply xsteam-pwa-staging --remote
```

Expected: migration `0002_reference_catalog.sql` applies once with no SQL errors.

- [ ] **Step 3: Run complete verification, deploy and check unauthenticated safety.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test && npm run assets:build && npm run deploy
curl -sS -o /tmp/xsteam-catalog-auth.json -w '%{http_code}\n' https://xsteam-pwa.fitmanagement-els.workers.dev/api/catalog/status
```

Expected: every test passes, deployment succeeds, and status endpoint returns `401` before login.

- [ ] **Step 4: Perform and verify first source sync from the authenticated PWA.**

Open `https://xsteam-pwa.fitmanagement-els.workers.dev`, sign in, go to **Prescrever**, click **Atualizar catálogo**, then verify the status line. Run read-only remote checks:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npx wrangler d1 execute xsteam-pwa-staging --remote --json --command="SELECT COUNT(*) AS active_count FROM exercise_catalog WHERE is_active = 1;"
npx wrangler d1 execute xsteam-pwa-staging --remote --json --command="SELECT id_exercicio FROM prescription_exercises WHERE id_exercicio IN ('Agachamento com barra livre', 'Desenvolvimento com halteres sentado') ORDER BY id_exercicio;"
npx wrangler d1 execute xsteam-pwa-staging --remote --json --command="SELECT COUNT(*) AS count FROM execution_records WHERE id_exercicio IN ('Agachamento livre com barra nas costas', 'Desenvolvimento com halter');"
```

Expected: 89 active catalog rows from the current source, both replacement names in active prescriptions, and historical execution rows unchanged if they existed.

- [ ] **Step 5: Commit documentation and record deployed validation.**

```bash
bash scripts/git-workspace.sh add docs/guias-operacionais/07-catalogo-referencia-exercicios.md docs/RESUMO_PROJETO.md
bash scripts/git-workspace.sh commit -m "docs: add reference catalog operation guide"
```

## Plan Self-Review

| Specification requirement | Plan task |
| --- | --- |
| Fixed public sheet, no Google credentials/browser fetch | 2, 4, 5 |
| D1 mirror with source metadata and hash | 1, 2 |
| Manual and daily sync using one function | 2, 4, 5 |
| Only reference exercises available for prescriptions | 3 |
| Approved first-sync substitutions and immutable history | 2, 6 |
| Invalid source leaves catalog intact | 2 |
| Lightweight UI and no boot regression | 5 |
| Free-plan conscious cron/no-op behavior | 2, 4 |
| Remote migration, deployment and operator procedure | 6 |
