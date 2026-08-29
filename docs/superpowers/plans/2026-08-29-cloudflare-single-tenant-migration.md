# Cloudflare Single-Tenant PWA Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing five-screen training PWA on Cloudflare Workers with a single D1 database, preserving offline synchronization while eliminating Apps Script and Google Sheets from production.

**Architecture:** A Worker serves compiled static copies of the existing HTML/CSS/JS and exposes a same-origin `/api/*` JSON API. D1 holds the exercise catalog, prescriptions and executions; load is calculated from executions and is never written during boot. Production is protected by Cloudflare Access for one authorized operational email, not by a secret embedded in browser code.

**Tech Stack:** Cloudflare Workers Static Assets, Cloudflare D1 (SQLite), Wrangler 4, JavaScript ES modules, Vitest with `@cloudflare/vitest-plugin`, existing browser JavaScript and Node built-in assertion tests.

## Global Constraints

- Preserve all current screens: Treino, Prescrição, Prescrever, Histórico and Carga.
- Keep the PWA offline-first. `xs_pending` remains the client-side queue until the API confirms accepted session IDs.
- Keep `id_sessao` as the unique idempotency key for execution synchronization.
- Replace only the selected `id_ficha + id_treino` atomically when saving a prescription.
- Keep `/api/bootstrap` limited to prescription and history; do not calculate or materialize load during boot.
- Do not implement application accounts, roles, multiple tenants, AI, R2, attachments or UI redesign in this migration.
- Do not publish data on a public unprotected production URL. Cloudflare Access must protect the production hostname before real data is used.
- Keep Google Sheets and Apps Script read-only as rollback sources until the production acceptance period ends; do not delete them.
- Never commit CSV exports, API tokens, D1 identifiers from production, `.dev.vars`, or Cloudflare credentials.

---

## Planned File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Local scripts and pinned development dependencies. |
| `worker/package.json` | Scopes ES modules to the Worker while preserving the legacy CommonJS test files at repository root. |
| `wrangler.jsonc.example` | Committed Worker, static asset and D1 binding template; contains no secrets or real resource IDs. |
| `wrangler.jsonc` | Ignored local active Worker configuration, created from the example once a D1 database exists. |
| `worker/src/index.js` | HTTP router, response normalization, static asset fallback and error boundary. |
| `worker/src/prescriptions.js` | D1 reads/writes for catalog and prescriptions. |
| `worker/src/executions.js` | D1 reads and idempotent execution upserts. |
| `worker/src/load.js` | Pure load/session calculation from execution records. |
| `worker/migrations/0001_initial_schema.sql` | D1 schema and indexes. |
| `worker/public/` | Generated static PWA assets only; never holds source-of-truth frontend files. |
| `scripts/build-cloudflare-assets.js` | Deterministic conversion of Apps Script includes into static assets. |
| `scripts/import-google-sheet-csv.js` | Validates and converts exported CSVs into parameterized D1 import batches. |
| `scripts/audit-migration.js` | Compares source manifests and D1 counts/keys before cutover. |
| `tests/cloudflare/*.test.mjs` | Worker-runtime integration tests against D1. |
| `tests/migration/*.test.js` | Node tests for CSV normalization, identity and audit rules. |
| `docs/guias-operacionais/` | Plain-language manual steps, created before staging and production gates. |

## API Contract Locked Before Implementation

All success responses have `{ "success": true, "data": <payload> }`; client errors have `{ "success": false, "error": <message>, "code": <code> }` and no stack trace.

| Route | Input | Required behavior |
|---|---|---|
| `GET /api/status` | none | Return `{ service: "xsteam-pwa", database: "ok", prescriptionRows, executionRows }`. |
| `GET /api/bootstrap` | none | Return `{ prescricao: { rows }, historico: { rows }, status, errors: [], error: "", updatedAt }`. |
| `GET /api/prescriptions` | none | Return `getPrescricaoData()` compatible `{ rows }`, ordered by ficha, treino and exercise order. |
| `GET /api/prescription-editor` | none | Return `{ catalogo, prescricao, fichas, treinosPorFicha, updatedAt }`. |
| `PUT /api/prescriptions/:idFicha/:idTreino` | `{ exercicios: [exercisePayload] }` | Validate every exercise against catalog; replace exactly that ficha+treino in one D1 batch/transaction. |
| `GET /api/executions` | none | Return `{ rows }` compatible execution history. |
| `POST /api/executions/sync` | `{ records: [executionRecord] }` | Validate all records; upsert by `id_sessao`; return `{ synced, acceptedSessionIds }`. |
| `GET /api/load` | none | Return `{ sessoes, e1rmByExercise, exercicios }`; never write a summary. |

## Task 1: Establish the Cloudflare project foundation

**Files:**
- Create: `package.json`
- Create: `wrangler.jsonc.example`
- Create locally and ignore: `wrangler.jsonc`
- Create: `worker/package.json`
- Create: `vitest.config.mjs`
- Create: `.gitignore`
- Create: `worker/src/index.js`
- Create: `tests/cloudflare/health.test.mjs`

**Interfaces:**
- Produces `Env` with `DB: D1Database` and `ASSETS: Fetcher` for all Worker modules.
- Produces `default.fetch(request, env, ctx)` for Workers runtime tests.

- [ ] **Step 1: Write the failing Worker health test.**

```js
import { describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";

describe("GET /api/status", () => {
  it("returns a stable JSON success envelope", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api/status"),
      { DB: { prepare() { throw new Error("DB should be added next"); } } },
      {},
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { service: "xsteam-pwa", database: "unavailable" },
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails because `worker/src/index.js` does not exist.**

Run: `npm test -- tests/cloudflare/health.test.mjs`  
Expected: FAIL with a module-not-found error.

- [ ] **Step 3: Add the exact project configuration and minimum router.**

`package.json` must contain:

```json
{
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "assets:build": "node scripts/build-cloudflare-assets.js",
    "dev": "npm run assets:build && wrangler dev",
    "deploy": "npm run assets:build && wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/vitest-plugin": "^1.0.0",
    "vitest": "^4.1.0",
    "wrangler": "^4.0.0"
  }
}
```

`wrangler.jsonc.example` must contain the binding names used in the plan. Copy it to the ignored active `wrangler.jsonc` before local development. The zero UUID is a harmless local-only value and is replaced only in the ignored active file after creating the remote D1 database:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "xsteam-pwa",
  "main": "worker/src/index.js",
  "compatibility_date": "2026-08-29",
  "assets": {
    "directory": "./worker/public",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "xsteam-pwa-staging",
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "worker/migrations"
    }
  ]
}
```

Do not commit a production database ID. Add `wrangler.jsonc` to `.gitignore`; commit `wrangler.jsonc.example` only. The active `wrangler.jsonc` begins as an exact copy of the example and receives the staging or production database ID only during the relevant manual gate.

`worker/src/index.js` must initially be:

```js
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/status") {
      return json({ success: true, data: { service: "xsteam-pwa", database: "unavailable" } });
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ success: false, code: "NOT_FOUND", error: "Rota não encontrada." }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
```

Use this `worker/package.json`:

```json
{
  "type": "module"
}
```

Use this `vitest.config.mjs`:

```js
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc.example" } })],
  test: { include: ["tests/cloudflare/**/*.test.mjs"] },
});
```

Add `.dev.vars`, `.wrangler/`, `wrangler.jsonc`, `worker/public/`, `data-import/`, `*.csv` and `.env*` to `.gitignore`, except `.env.example`.

- [ ] **Step 4: Install dependencies and run the new test.**

Run: `npm install && npm test -- tests/cloudflare/health.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit the independently runnable foundation.**

```bash
git add package.json package-lock.json wrangler.jsonc.example worker/package.json vitest.config.mjs .gitignore worker/src/index.js tests/cloudflare/health.test.mjs
git commit -m "chore: scaffold Cloudflare Worker foundation"
```

## Task 2: Build static PWA assets without Apps Script rendering

**Files:**
- Create: `scripts/build-cloudflare-assets.js`
- Create: `tests/cloudflare/assets-build.test.cjs`
- Generate: `worker/public/index.html`, `worker/public/app.js`, `worker/public/style.css`
- Modify: `package.json`

**Interfaces:**
- Consumes `app/index.html`, `app/script.html`, `app/style.html`.
- Produces static assets with no `<?!=`, `include(` or `getInitialAppDataJson()` expressions.

- [ ] **Step 1: Write the failing test that runs the generator into a temporary output directory and asserts the three Apps Script template expressions are absent.**

```js
assert.doesNotMatch(html, /<\?!=/);
assert.doesNotMatch(html, /include\('/);
assert.match(html, /<link rel="stylesheet" href="\/style\.css">/);
assert.match(html, /<script src="\/app\.js"><\/script>/);
assert.match(html, /window\.__XS_BOOTSTRAP__ = null;/);
```

- [ ] **Step 2: Run it to verify the build script is missing.**

Run: `node --test tests/cloudflare/assets-build.test.cjs`  
Expected: FAIL with `MODULE_NOT_FOUND` for `scripts/build-cloudflare-assets.js`.

- [ ] **Step 3: Implement the deterministic transformation.**

The script must read source files as UTF-8; remove only the outer `<style>` and `<script>` tags from their respective include files; replace `<?!= include('style'); ?>` with `<link rel="stylesheet" href="/style.css">`; replace `<?!= include('script'); ?>` with `<script src="/app.js"></script>`; and replace the bootstrap template line with `window.__XS_BOOTSTRAP__ = null;`. It must create `worker/public` recursively and write exactly `index.html`, `app.js`, and `style.css`.

- [ ] **Step 4: Preserve the Apps Script source tests while adding the static equivalent test.**

Run: `node tests/app-regression.test.js && node tests/frontend-polish.test.js && node --test tests/cloudflare/assets-build.test.cjs`  
Expected: all PASS.

- [ ] **Step 5: Start a local Worker and manually verify static delivery.**

Run: `npm run dev`  
Expected: Wrangler prints a local URL. Open `/`, then `/api/status`; the first returns the PWA shell and the second returns JSON.

- [ ] **Step 6: Commit the asset pipeline.**

```bash
git add scripts/build-cloudflare-assets.js tests/cloudflare/assets-build.test.cjs package.json .gitignore
git commit -m "build: serve PWA assets from Cloudflare Worker"
```

## Task 3: Add the D1 schema and migration verification

**Files:**
- Create: `worker/migrations/0001_initial_schema.sql`
- Create: `tests/cloudflare/schema.test.js`
- Modify: `worker/src/index.js`

**Interfaces:**
- Provides tables `exercise_catalog`, `exercise_muscle_demands`, `prescription_exercises`, `execution_records`.
- `env.DB.prepare(sql).bind(...values).run()` is the only query interface used by later modules.

- [ ] **Step 1: Write a failing D1 test that inserts one catalog row and one execution record, then calls `/api/status`.**

```js
const result = await env.DB.prepare(
  "INSERT INTO exercise_catalog (id_exercicio, grupo_principal, tipo) VALUES (?, ?, ?)",
).bind("Supino reto", "Peito", "Composto").run();
expect(result.success).toBe(true);
```

Assert that status returns `database: "ok"`, `prescriptionRows: 0` and `executionRows: 1` after inserting one valid execution record.

- [ ] **Step 2: Confirm it fails before the migration exists.**

Run: `npm test -- tests/cloudflare/schema.test.js`  
Expected: FAIL with `no such table`.

- [ ] **Step 3: Add this complete initial schema.**

```sql
CREATE TABLE IF NOT EXISTS exercise_catalog (
  id_exercicio TEXT PRIMARY KEY NOT NULL,
  grupo_principal TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS exercise_muscle_demands (
  id_exercicio TEXT NOT NULL REFERENCES exercise_catalog(id_exercicio),
  muscle_name TEXT NOT NULL,
  demand REAL NOT NULL CHECK (demand >= 0 AND demand <= 1),
  PRIMARY KEY (id_exercicio, muscle_name)
);

CREATE TABLE IF NOT EXISTS prescription_exercises (
  id_ficha TEXT NOT NULL,
  id_treino TEXT NOT NULL,
  id_exercicio TEXT NOT NULL REFERENCES exercise_catalog(id_exercicio),
  observacoes TEXT NOT NULL DEFAULT '',
  ordem_exercicio INTEGER NOT NULL CHECK (ordem_exercicio > 0),
  semana_1_sets TEXT NOT NULL DEFAULT '', semana_1_reps TEXT NOT NULL DEFAULT '', semana_1_descanso TEXT NOT NULL DEFAULT '',
  semana_2_sets TEXT NOT NULL DEFAULT '', semana_2_reps TEXT NOT NULL DEFAULT '', semana_2_descanso TEXT NOT NULL DEFAULT '',
  semana_3_sets TEXT NOT NULL DEFAULT '', semana_3_reps TEXT NOT NULL DEFAULT '', semana_3_descanso TEXT NOT NULL DEFAULT '',
  semana_4_sets TEXT NOT NULL DEFAULT '', semana_4_reps TEXT NOT NULL DEFAULT '', semana_4_descanso TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (id_ficha, id_treino, ordem_exercicio)
);

CREATE INDEX IF NOT EXISTS idx_prescription_lookup
  ON prescription_exercises (id_ficha, id_treino, ordem_exercicio);

CREATE TABLE IF NOT EXISTS execution_records (
  id_sessao TEXT PRIMARY KEY NOT NULL,
  data_treino TEXT NOT NULL,
  id_exercicio TEXT NOT NULL,
  semana_referencia TEXT NOT NULL DEFAULT '',
  carga_absoluta REAL NOT NULL DEFAULT 0,
  reps_executadas INTEGER NOT NULL DEFAULT 0,
  rir REAL NOT NULL DEFAULT 0,
  rpe_sessao REAL NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'clean',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_execution_date ON execution_records (data_treino);
CREATE INDEX IF NOT EXISTS idx_execution_exercise_date ON execution_records (id_exercicio, data_treino);
```

Update `/api/status` to execute `SELECT COUNT(*) AS count FROM prescription_exercises` and `SELECT COUNT(*) AS count FROM execution_records`; respond with `database: "ok"` only when both queries succeed.

- [ ] **Step 4: Apply and verify the migration locally.**

Run: `npx wrangler d1 migrations apply DB --local && npm test -- tests/cloudflare/schema.test.js`  
Expected: migration applies once and the test passes.

- [ ] **Step 5: Commit schema and status behavior.**

```bash
git add worker/migrations/0001_initial_schema.sql worker/src/index.js tests/cloudflare/schema.test.js
git commit -m "feat: add D1 schema for single-tenant PWA"
```

## Task 4: Implement catalog and read-only prescription API

**Files:**
- Create: `worker/src/prescriptions.js`
- Create: `tests/cloudflare/prescriptions-read.test.js`
- Modify: `worker/src/index.js`

**Interfaces:**
- Exports `getPrescricaoData(db)`, `getDemandaMuscularData(db)`, `getPrescriptionEditorData(db)`.
- `getPrescricaoData(db)` returns `{ rows: PrescriptionRow[] }` using the field names currently read by `app/script.html`.

- [ ] **Step 1: Write failing tests for order, normalized fields and editor grouping.**

Seed one catalog exercise and two prescription rows with orders `2` and `1`; assert `/api/prescriptions` returns order `1` then `2`. Assert `/api/prescription-editor` returns `fichas: ["Ficha A"]` and `treinosPorFicha: { "Ficha A": ["Treino A"] }`.

- [ ] **Step 2: Run the tests.**

Run: `npm test -- tests/cloudflare/prescriptions-read.test.js`  
Expected: FAIL with route-not-found responses.

- [ ] **Step 3: Implement queries using explicit columns, never `SELECT *`.**

Use this row projection in `getPrescricaoData`:

```sql
SELECT id_ficha, id_treino, id_exercicio, id_exercicio AS nome_exercicio,
       observacoes, ordem_exercicio,
       semana_1_sets, semana_1_reps, semana_1_descanso,
       semana_2_sets, semana_2_reps, semana_2_descanso,
       semana_3_sets, semana_3_reps, semana_3_descanso,
       semana_4_sets, semana_4_reps, semana_4_descanso
FROM prescription_exercises
ORDER BY id_ficha COLLATE NOCASE, id_treino COLLATE NOCASE, ordem_exercicio ASC
```

`getDemandaMuscularData(db)` must query catalog and demands, construct `{ rows, grupos, tipos, musculos }`, sort all three string lists with `localeCompare("pt-BR")`, and clamp no values because the database `CHECK` already enforces `[0,1]`.

- [ ] **Step 4: Add the three GET route branches and rerun every Worker test.**

Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit the catalog and read routes.**

```bash
git add worker/src/prescriptions.js worker/src/index.js tests/cloudflare/prescriptions-read.test.js
git commit -m "feat: add catalog and prescription read API"
```

## Task 5: Implement atomic prescription editing

**Files:**
- Modify: `worker/src/prescriptions.js`
- Modify: `worker/src/index.js`
- Create: `tests/cloudflare/prescriptions-write.test.js`

**Interfaces:**
- Exports `savePrescricaoTreino(db, idFicha, idTreino, payload)`.
- Input is `{ exercicios: Array<ExercisePayload> }`; output is `{ catalogo, prescricao, fichas, treinosPorFicha, updatedAt }`.

- [ ] **Step 1: Write failing tests for three essential protections.**

1. Unknown `id_exercicio` returns HTTP 422 with code `INVALID_EXERCISE` and makes no database change.
2. Saving `Ficha A/Treino A` does not alter the seeded `Ficha A/Treino B` row.
3. Saving two rows replaces previous `Ficha A/Treino A` rows and assigns `ordem_exercicio` `1` and `2`.

- [ ] **Step 2: Run the test and confirm all write requests return 404.**

Run: `npm test -- tests/cloudflare/prescriptions-write.test.js`  
Expected: FAIL with expected `422` or `200`, received `404`.

- [ ] **Step 3: Validate before writing, then use one D1 batch.**

Reject non-array `exercicios`, blank route IDs, duplicate `ordem_exercicio` values after normalization, and any catalog name not returned by:

```sql
const placeholders = normalizedExercises.map(() => "?").join(",");
const catalogQuery = `SELECT id_exercicio FROM exercise_catalog WHERE id_exercicio IN (${placeholders})`;
```

After validation, build this ordered D1 batch: first `DELETE FROM prescription_exercises WHERE id_ficha = ? AND id_treino = ?`, then one statement per exercise using this exact projection:

```sql
INSERT INTO prescription_exercises (
  id_ficha, id_treino, id_exercicio, observacoes, ordem_exercicio,
  semana_1_sets, semana_1_reps, semana_1_descanso,
  semana_2_sets, semana_2_reps, semana_2_descanso,
  semana_3_sets, semana_3_reps, semana_3_descanso,
  semana_4_sets, semana_4_reps, semana_4_descanso
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
```

Run `await db.batch(statements)` and then return `getPrescriptionEditorData(db)`. Do not delete before all validation succeeds.

- [ ] **Step 4: Verify writes and regressions.**

Run: `npm test && node tests/app-regression.test.js && node tests/frontend-polish.test.js`  
Expected: all PASS.

- [ ] **Step 5: Commit the editor write path.**

```bash
git add worker/src/prescriptions.js worker/src/index.js tests/cloudflare/prescriptions-write.test.js
git commit -m "feat: save prescriptions atomically in D1"
```

## Task 6: Implement execution history and idempotent offline synchronization

**Files:**
- Create: `worker/src/executions.js`
- Modify: `worker/src/index.js`
- Create: `tests/cloudflare/executions.test.js`

**Interfaces:**
- Exports `getExecucaoData(db)` and `syncExecucaoData(db, records)`.
- Sync response is `{ synced: number, acceptedSessionIds: string[] }`.

- [ ] **Step 1: Write a failing test that posts the same record twice, changing only RPE on the second request.**

```js
const record = {
  id_sessao: "2026-08-29|Ficha A|Treino A|Supino reto|1",
  data_treino: "29/08/2026",
  id_exercicio: "Supino reto",
  semana_referencia: "1",
  carga_absoluta: 80,
  reps_executadas: 8,
  rir: 2,
  rpe_sessao: 8,
};
```

Assert one row exists after two requests, its final `rpe_sessao` is `9`, both responses contain the session ID and `sync_status` returned to the client is `clean`.

- [ ] **Step 2: Run it.**

Run: `npm test -- tests/cloudflare/executions.test.js`  
Expected: FAIL because `/api/executions/sync` is not implemented.

- [ ] **Step 3: Implement strict payload validation and one upsert statement per record.**

Each record requires non-empty `id_sessao`, `data_treino` and `id_exercicio`; numbers are parsed with `Number()` and rejected when non-finite; `reps_executadas` must be an integer `>= 0`; RIR and RPE must be between `0` and `10`. Use:

```sql
INSERT INTO execution_records (
  id_sessao, data_treino, id_exercicio, semana_referencia,
  carga_absoluta, reps_executadas, rir, rpe_sessao, sync_status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'clean')
ON CONFLICT(id_sessao) DO UPDATE SET
  data_treino = excluded.data_treino,
  id_exercicio = excluded.id_exercicio,
  semana_referencia = excluded.semana_referencia,
  carga_absoluta = excluded.carga_absoluta,
  reps_executadas = excluded.reps_executadas,
  rir = excluded.rir,
  rpe_sessao = excluded.rpe_sessao,
  sync_status = 'clean',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
```

Validate the complete batch before calling `db.batch`, so an invalid record creates no partial sync.

- [ ] **Step 4: Add `GET /api/executions` sorted by date descending and `POST /api/executions/sync`; rerun tests.**

Run: `npm test -- tests/cloudflare/executions.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit synchronization.**

```bash
git add worker/src/executions.js worker/src/index.js tests/cloudflare/executions.test.js
git commit -m "feat: sync offline executions to D1"
```

## Task 7: Implement bootstrap, load calculations and API error boundary

**Files:**
- Create: `worker/src/load.js`
- Modify: `worker/src/index.js`
- Create: `tests/cloudflare/bootstrap-load.test.js`

**Interfaces:**
- Exports `getInitialAppData(db)` and `getGestaoCargaData(db)`.
- Load response keeps current names: `sessoes`, `e1rmByExercise`, `exercicios`.

- [ ] **Step 1: Write failing tests for boot isolation and deterministic load math.**

Seed an execution with `carga_absoluta: 80`, `reps_executadas: 8`, `rpe_sessao: 8`. Assert `/api/bootstrap` has prescription/history and does not call `getGestaoCargaData`; assert `/api/load` reports `volumeTotal: 640`, `melhorE1rmSessao: 101.3` and `rpeMedia: 8` for that session.

- [ ] **Step 2: Run the tests.**

Run: `npm test -- tests/cloudflare/bootstrap-load.test.js`  
Expected: FAIL with missing route or missing export.

- [ ] **Step 3: Reproduce current grouping rules as pure JavaScript.**

`getGestaoCargaData(db)` reads explicit execution columns once, extracts ficha and treino from current `id_sessao` using the same delimiter grammar as `parseSessionId`, groups by `data_treino|id_ficha|id_treino`, and calculates:

```js
const volumeLoad = carga * reps;
const e1rm = reps > 0 ? carga * (1 + reps / 30) : 0;
const rpeMedia = countRPE > 0 ? Math.round((totalRPE / countRPE) * 10) / 10 : 0;
const duracaoEstimadaMin = totalSeries * 3;
```

Sort sessions chronologically ascending. Never execute `INSERT`, `UPDATE`, `DELETE` or `CREATE` in this module.

- [ ] **Step 4: Implement `/api/bootstrap` with independent try/catch sections.**

For prescription failure append `"prescricao: " + error.message` to `errors`; for history failure append `"historico: " + error.message`; fill `error` with `errors.join(" | ")`; always return status counts and `updatedAt: new Date().toISOString()`. The API router catches unexpected errors and returns HTTP 500 with `{ success:false, code:"INTERNAL_ERROR", error:"Erro interno do serviço." }` while logging the original error with `console.error`.

- [ ] **Step 5: Run the full local suite.**

Run: `npm test && node tests/app-regression.test.js && node tests/frontend-polish.test.js`  
Expected: all PASS.

- [ ] **Step 6: Commit boot and load API.**

```bash
git add worker/src/load.js worker/src/index.js tests/cloudflare/bootstrap-load.test.js
git commit -m "feat: add Cloudflare bootstrap and load API"
```

## Task 8: Move the existing frontend from Apps Script transport to same-origin API

**Files:**
- Modify: `app/index.html`
- Modify: `app/script.html`
- Modify: `tests/app-regression.test.js`
- Modify: `scripts/build-cloudflare-assets.js`
- Create: `tests/cloudflare/frontend-contract.test.js`

**Interfaces:**
- Frontend calls exactly the routes in the API contract.
- `callServer(action, googleMethod, payload)` is replaced by `callApi(action, payload)` before Apps Script removal.

- [ ] **Step 1: Write a failing source-level test asserting the Cloudflare transport mapping.**

Assert that `app/script.html` contains a map whose exact action values include:

```js
{
  getInitialData: { method: "GET", path: "/api/bootstrap" },
  getAppStatus: { method: "GET", path: "/api/status" },
  getPrescricao: { method: "GET", path: "/api/prescriptions" },
  getPrescriptionEditorData: { method: "GET", path: "/api/prescription-editor" },
  getExecucao: { method: "GET", path: "/api/executions" },
  getHistorico: { method: "GET", path: "/api/executions" },
  getGestaoCarga: { method: "GET", path: "/api/load" },
  syncExecucao: { method: "POST", path: "/api/executions/sync" }
}
```

For save, build `PUT /api/prescriptions/${encodeURIComponent(id_ficha)}/${encodeURIComponent(id_treino)}` from payload rather than sending an action query parameter.

- [ ] **Step 2: Run it and confirm it fails while `google.script.run` remains.**

Run: `node --test tests/cloudflare/frontend-contract.test.js`  
Expected: FAIL stating Cloudflare action map is absent.

- [ ] **Step 3: Implement `callApi` using only `fetch`.**

Use `credentials: "same-origin"`, `Accept: "application/json"`, and `Content-Type: "application/json"` only for PUT/POST. On non-2xx, parse JSON if possible and throw `new Error(payload.error || "HTTP " + response.status)`. On success, return `payload.data !== undefined ? payload.data : payload`. Remove all branches that call `google.script.run`.

- [ ] **Step 4: Make the source a static-page source of truth.**

Replace the Apps Script bootstrap expression with `window.__XS_BOOTSTRAP__ = null;`, retain the existing loader fallback, and update the builder to copy it without a second replacement. The first load must therefore use `/api/bootstrap` and cache fallback exactly as it does today.

- [ ] **Step 5: Run source, Worker and browser smoke checks.**

Run: `npm run assets:build && npm test && node tests/app-regression.test.js && node tests/frontend-polish.test.js`  
Expected: all PASS. Then run `npm run dev`; verify each navigation tab opens and the browser Network panel shows only same-origin `/api/*` calls.

- [ ] **Step 6: Commit frontend cutover.**

```bash
git add app/index.html app/script.html scripts/build-cloudflare-assets.js tests/app-regression.test.js tests/cloudflare/frontend-contract.test.js
git commit -m "feat: connect PWA frontend to Cloudflare API"
```

## Task 9: Build repeatable CSV transfer and audit tooling

**Files:**
- Create: `scripts/import-google-sheet-csv.js`
- Create: `scripts/audit-migration.js`
- Create: `tests/migration/import-google-sheet-csv.test.js`
- Create: `tests/migration/audit-migration.test.js`
- Create: `data-import/README.md`

**Interfaces:**
- Import input directory has exactly `Demanda_Muscular.csv`, `DB_Prescricao.csv`, `DB_Execucao.csv`.
- Import output is `data-import/staging/import-manifest.json` plus SQL files that are excluded by `.gitignore`.
- Audit output is JSON with `ok`, per-table source/target counts, duplicate keys and missing keys.

- [ ] **Step 1: Write failing parser tests for header normalization and duplicate sessions.**

The tests must assert BOM is removed from the first header; headers trim whitespace and compare case-insensitively; comma decimal values become valid demand values; a duplicate `id_sessao` causes `ok: false`; and empty `id_exercicio` prescription rows are skipped but counted in `skippedRows`.

- [ ] **Step 2: Run the tests.**

Run: `node --test tests/migration/import-google-sheet-csv.test.js tests/migration/audit-migration.test.js`  
Expected: FAIL because neither script exists.

- [ ] **Step 3: Implement import with validation before SQL generation.**

Require the source directory as `--source`, staging output as `--output`, and reject paths outside `data-import/`. The generated manifest must include `createdAt`, SHA-256 of each source file, parsed row count, skipped row count, unique key count and validation errors. Generate SQL only after no validation errors exist. Escape text as SQL string literals by replacing `'` with `''`; format numbers with `String(number)` after numeric validation; wrap each generated table import in `BEGIN TRANSACTION;`, its validated `INSERT` statements, and `COMMIT;`.

- [ ] **Step 4: Implement audit against exported D1 query JSON.**

The audit takes `--manifest`, `--target-counts` and `--target-session-ids`. It returns nonzero when any expected count differs, when duplicated session IDs are found, or when expected session IDs are absent. It never modifies D1 or source CSVs.

- [ ] **Step 5: Document the safe data directory.**

`data-import/README.md` must state that this directory is local-only, all CSVs contain operational data, and only the README is committed. Include exact commands for a local dry run:

```bash
node scripts/import-google-sheet-csv.js --source data-import/source --output data-import/staging
node scripts/audit-migration.js --manifest data-import/staging/import-manifest.json --target-counts data-import/staging/target-counts.json --target-session-ids data-import/staging/target-session-ids.json
```

- [ ] **Step 6: Run all migration tests and commit tooling.**

Run: `node --test tests/migration/*.test.js`  
Expected: PASS.

```bash
git add scripts/import-google-sheet-csv.js scripts/audit-migration.js tests/migration data-import/README.md .gitignore
git commit -m "feat: add audited Google Sheets CSV migration tools"
```

## Task 10: Add the operational guides before any account or data action

**Files:**
- Create: `docs/guias-operacionais/01-cloudflare-conta-e-wrangler.md`
- Create: `docs/guias-operacionais/02-criar-d1-staging-e-deploy-preview.md`
- Create: `docs/guias-operacionais/03-exportar-e-importar-dados.md`
- Create: `docs/guias-operacionais/04-dominio-access-e-virada-producao.md`

**Interfaces:**
- Guides use the final Worker/D1 names and commands from Tasks 1–9.
- A manual gate always ends in an observable confirmation, not an assumption.

- [ ] **Step 1: Write the account/Wrangler guide in language for a non-technical operator.**

It must link to [Cloudflare sign-up/login](https://dash.cloudflare.com/sign-up), state that the account password and verification code must never be sent in chat, and list these exact steps: open the link; create or sign in; open the terminal in the project folder; run `npx wrangler login`; approve the browser window; return to terminal; run `npx wrangler whoami`; copy only the non-secret account name shown by the command. Define success as `whoami` returning the expected account rather than an authentication error.

- [ ] **Step 2: Write the D1 staging/preview guide.**

Link to [D1 getting started](https://developers.cloudflare.com/d1/get-started/) and state the exact commands:

```bash
npm run assets:build
cp wrangler.jsonc.example wrangler.jsonc
npx wrangler d1 create xsteam-pwa-staging
npx wrangler d1 migrations apply xsteam-pwa-staging --remote
npm run deploy
```

Tell the operator to copy the database ID only into the local active `wrangler.jsonc`, never into a screenshot, chat message or Git commit. Define success as a preview URL opening and `/api/status` showing `database: "ok"`.

- [ ] **Step 3: Write the export/import guide with every Google Sheets click.**

For each required sheet: open the spreadsheet; select the exact tab; choose **Arquivo > Fazer download > Valores separados por vírgulas (.csv, planilha atual)**; rename exactly to the expected file; place it in `data-import/source`; run import generator; apply these exact generated files to staging:

```bash
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/01-exercise-catalog.sql
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/02-prescriptions.sql
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/03-executions.sql
```

Then query `exercise_catalog`, `prescription_exercises`, and `execution_records` individually with `SELECT COUNT(*) AS count FROM exercise_catalog;`, `SELECT COUNT(*) AS count FROM prescription_exercises;`, and `SELECT COUNT(*) AS count FROM execution_records;`; finally run the audit. State that failure means stop and keep Apps Script unchanged.

- [ ] **Step 4: Write the domain/Access/production guide.**

Link to [Cloudflare Access one-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) and [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/). Explain that a controlled domain is required; use Zero Trust > Access controls > Applications > Add application > Self-hosted; protect the exact production hostname; create an Allow policy for the single authorized e-mail (not “all valid emails”); enable One-time PIN; test in a private browser window; confirm an unapproved e-mail receives no access. Include the rollback instruction: disable the production route rather than deleting D1.

- [ ] **Step 5: Review guide links and commands, then commit.**

Run: `git diff --check`  
Expected: no output.

```bash
git add docs/guias-operacionais
git commit -m "docs: add Cloudflare migration operating guides"
```

## Task 11: Provision and validate the staging environment

**Files:**
- Modify locally only: active `wrangler.jsonc` database ID
- Generate locally only: `data-import/source/*`, `data-import/staging/*`
- Modify: `docs/RESUMO_PROJETO.md` only after staging validation succeeds

**Manual gate:** This is the first time the responsible person needs to interact with Cloudflare. Use Guide 01 and Guide 02 in full; do not proceed with production data if any success condition fails.

- [ ] **Step 1: Complete the one-time Cloudflare login from Guide 01.**

Run: `npx wrangler whoami`  
Expected: an authenticated account identity, never a token value.

- [ ] **Step 2: Create D1 staging and apply migration remotely.**

Run: `npx wrangler d1 create xsteam-pwa-staging` then `npx wrangler d1 migrations apply xsteam-pwa-staging --remote`  
Expected: the create command prints a database ID; the migration command reports `0001_initial_schema.sql` as applied.

- [ ] **Step 3: Configure the local staging binding and deploy preview.**

Run: `npm run deploy`  
Expected: Worker deployment URL printed by Wrangler.

- [ ] **Step 4: Verify public functionality against empty staging data.**

Copy the Worker URL printed by `npm run deploy`, append `/api/status` in the browser, and expect HTTP 200 with `database: "ok"`, `prescriptionRows: 0`, `executionRows: 0`. Open that same Worker URL without `/api/status`; expect the PWA shell and an intelligible empty-prescription warning, not a stuck loader.

- [ ] **Step 5: Record only non-secret evidence.**

Add date, deployment URL and endpoint result to `docs/RESUMO_PROJETO.md`. Do not store database IDs, tokens, export contents or personal e-mails in Git. Commit this documentation-only result.

## Task 12: Migrate to staging, audit, and run end-to-end acceptance

**Files:**
- Local only: `data-import/source/*`, `data-import/staging/*`
- Create: `docs/guias-operacionais/05-roteiro-de-aceite-pwa.md`
- Modify: `docs/RESUMO_PROJETO.md`

**Manual gate:** Follow Guide 03. Exporting data is read-only; no Google Sheet is modified. A failed audit is a stop condition, not a reason to improvise edits in D1.

- [ ] **Step 1: Export the three source tabs and generate the manifest.**

Run: `node scripts/import-google-sheet-csv.js --source data-import/source --output data-import/staging`  
Expected: a manifest with exactly the source filenames, hashes, counts and `validationErrors: []`.

- [ ] **Step 2: Apply generated SQL only to `xsteam-pwa-staging`.**

Run these three commands, in this order:

```bash
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/01-exercise-catalog.sql
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/02-prescriptions.sql
npx wrangler d1 execute xsteam-pwa-staging --remote --file=data-import/staging/03-executions.sql
```

Expected: each command completes without SQL error.

- [ ] **Step 3: Export D1 counts/IDs and run the audit.**

Run remote D1 `SELECT COUNT(*)` queries for the three destination tables and `SELECT id_sessao FROM execution_records ORDER BY id_sessao`; save only temporary result JSON inside ignored `data-import/staging`; execute the audit script.  
Expected: exit code `0` and `"ok": true`.

- [ ] **Step 4: Write and perform the acceptance script on the preview URL.**

The guide must require this exact sequence: open PWA; wait for initial load; select each ficha/treino; open Prescrição; open Prescrever and modify one staging-only treino; open Treino; disable network; record one series; re-enable network; sync; change session RPE; sync again; confirm only one matching execution in Histórico; open Carga and confirm volume/RPE/e1RM; reload page and ensure all persisted data returns.

- [ ] **Step 5: Treat any failed check as a return to the responsible task.**

For API mismatch return to Tasks 4–8; for source/target mismatch return to Task 9; for only manual misunderstanding correct Guide 03 or 05, then repeat the entire acceptance script. Do not continue to production until the script passes in full.

- [ ] **Step 6: Commit acceptance guide and staging status.**

```bash
git add docs/guias-operacionais/05-roteiro-de-aceite-pwa.md docs/RESUMO_PROJETO.md
git commit -m "docs: record Cloudflare staging acceptance"
```

## Task 13: Perform the controlled production cutover

**Files:**
- Modify locally only: active production binding configuration.
- Modify: `docs/RESUMO_PROJETO.md`

**Manual gate:** Follow Guide 04. Do this only after Task 12 has passed and when no one is editing the Apps Script/Sheet data.

- [ ] **Step 1: Announce and begin the short data-freeze window.**

Stop creating or editing prescriptions/executions in the Apps Script PWA. Record the start time in the local cutover checklist. Do not disable Apps Script or delete any sheet.

- [ ] **Step 2: Repeat the CSV export and audit generation from Task 12.**

Run: `node scripts/import-google-sheet-csv.js --source data-import/source --output data-import/production`  
Expected: no validation errors and a new timestamp/hash manifest.

- [ ] **Step 3: Create production D1, apply every migration and import the final data.**

Run: `npx wrangler d1 create xsteam-pwa-production`; add its ID only to the uncommitted production config; run `npx wrangler d1 migrations apply xsteam-pwa-production --remote`; then run:

```bash
npx wrangler d1 execute xsteam-pwa-production --remote --file=data-import/production/01-exercise-catalog.sql
npx wrangler d1 execute xsteam-pwa-production --remote --file=data-import/production/02-prescriptions.sql
npx wrangler d1 execute xsteam-pwa-production --remote --file=data-import/production/03-executions.sql
```

Finally run audit.  
Expected: migration success and audit `ok: true`.

- [ ] **Step 4: Deploy production only after D1 audit passes.**

Run: `npm run deploy` using the production binding.  
Expected: successful deployment URL before any custom-domain route change.

- [ ] **Step 5: Connect/protect the production hostname and test Access.**

Follow Guide 04. Test the allowed e-mail in a private browser: it receives a one-time PIN and reaches the PWA. Test one non-authorized e-mail: it cannot reach the PWA. Confirm `/api/status` works after authorization and is unavailable before it.

- [ ] **Step 6: Run full mobile acceptance against production.**

Use the Task 12 script; create a real execution only after verifying a prior staging record did not appear in production. Define production success as all five screens, offline sync and reload persistence working through the protected hostname.

- [ ] **Step 7: Complete the cutover record and commit documentation.**

Update `docs/RESUMO_PROJETO.md` with date, schema migration names, audit result, protected hostname (without e-mail), and statement that Sheets are rollback-only. Commit:

```bash
git add docs/RESUMO_PROJETO.md
git commit -m "docs: record Cloudflare production cutover"
```

## Task 14: Observe, retire runtime dependencies, and close the migration

**Files:**
- Modify: `tests/app-regression.test.js`
- Modify: `docs/RESUMO_PROJETO.md`
- Modify: `docs/HISTORICO_STATUS_PROJETO.md`

**Interfaces:**
- The production PWA has no runtime dependency on Apps Script.
- Legacy Apps Script files may remain archived in Git but are not part of Worker build/deploy.

- [ ] **Step 1: Observe production for seven calendar days without changing legacy data.**

Each day, open the protected PWA, confirm `/api/status` is healthy and inspect Cloudflare Worker/D1 dashboards for runtime errors or unexpected row usage. A sync failure, missing history or API error restarts the observation period after the defect is fixed and acceptance is repeated.

- [ ] **Step 2: Confirm that no active build path uses Apps Script after seven clean days.**

`app/index.html` and `app/script.html` were already moved to same-origin API calls in Task 8. Update source-level tests to assert the active Worker asset build contains no `google.script`, and update documentation to mark `app/Código.gs` and `app/appscript.json` as legacy reference files not included in `npm run deploy`. Do not delete the legacy source or Sheets during this task.

- [ ] **Step 3: Update continuity documents.**

State that Cloudflare Worker + D1 are production source of truth, list the five live flows, name the CSV rollback location policy, and mark multi-user authentication/tenant separation as a future project. Do not publish any backup data path, database ID, or authorized e-mail.

- [ ] **Step 4: Run final verification.**

Run: `npm run assets:build && npm test && node tests/app-regression.test.js && node tests/frontend-polish.test.js && git diff --check`  
Expected: all commands exit `0` and `git diff --check` has no output.

- [ ] **Step 5: Commit migration closure.**

```bash
git add tests/app-regression.test.js docs/RESUMO_PROJETO.md docs/HISTORICO_STATUS_PROJETO.md
git commit -m "chore: close Apps Script production migration"
```

## Plan Self-Review

### Specification coverage

| Specification requirement | Plan tasks |
|---|---|
| Same five functional screens | 4–8, 12–13 |
| Single Worker serving PWA/API | 1–2 |
| D1 relational data replacement | 3–7 |
| Offline/idempotent sync | 6, 8, 12–13 |
| Light boot without load write | 7 |
| Audited CSV transfer and rollback | 9, 12–13 |
| No public production API | 10–11, 13 |
| Manual steps for a beginner | 10–13 |
| Legacy safely retired after observation | 14 |

### Consistency checks

- The D1 binding is always named `DB`; static assets binding is always `ASSETS`.
- Sync endpoint and frontend action names agree on `/api/executions/sync`.
- Load is read-only in schema, API, tests and acceptance flow.
- Production data is created only after staging audit and full acceptance.
- No task requires accounts, tenant IDs, R2, AI or application login.
