# Training Session Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single persistent training-session lifecycle with prescribed and free modes, cloud-synced drafts, offline entry and atomic publication to the existing execution history.

**Architecture:** Three focused D1 tables hold the active session, its exercise snapshot and draft sets. A Worker domain module owns all state transitions and publishes only completed sets to `execution_records`; the PWA becomes a two-state screen (start or active) while existing History and Load readers remain unchanged.

**Tech Stack:** Cloudflare Workers, D1/SQLite, static HTML/CSS/conservative JavaScript PWA, Vitest with Cloudflare Miniflare, existing Google session authentication.

## Global Constraints

- Preserve the current PWA visual identity and components; the brainstorming wireframe is not a visual redesign reference.
- Do not change History or Load UI, metrics or read queries in this feature.
- Allow exactly one `in_progress` session across the single-tenant application.
- Support `prescribed` and `free` session modes.
- Keep the current four prescription cycles until the separate unlimited-cycle project.
- Require connectivity to start, complete or cancel; allow an existing session to be filled offline.
- Expose **RER** in the new UI/API, with values `0..10` in increments of `0.5`; write it to legacy `execution_records.rir` only at completion.
- Require session PSE `1..10` in increments of `0.5` at completion.
- Never expose draft or canceled sets through existing History/Load APIs.
- Never mutate, delete or recalculate existing `execution_records` rows.
- Use `apply_patch` for edits and `bash scripts/git-workspace.sh` for Git actions.
- Use Node `24.19.0` through `/home/elohimlima/.nvm/nvm.sh` for Vitest and Wrangler.
- Apply the remote D1 migration only after every local test passes; deploy Worker code only after the remote migration succeeds.

## File Structure

| File | Responsibility |
| --- | --- |
| `worker/migrations/0003_training_sessions.sql` | Adds session/draft tables, single-active constraint and execution trace column. |
| `worker/src/training-sessions.js` | Validates session payloads, owns all lifecycle transitions and D1 aggregation. |
| `worker/src/index.js` | Authenticated HTTP routing and error envelopes for session operations. |
| `app/index.html` | Start state, active-session header and completion/cancel controls using existing components. |
| `app/script.html` | Active-session state machine, local draft cache, autosave, recovery and completion flow. |
| `app/style.html` | Minimal visibility/layout rules composed from the current design tokens. |
| `tests/cloudflare/training-session-schema.test.mjs` | Migration constraints and historical-row preservation. |
| `tests/cloudflare/training-sessions.test.mjs` | Domain lifecycle, validation, idempotency and publication. |
| `tests/cloudflare/training-session-routes.test.mjs` | Authentication, route methods, errors and envelopes. |
| `tests/cloudflare/frontend-contract.test.cjs` | Static contract for start/active/free states and RER naming. |
| `tests/app-regression.test.js` | Conservative syntax, offline cache and no History/Load regression. |
| `docs/guias-operacionais/08-sessao-treino-e-treino-livre.md` | Beginner-facing operation and recovery guide. |
| `docs/RESUMO_PROJETO.md` | Records the deployed feature and deferred cycle/periodization work. |

---

### Task 1: Add non-destructive D1 session storage

**Files:**
- Create: `worker/migrations/0003_training_sessions.sql`
- Create: `tests/cloudflare/training-session-schema.test.mjs`

**Interfaces:**
- Produces tables `training_sessions`, `training_session_exercises`, `training_session_sets`.
- Produces optional `execution_records.training_session_id` and its index.
- Enforces only one `training_sessions.status = 'in_progress'` row.

- [ ] **Step 1: Write the failing schema tests.**

```js
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

const timestamp = "2026-08-30T12:00:00.000Z";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM training_session_sets"),
    env.DB.prepare("DELETE FROM training_session_exercises"),
    env.DB.prepare("DELETE FROM training_sessions"),
    env.DB.prepare("DELETE FROM execution_records WHERE id_sessao IN ('legacy-session')"),
  ]);
  await env.DB.prepare("INSERT OR IGNORE INTO exercise_catalog (id_exercicio) VALUES (?)")
    .bind("Schema Supino")
    .run();
});

describe("training session schema", () => {
  it("stores nullable set drafts and preserves a legacy execution", async () => {
    await env.DB.prepare(
      "INSERT INTO execution_records (id_sessao, data_treino, id_exercicio) VALUES (?, ?, ?)",
    ).bind("legacy-session", "30/08/2026", "Schema Supino").run();
    await env.DB.prepare(
      "INSERT INTO training_sessions (id, session_date, mode, status, started_at, updated_at) VALUES (?, ?, 'free', 'in_progress', ?, ?)",
    ).bind("session-1", "2026-08-30", timestamp, timestamp).run();
    await env.DB.prepare(
      "INSERT INTO training_session_exercises (id, session_id, id_exercicio, exercise_order, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("exercise-1", "session-1", "Schema Supino", 1, "session", timestamp, timestamp).run();
    await env.DB.prepare(
      "INSERT INTO training_session_sets (id, session_id, session_exercise_id, set_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind("set-1", "session-1", "exercise-1", 1, timestamp, timestamp).run();

    const legacy = await env.DB.prepare(
      "SELECT training_session_id FROM execution_records WHERE id_sessao = ?",
    ).bind("legacy-session").first();
    expect(legacy.training_session_id).toBe("");
  });

  it("rejects a second active session at database level", async () => {
    await env.DB.prepare(
      "INSERT INTO training_sessions (id, session_date, mode, status, started_at, updated_at) VALUES (?, ?, 'free', 'in_progress', ?, ?)",
    ).bind("active-a", "2026-08-30", timestamp, timestamp).run();
    await expect(env.DB.prepare(
      "INSERT INTO training_sessions (id, session_date, mode, status, started_at, updated_at) VALUES (?, ?, 'free', 'in_progress', ?, ?)",
    ).bind("active-b", "2026-08-31", timestamp, timestamp).run()).rejects.toThrow(/UNIQUE/);
  });
});
```

- [ ] **Step 2: Run the schema test and confirm RED.**

Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/training-session-schema.test.mjs
```

Expected: FAIL with `no such table: training_sessions` or missing `training_session_id`.

- [ ] **Step 3: Add `0003_training_sessions.sql`.**

```sql
ALTER TABLE execution_records ADD COLUMN training_session_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_execution_training_session
  ON execution_records (training_session_id);

CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  session_date TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('prescribed', 'free')),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'canceled')),
  id_ficha TEXT NOT NULL DEFAULT '',
  id_treino TEXT NOT NULL DEFAULT '',
  cycle_reference INTEGER CHECK (cycle_reference IS NULL OR cycle_reference BETWEEN 1 AND 4),
  session_pse REAL CHECK (
    session_pse IS NULL OR
    (session_pse BETWEEN 1 AND 10 AND CAST(session_pse * 2 AS INTEGER) = session_pse * 2)
  ),
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT '',
  canceled_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  CHECK (
    (mode = 'free' AND id_ficha = '' AND id_treino = '' AND cycle_reference IS NULL) OR
    (mode = 'prescribed' AND id_ficha <> '' AND id_treino <> '' AND cycle_reference BETWEEN 1 AND 4)
  )
);

CREATE UNIQUE INDEX idx_training_sessions_one_active
  ON training_sessions (status)
  WHERE status = 'in_progress';

CREATE TABLE training_session_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES training_sessions(id),
  id_exercicio TEXT NOT NULL REFERENCES exercise_catalog(id_exercicio),
  exercise_order INTEGER NOT NULL CHECK (exercise_order > 0),
  source TEXT NOT NULL CHECK (source IN ('prescription', 'session')),
  observations TEXT NOT NULL DEFAULT '',
  expected_sets TEXT NOT NULL DEFAULT '',
  expected_reps TEXT NOT NULL DEFAULT '',
  expected_rest TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (session_id, exercise_order),
  UNIQUE (session_id, id_exercicio)
);

CREATE INDEX idx_training_session_exercises_session
  ON training_session_exercises (session_id, exercise_order);

CREATE TABLE training_session_sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES training_sessions(id),
  session_exercise_id TEXT NOT NULL REFERENCES training_session_exercises(id),
  set_order INTEGER NOT NULL CHECK (set_order > 0),
  load_value REAL CHECK (load_value IS NULL OR load_value >= 0),
  repetitions INTEGER CHECK (repetitions IS NULL OR repetitions > 0),
  rer REAL CHECK (
    rer IS NULL OR
    (rer BETWEEN 0 AND 10 AND CAST(rer * 2 AS INTEGER) = rer * 2)
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (session_exercise_id, set_order)
);

CREATE INDEX idx_training_session_sets_session
  ON training_session_sets (session_id, session_exercise_id, set_order);
```

- [ ] **Step 4: Isolate schema test rows and run focused/full suites.**

The `beforeEach` above deletes sets, exercises and sessions in dependency order. Run:

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/training-session-schema.test.mjs && npm test
```

Expected: schema tests PASS and all existing tests PASS.

- [ ] **Step 5: Commit.**

```bash
bash scripts/git-workspace.sh add worker/migrations/0003_training_sessions.sql tests/cloudflare/training-session-schema.test.mjs
bash scripts/git-workspace.sh commit -m "feat: add training session schema"
```

### Task 2: Start and recover prescribed/free sessions

**Files:**
- Create: `worker/src/training-sessions.js`
- Create: `tests/cloudflare/training-sessions.test.mjs`

**Interfaces:**
- Produces `TrainingSessionError(code, message, details = {})`.
- Produces `getActiveTrainingSession(db): Promise<TrainingSession|null>`.
- Produces `startTrainingSession(db, payload, options): Promise<TrainingSession>` where `options = { now, idFactory }` is injectable in tests.
- `TrainingSession` contains `{ id, session_date, mode, status, id_ficha, id_treino, cycle_reference, session_pse, exercises }` and every exercise contains `sets`.

- [ ] **Step 1: Write failing lifecycle tests.**

```js
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getActiveTrainingSession,
  startTrainingSession,
} from "../../worker/src/training-sessions.js";

let generatedId = 0;

function fixedOptions(prefix = "session") {
  return {
    now: new Date("2026-08-30T12:00:00.000Z"),
    idFactory: () => `${prefix}-${++generatedId}`,
  };
}

async function seedPrescription(row) {
  await env.DB.prepare("INSERT OR IGNORE INTO exercise_catalog (id_exercicio, is_active) VALUES (?, 1)")
    .bind(row.id_exercicio)
    .run();
  await env.DB.prepare(`
    INSERT INTO prescription_exercises (
      id_ficha, id_treino, id_exercicio, ordem_exercicio,
      semana_2_sets, semana_2_reps, semana_2_descanso
    ) VALUES (?, ?, ?, 1, ?, ?, ?)
  `).bind(
    row.id_ficha,
    row.id_treino,
    row.id_exercicio,
    row.semana_2_sets || "",
    row.semana_2_reps || "",
    row.semana_2_descanso || "",
  ).run();
}

async function startFree(prefix = "free") {
  return startTrainingSession(
    env.DB,
    { mode: "free", session_date: "2026-08-30" },
    fixedOptions(prefix),
  );
}

beforeEach(async () => {
  generatedId = 0;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM training_session_sets"),
    env.DB.prepare("DELETE FROM training_session_exercises"),
    env.DB.prepare("DELETE FROM training_sessions"),
    env.DB.prepare("DELETE FROM prescription_exercises"),
    env.DB.prepare("DELETE FROM execution_records"),
  ]);
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO exercise_catalog (id_exercicio, is_active) VALUES (?, 1)
      ON CONFLICT(id_exercicio) DO UPDATE SET is_active = 1
    `).bind("Supino reto"),
    env.DB.prepare(`
      INSERT INTO exercise_catalog (id_exercicio, is_active) VALUES (?, 1)
      ON CONFLICT(id_exercicio) DO UPDATE SET is_active = 1
    `).bind("Remada baixa"),
  ]);
});

it("starts a free session with no exercises", async () => {
  const session = await startTrainingSession(env.DB, {
    mode: "free",
    session_date: "2026-08-30",
  }, fixedOptions());
  expect(session).toMatchObject({ mode: "free", status: "in_progress", exercises: [] });
});

it.each(["", "30/08/2026", "2026-02-30"])("rejects invalid session date %s", async (sessionDate) => {
  await expect(startTrainingSession(env.DB, {
    mode: "free",
    session_date: sessionDate,
  }, fixedOptions())).rejects.toMatchObject({ code: "INVALID_SESSION" });
});

it("snapshots the selected prescribed cycle", async () => {
  await seedPrescription({
    id_ficha: "Manutenção",
    id_treino: "Base MMII 1",
    id_exercicio: "Agachamento com barra livre",
    semana_2_sets: "3",
    semana_2_reps: "8",
    semana_2_descanso: "120",
  });
  const session = await startTrainingSession(env.DB, {
    mode: "prescribed",
    session_date: "2026-08-30",
    id_ficha: "Manutenção",
    id_treino: "Base MMII 1",
    cycle_reference: 2,
  }, fixedOptions());
  expect(session.exercises[0]).toMatchObject({
    id_exercicio: "Agachamento com barra livre",
    expected_sets: "3",
    expected_reps: "8",
    expected_rest: "120",
  });
  expect(session.exercises[0].sets).toHaveLength(3);
});

it("returns the existing active session instead of creating another", async () => {
  await startTrainingSession(env.DB, { mode: "free", session_date: "2026-08-30" }, fixedOptions());
  await expect(startTrainingSession(
    env.DB,
    { mode: "free", session_date: "2026-08-31" },
    fixedOptions("second"),
  )).rejects.toMatchObject({ code: "ACTIVE_SESSION_EXISTS", details: { activeSession: expect.any(Object) } });
});
```

- [ ] **Step 2: Run focused test and confirm RED.**

Run the Node 24 test command for `tests/cloudflare/training-sessions.test.mjs`.
Expected: FAIL because `worker/src/training-sessions.js` does not exist.

- [ ] **Step 3: Implement validation, aggregation and free start.**

Use these exact helpers and public error shape:

```js
export class TrainingSessionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function isoDate(value) {
  const text = String(value || "").trim();
  const parsed = new Date(`${text}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    throw new TrainingSessionError("INVALID_SESSION", "Data do treino inválida.");
  }
  return text;
}

function sessionOptions(options = {}) {
  return {
    now: options.now || new Date(),
    idFactory: options.idFactory || (() => crypto.randomUUID()),
  };
}
```

`getActiveTrainingSession` must read the session, its ordered exercises and sets with three queries, then assemble arrays without changing database rows.

- [ ] **Step 4: Implement prescribed snapshot and active-session conflict.**

For the selected cycle, whitelist the three source columns rather than interpolating arbitrary field names:

```js
const CYCLE_COLUMNS = {
  1: ["semana_1_sets", "semana_1_reps", "semana_1_descanso"],
  2: ["semana_2_sets", "semana_2_reps", "semana_2_descanso"],
  3: ["semana_3_sets", "semana_3_reps", "semana_3_descanso"],
  4: ["semana_4_sets", "semana_4_reps", "semana_4_descanso"],
};
```

Query only prescription rows joined to `exercise_catalog.is_active = 1`, ordered by `ordem_exercicio`. Reject an empty selection with `PRESCRIPTION_NOT_FOUND`. Insert session and snapshot rows in one `db.batch`. For each prescribed exercise, create empty set draft rows from the leading integer in `expected_sets` (`"3"` and `"3-4"` both start with three rows); use one row when the value has no positive leading integer. This preserves the current app behavior and makes the placeholder count survive reloads. Before insertion, call `getActiveTrainingSession`; if found, throw `ACTIVE_SESSION_EXISTS` with the active aggregate in `details`.

If the unique index still rejects the insert because two requests raced, reload the active aggregate and throw the same `ACTIVE_SESSION_EXISTS` error; never expose the raw D1 constraint to the client.

- [ ] **Step 5: Run focused/full tests and commit.**

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/training-sessions.test.mjs && npm test
bash scripts/git-workspace.sh add worker/src/training-sessions.js tests/cloudflare/training-sessions.test.mjs
bash scripts/git-workspace.sh commit -m "feat: start and recover training sessions"
```

### Task 3: Save exercise and set drafts safely

**Files:**
- Modify: `worker/src/training-sessions.js`
- Modify: `tests/cloudflare/training-sessions.test.mjs`

**Interfaces:**
- Produces `saveTrainingSessionExercises(db, sessionId, payload, options): Promise<TrainingSession>`.
- Produces `saveTrainingSessionSets(db, sessionId, payload, options): Promise<TrainingSession>`.
- Exercise payload is `{ exercises: [{ id?, id_exercicio, observations, source }] }` in final order.
- Set payload is `{ sets: [{ id?, session_exercise_id, set_order, load_value, repetitions, rer }] }`.

- [ ] **Step 1: Add failing draft tests.**

```js
async function startFreeWithExercise() {
  const session = await startFree("draft-session");
  return saveTrainingSessionExercises(env.DB, session.id, {
    exercises: [{ id_exercicio: "Supino reto", observations: "", source: "session" }],
  }, fixedOptions("draft-exercise"));
}

function validSet(overrides = {}) {
  return {
    session_exercise_id: overrides.session_exercise_id,
    set_order: overrides.set_order || 1,
    load_value: overrides.load_value === undefined ? 20 : overrides.load_value,
    repetitions: overrides.repetitions === undefined ? 10 : overrides.repetitions,
    rer: overrides.rer === undefined ? 2 : overrides.rer,
  };
}

it("adds active catalog exercises to a free session and preserves ids while reordering", async () => {
  const session = await startFree();
  const updated = await saveTrainingSessionExercises(env.DB, session.id, {
    exercises: [
      { id_exercicio: "Supino reto", observations: "", source: "session" },
      { id_exercicio: "Remada baixa", observations: "", source: "session" },
    ],
  }, fixedOptions("exercise"));
  const reordered = await saveTrainingSessionExercises(env.DB, session.id, {
    exercises: updated.exercises.slice().reverse(),
  }, fixedOptions("reorder"));
  expect(reordered.exercises.map((row) => row.id)).toEqual(updated.exercises.map((row) => row.id).reverse());
});

it("accepts complete, empty and half-step RER drafts", async () => {
  const session = await startFreeWithExercise();
  const exerciseId = session.exercises[0].id;
  const updated = await saveTrainingSessionSets(env.DB, session.id, { sets: [
    { session_exercise_id: exerciseId, set_order: 1, load_value: 0, repetitions: 12, rer: 1.5 },
    { session_exercise_id: exerciseId, set_order: 2, load_value: null, repetitions: null, rer: null },
  ] }, fixedOptions("set"));
  expect(updated.exercises[0].sets).toHaveLength(2);
});

it.each([-0.5, 0.25, 10.5])("rejects invalid RER %s", async (rer) => {
  const session = await startFreeWithExercise();
  const sessionExerciseId = session.exercises[0].id;
  await expect(saveTrainingSessionSets(env.DB, session.id, {
    sets: [validSet({ session_exercise_id: sessionExerciseId, rer })],
  }, fixedOptions("invalid-set")))
    .rejects.toMatchObject({ code: "INVALID_RER" });
});
```

- [ ] **Step 2: Run focused tests and confirm RED.**

Expected: missing export errors for the two save functions.

- [ ] **Step 3: Implement active-session guards and exercise diff.**

Use one guard for all mutations:

```js
async function requireActiveSession(db, sessionId) {
  const session = await getTrainingSessionById(db, sessionId);
  if (!session) throw new TrainingSessionError("SESSION_NOT_FOUND", "Sessão não encontrada.");
  if (session.status !== "in_progress") {
    throw new TrainingSessionError("SESSION_NOT_ACTIVE", "A sessão não está em andamento.");
  }
  return session;
}
```

For each exercise with an existing `id`, require that it belongs to the session and keep its snapshot even if the catalog later becomes inactive. For every new row without `id`, require `exercise_catalog.is_active = 1`. Reject duplicate exercise names. Upsert included rows, delete sets for removed exercise ids and delete removed exercises in one batch. To swap positions without violating `UNIQUE(session_id, exercise_order)`, first move retained rows to temporary orders `10000 + finalOrder`, then issue their contiguous final orders in a second group of statements inside the same batch.

- [ ] **Step 4: Implement set normalization and idempotent diff.**

Normalize draft fields without converting empty strings to zero:

```js
function nullableNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function validHalfStep(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max && Number.isInteger(value * 2);
}
```

Require every `session_exercise_id` to belong to the session, positive unique `set_order` per exercise, nonnegative load, positive integer repetitions and valid half-step RER when non-null. Upsert included rows and delete omitted rows for that session in one batch.

- [ ] **Step 5: Run focused/full tests and commit.**

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/training-sessions.test.mjs && npm test
bash scripts/git-workspace.sh add worker/src/training-sessions.js tests/cloudflare/training-sessions.test.mjs
bash scripts/git-workspace.sh commit -m "feat: persist training session drafts"
```

### Task 4: Complete or cancel atomically without History/Load drafts

**Files:**
- Modify: `worker/src/training-sessions.js`
- Modify: `tests/cloudflare/training-sessions.test.mjs`
- Verify unchanged: `tests/cloudflare/executions.test.mjs`
- Verify unchanged: `tests/cloudflare/bootstrap-load.test.mjs`

**Interfaces:**
- Produces `completeTrainingSession(db, sessionId, payload, options): Promise<{ session, publishedSetCount }>`.
- Produces `cancelTrainingSession(db, sessionId, options): Promise<TrainingSession>`.
- Completion payload is `{ session_pse }`.

- [ ] **Step 1: Add failing publication tests.**

```js
async function seedActiveSessionWithCompleteSet() {
  const session = await startFreeWithExercise();
  return saveTrainingSessionSets(env.DB, session.id, {
    sets: [validSet({ session_exercise_id: session.exercises[0].id, rer: 1.5 })],
  }, fixedOptions("complete-set"));
}

async function seedActiveSessionWithCompleteAndEmptySets() {
  const session = await startFreeWithExercise();
  return saveTrainingSessionSets(env.DB, session.id, { sets: [
    validSet({ session_exercise_id: session.exercises[0].id, rer: 1.5 }),
    {
      session_exercise_id: session.exercises[0].id,
      set_order: 2,
      load_value: null,
      repetitions: null,
      rer: null,
    },
  ] }, fixedOptions("mixed-sets"));
}

async function seedPartialSetSession() {
  const session = await startFreeWithExercise();
  return saveTrainingSessionSets(env.DB, session.id, { sets: [{
    session_exercise_id: session.exercises[0].id,
    set_order: 1,
    load_value: 20,
    repetitions: null,
    rer: 2,
  }] }, fixedOptions("partial-set"));
}

it("keeps active drafts out of existing execution and load readers", async () => {
  await seedActiveSessionWithCompleteSet();
  expect((await getExecucaoData(env.DB)).rows).toEqual([]);
  expect((await getGestaoCargaData(env.DB)).sessoes).toEqual([]);
});

it("publishes only complete sets and maps RER to legacy rir", async () => {
  const session = await seedActiveSessionWithCompleteAndEmptySets();
  const result = await completeTrainingSession(env.DB, session.id, { session_pse: 8.5 }, fixedOptions());
  expect(result.publishedSetCount).toBe(1);
  const rows = (await getExecucaoData(env.DB)).rows;
  expect(rows[0]).toMatchObject({ id_ficha: "Livre", rir: 1.5, rpe_sessao: 8.5 });
});

it("returns the completed result idempotently without duplicating executions", async () => {
  const session = await seedActiveSessionWithCompleteSet();
  const first = await completeTrainingSession(env.DB, session.id, { session_pse: 8 }, fixedOptions());
  const second = await completeTrainingSession(env.DB, session.id, { session_pse: 8 }, fixedOptions());
  expect(second).toEqual(first);
  expect((await getExecucaoData(env.DB)).rows).toHaveLength(1);
});

it("rejects completion when every draft row is empty", async () => {
  const session = await startFreeWithExercise();
  await saveTrainingSessionSets(env.DB, session.id, { sets: [{
    session_exercise_id: session.exercises[0].id,
    set_order: 1,
    load_value: null,
    repetitions: null,
    rer: null,
  }] }, fixedOptions("empty-set"));
  await expect(completeTrainingSession(env.DB, session.id, { session_pse: 8 }, fixedOptions()))
    .rejects.toMatchObject({ code: "NO_COMPLETED_SETS" });
});

it("rejects partial sets and leaves the session active with no execution rows", async () => {
  const session = await seedPartialSetSession();
  await expect(completeTrainingSession(env.DB, session.id, { session_pse: 8 }, fixedOptions()))
    .rejects.toMatchObject({ code: "INCOMPLETE_SET" });
  expect(await getActiveTrainingSession(env.DB)).toMatchObject({ id: session.id });
  expect((await getExecucaoData(env.DB)).rows).toEqual([]);
});

it("cancels without publishing and permits a new session", async () => {
  const session = await seedActiveSessionWithCompleteSet();
  await cancelTrainingSession(env.DB, session.id, fixedOptions());
  expect((await getExecucaoData(env.DB)).rows).toEqual([]);
  await expect(startFree()).resolves.toMatchObject({ status: "in_progress" });
});

it.each([0.5, 1.25, 10.5])("rejects invalid session PSE %s", async (sessionPse) => {
  const session = await seedActiveSessionWithCompleteSet();
  await expect(completeTrainingSession(
    env.DB,
    session.id,
    { session_pse: sessionPse },
    fixedOptions("invalid-pse"),
  )).rejects.toMatchObject({ code: "INVALID_SESSION_PSE" });
});
```

- [ ] **Step 2: Run focused tests and confirm RED.**

Expected: missing completion/cancel exports.

- [ ] **Step 3: Implement final validation and stable publication ids.**

Classify sets as empty, complete or partial. Empty means all three values are null; complete means all three are non-null and valid. Reject zero complete sets with `NO_COMPLETED_SETS` and any partial row with `INCOMPLETE_SET`.

Use this identity policy:

```js
function executionIdentity(session) {
  const shortId = session.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12);
  if (session.mode === "free") {
    return { id_ficha: "Livre", id_treino: `TreinoLivre-${shortId}`, cycle: "0" };
  }
  return { id_ficha: session.id_ficha, id_treino: session.id_treino, cycle: String(session.cycle_reference) };
}
```

Build `id_sessao` as `<ficha>_<treino>_<exercicio>_W<ciclo>_<data-ISO>_<id-curto>_S<ordem>`, keeping ficha and treino as the first two underscore-delimited fields expected by the legacy parser. Convert ISO date to `DD/MM/YYYY` for `data_treino`.

- [ ] **Step 4: Publish and transition in one D1 batch.**

Insert every complete set with `ON CONFLICT(id_sessao) DO NOTHING`, `rir = rer`, `rpe_sessao = session_pse`, `sync_status = 'clean'` and `training_session_id = session.id`. Every insert must use `INSERT ... SELECT ... WHERE EXISTS (SELECT 1 FROM training_sessions WHERE id = ? AND status = 'in_progress')`; this prevents publication if a cancellation won a concurrent race. End the same transactional batch with:

```sql
UPDATE training_sessions
SET status = 'completed', session_pse = ?, completed_at = ?, updated_at = ?
WHERE id = ? AND status = 'in_progress'
```

Inspect the final update result. If `changes = 0`, reload the session: return the existing result when it is already completed, otherwise raise `SESSION_NOT_ACTIVE`. Because D1 executes `batch()` transactionally, the conditional inserts and state change either commit together or roll back together. If the session is already completed before the batch, return the stored session and count existing rows by `training_session_id`; do not insert again. Cancellation updates only the session status/timestamps and uses `WHERE status = 'in_progress'`.

- [ ] **Step 5: Run focused/full tests and commit.**

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/training-sessions.test.mjs tests/cloudflare/executions.test.mjs tests/cloudflare/bootstrap-load.test.mjs && npm test
bash scripts/git-workspace.sh add worker/src/training-sessions.js tests/cloudflare/training-sessions.test.mjs
bash scripts/git-workspace.sh commit -m "feat: finalize training sessions atomically"
```

### Task 5: Add authenticated session routes

**Files:**
- Modify: `worker/src/index.js`
- Create: `tests/cloudflare/training-session-routes.test.mjs`

**Interfaces:**
- Exposes the six authenticated routes defined in the spec.
- Maps `TrainingSessionError` validation errors to `422`, missing rows to `404`, conflict to `409` and inactive transitions to `409`.

- [ ] **Step 1: Write failing authenticated route tests against isolated D1 rows.**

```js
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";
import { authenticatedHeaders } from "./auth-helper.mjs";

async function request(path, options = {}) {
  const headers = await authenticatedHeaders({ Accept: "application/json" });
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await worker.fetch(new Request(`https://example.test${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env, {});
  return { status: response.status, body: await response.json() };
}

async function startFreeRoute(sessionDate = "2026-08-30") {
  return request("/api/training-sessions", {
    method: "POST",
    body: { mode: "free", session_date: sessionDate },
  });
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM training_session_sets"),
    env.DB.prepare("DELETE FROM training_session_exercises"),
    env.DB.prepare("DELETE FROM training_sessions"),
    env.DB.prepare("DELETE FROM execution_records"),
  ]);
  await env.DB.prepare(`
    INSERT INTO exercise_catalog (id_exercicio, is_active) VALUES (?, 1)
    ON CONFLICT(id_exercicio) DO UPDATE SET is_active = 1
  `).bind("Supino reto").run();
});

it("blocks session routes without Google authentication", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/training-sessions/active"), env, {});
  expect(response.status).toBe(401);
});

it("starts and reads the active session through protected routes", async () => {
  const response = await request("/api/training-sessions", {
    method: "POST",
    body: { mode: "free", session_date: "2026-08-30" },
  });
  expect(response.status).toBe(200);
  expect(response.body.data).toMatchObject({ mode: "free", status: "in_progress" });
  expect((await request("/api/training-sessions/active")).body.data.id).toBe(response.body.data.id);
});

it("returns null when there is no active session", async () => {
  const response = await request("/api/training-sessions/active");
  expect(response).toEqual({ status: 200, body: { success: true, data: null } });
});

it("returns 409 with the active session on a second start", async () => {
  await startFreeRoute();
  const response = await startFreeRoute("2026-08-31");
  expect(response).toMatchObject({ status: 409, body: { code: "ACTIVE_SESSION_EXISTS" } });
  expect(response.body.details.activeSession.status).toBe("in_progress");
});

it("saves exercises and sets, then completes through the protected routes", async () => {
  const started = await startFreeRoute();
  const sessionId = started.body.data.id;
  const exerciseResponse = await request(`/api/training-sessions/${sessionId}/exercises`, {
    method: "PUT",
    body: { exercises: [{ id_exercicio: "Supino reto", observations: "", source: "session" }] },
  });
  const exerciseId = exerciseResponse.body.data.exercises[0].id;
  expect(exerciseResponse.status).toBe(200);

  expect((await request(`/api/training-sessions/${sessionId}/sets`, {
    method: "PUT",
    body: { sets: [{
      session_exercise_id: exerciseId,
      set_order: 1,
      load_value: 20,
      repetitions: 10,
      rer: 1.5,
    }] },
  })).status).toBe(200);

  const completed = await request(`/api/training-sessions/${sessionId}/complete`, {
    method: "POST",
    body: { session_pse: 8.5 },
  });
  expect(completed).toMatchObject({
    status: 200,
    body: { data: { publishedSetCount: 1 } },
  });
});

it("cancels through the protected route without publishing", async () => {
  const started = await startFreeRoute();
  const response = await request(`/api/training-sessions/${started.body.data.id}/cancel`, {
    method: "POST",
    body: {},
  });
  expect(response).toMatchObject({ status: 200, body: { data: { status: "canceled" } } });
  expect((await env.DB.prepare("SELECT COUNT(*) AS count FROM execution_records").first()).count).toBe(0);
});
```

- [ ] **Step 2: Run the route test and confirm RED.**

Expected: `404 NOT_FOUND` for session routes.

- [ ] **Step 3: Wire service dependencies and route matching.**

Import the module functions. Extend `createWorker(options = {})` with injectable service functions, matching the existing catalog injection pattern. Add exact branches after authentication:

```js
GET    /api/training-sessions/active
POST   /api/training-sessions
PUT    /api/training-sessions/:id/exercises
PUT    /api/training-sessions/:id/sets
POST   /api/training-sessions/:id/complete
POST   /api/training-sessions/:id/cancel
```

Parse JSON through one helper that returns `INVALID_PAYLOAD` instead of a 500 for malformed JSON.

- [ ] **Step 4: Add one central `TrainingSessionError` envelope.**

```js
function trainingSessionErrorResponse(error) {
  const status = error.code === "SESSION_NOT_FOUND" ? 404
    : ["ACTIVE_SESSION_EXISTS", "SESSION_NOT_ACTIVE"].includes(error.code) ? 409
    : 422;
  return json({
    success: false,
    code: error.code,
    error: error.message,
    details: error.details,
  }, status);
}
```

- [ ] **Step 5: Run focused/full tests and commit.**

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test -- tests/cloudflare/training-session-routes.test.mjs && npm test
bash scripts/git-workspace.sh add worker/src/index.js tests/cloudflare/training-session-routes.test.mjs
bash scripts/git-workspace.sh commit -m "feat: expose training session API"
```

### Task 6: Build the two-state Treino screen without redesign

**Files:**
- Modify: `app/index.html`
- Modify: `app/script.html`
- Modify: `app/style.html`
- Modify: `tests/cloudflare/frontend-contract.test.cjs`
- Modify: `tests/app-regression.test.js`

**Interfaces:**
- Adds route keys `getActiveTrainingSession`, `startTrainingSession`, `saveTrainingSessionExercises`, `saveTrainingSessionSets`, `completeTrainingSession`, `cancelTrainingSession`.
- Adds App fields `activeTrainingSession`, `trainingMode`, `trainingDraftSyncState`, `trainingDraftTimer`.
- Adds App methods `loadActiveTrainingSession`, `startTrainingSession`, `renderTrainingStart`, `renderActiveTrainingSession`.

- [ ] **Step 1: Add failing static UI contracts.**

```js
assert.match(index, /id="treino-start-panel"/);
assert.match(index, /id="treino-mode-prescribed"/);
assert.match(index, /id="treino-mode-free"/);
assert.match(index, /id="treino-start-btn"/);
assert.match(index, /id="treino-active-panel"/);
assert.match(index, /id="treino-active-summary"/);
assert.match(script, /getActiveTrainingSession:\s*\{\s*method:\s*"GET"/);
assert.match(script, /startTrainingSession:\s*\{\s*method:\s*"POST"/);
assert.match(script, /activeTrainingSession:\s*null/);
assert.match(script, /renderTrainingStart:\s*function/);
assert.match(script, /renderActiveTrainingSession:\s*function/);
assert.doesNotMatch(index, /RIR/);
```

- [ ] **Step 2: Run frontend source tests and confirm RED.**

```bash
node tests/cloudflare/frontend-contract.test.cjs && node tests/app-regression.test.js
```

Expected: missing ids/routes/methods.

- [ ] **Step 3: Add semantic start/active containers using current classes.**

Move the current date/ficha/treino/cycle controls into `#treino-start-panel`; add two existing-style buttons for prescribed/free and `#treino-start-btn`. Add hidden `#treino-active-panel` containing `#treino-active-summary`, the existing `#treino-list`, add-exercise action, review/finalize action and cancel action. Do not add new colors, fonts, shadows or brand tokens.

- [ ] **Step 4: Add route mapping and recovery before initial render.**

Map these exact same-origin paths:

```js
getActiveTrainingSession: { method: "GET", path: "/api/training-sessions/active" },
startTrainingSession: { method: "POST", path: "/api/training-sessions" },
saveTrainingSessionExercises: { method: "PUT", path: "/api/training-sessions" },
saveTrainingSessionSets: { method: "PUT", path: "/api/training-sessions" },
completeTrainingSession: { method: "POST", path: "/api/training-sessions" },
cancelTrainingSession: { method: "POST", path: "/api/training-sessions" }
```

For the four session-id operations, `fetchServerAction` must validate `payload.session_id`, append `/<encoded-id>/exercises`, `/<encoded-id>/sets`, `/<encoded-id>/complete` or `/<encoded-id>/cancel`, and omit `session_id` from the JSON body. During `fetchInitialData`, request bootstrap and active session together. Apply the active session before `finishInitialRender` so selectors never flash when a session exists. On network failure, read `xs_active_training_session` and show its pending/offline state. Update the current empty-GET guard in `fetchServerAction`: allow `getActiveTrainingSession` to return `null`, while keeping the guard for every other `get*` action.

When a non-2xx response arrives, create an `Error` and attach `status`, `code` and `details` from the response body before rejecting. `startTrainingSession` uses those attached fields to recover `details.activeSession` from `409 ACTIVE_SESSION_EXISTS`; do not reduce the response to its message string.

- [ ] **Step 5: Implement mode/start rendering.**

`renderTreino` becomes a dispatcher:

```js
renderTreino: function renderTreino() {
  if (this.activeTrainingSession) {
    this.renderActiveTrainingSession();
  } else {
    this.renderTrainingStart();
  }
}
```

Start must reject offline use before calling the API. A `409 ACTIVE_SESSION_EXISTS` response must apply `details.activeSession` and render it instead of showing a generic error. Free mode hides ficha/treino/cycle; prescribed mode requires them.

- [ ] **Step 6: Build assets, run frontend/full tests and commit.**

```bash
npm run assets:build
node tests/cloudflare/frontend-contract.test.cjs
node tests/app-regression.test.js
node tests/frontend-polish.test.js
node tests/cloudflare/assets-build.test.cjs
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test
bash scripts/git-workspace.sh add app/index.html app/script.html app/style.html tests/cloudflare/frontend-contract.test.cjs tests/app-regression.test.js
bash scripts/git-workspace.sh commit -m "feat: add training session start flow"
```

### Task 7: Add offline drafts, free exercise editing and completion review

**Files:**
- Modify: `app/index.html`
- Modify: `app/script.html`
- Modify: `app/style.html`
- Modify: `tests/cloudflare/frontend-contract.test.cjs`
- Modify: `tests/app-regression.test.js`

**Interfaces:**
- Adds `saveActiveTrainingDraftLocal`, `scheduleTrainingDraftSync`, `flushTrainingDraft`, `completeActiveTrainingSession`, `cancelActiveTrainingSession`.
- Reuses the current catalog modal with `catalogMode = "training-session"`.
- Uses local key `xs_active_training_session` and does not remove it before server confirmation.

- [ ] **Step 1: Add failing behavior contracts.**

```js
assert.match(script, /saveActiveTrainingDraftLocal:\s*function/);
assert.match(script, /localStorage\.setItem\("xs_active_training_session"/);
assert.match(script, /scheduleTrainingDraftSync:\s*function/);
assert.match(script, /catalogMode\s*=\s*"training-session"/);
assert.match(script, /step="0\.5"[^>]*placeholder="RER"|placeholder="RER"[^>]*step="0\.5"/);
assert.match(index, /id="training-complete-modal"/);
assert.match(index, /id="training-session-pse"/);
assert.match(script, /completeActiveTrainingSession:\s*function/);
assert.match(script, /cancelActiveTrainingSession:\s*function/);
```

- [ ] **Step 2: Run source tests and confirm RED.**

Expected: missing draft, RER and completion behaviors.

- [ ] **Step 3: Convert current exercise cards to session draft fields.**

Render from `activeTrainingSession.exercises`, not `prescricaoCache`. Use `parseFloat` for RER and `<input type="number" min="0" max="10" step="0.5" placeholder="RER">`. Keep load zero valid by distinguishing empty string from numeric zero. Every input event updates the in-memory session, writes local cache immediately and schedules a 600 ms server sync when online.

- [ ] **Step 4: Route exercise additions/removals/reorder through the session draft.**

The existing catalog modal remains visually unchanged. In `training-session` mode, selecting an active catalog exercise appends a session exercise with a temporary client id, persists locally and sends the full exercise array. Client ids prefixed with `local-` must be omitted from the API exercise payload; after the response, map definitive exercise ids back by the unique `id_exercicio` value without overwriting newer local input values. Removal and reorder use the same full-array endpoint; do not mutate `prescricaoCache`.

- [ ] **Step 5: Implement pending recovery and flush.**

Keep `trainingDraftSyncState` as `saved`, `saving` or `pending`. When the browser returns online, call `flushTrainingDraft` before any other session action. A flush is strictly sequential: save exercises first, replace every `local-` exercise id with the definitive server id, remap each set's `session_exercise_id`, then save sets. Never clear `xs_active_training_session` until start/cancel/complete receives a server-confirmed aggregate. On recovery, merge a pending cache only when its session id matches the server active id; local exercise/set values win because they are not yet confirmed. If ids differ, keep the unmatched cache under `xs_training_session_recovery` and load the server session without silently combining them.

- [ ] **Step 6: Implement review, PSE, completion and cancel.**

Build the review from current draft rows: count complete, empty and partial sets. Block opening confirmation when no complete sets; highlight partial rows and return to them. The modal uses the existing RPE modal visual classes but labels the slider **PSE da sessão**, `min=1`, `max=10`, `step=0.5`.

Before completion: require `navigator.onLine`, flush drafts, then call complete. On success remove local active cache, apply fresh executions/bootstrap data and render the start state. Cancellation requires `window.confirm` or an existing-style confirmation modal, requires online, calls cancel, then clears cache only on success.

- [ ] **Step 7: Run frontend/full tests and commit.**

Use the same asset/frontend/full suite from Task 6. Expected: all PASS.

```bash
bash scripts/git-workspace.sh add app/index.html app/script.html app/style.html tests/cloudflare/frontend-contract.test.cjs tests/app-regression.test.js
bash scripts/git-workspace.sh commit -m "feat: execute and finalize training session drafts"
```

### Task 8: Document, migrate, deploy and perform acceptance

**Files:**
- Create: `docs/guias-operacionais/08-sessao-treino-e-treino-livre.md`
- Modify: `docs/RESUMO_PROJETO.md`

**Interfaces:**
- Documents prescribed/free start, offline draft, completion, cancellation and recovery.
- Records that unlimited cycles and periodization remain the next project.

- [ ] **Step 1: Write the operating guide before remote changes.**

Document beginner steps for:

1. starting prescribed and free sessions;
2. recognizing the active-session lock;
3. filling load, reps and RER;
4. recovering after reload/offline use;
5. correcting partial rows;
6. entering PSE and completing;
7. canceling without creating history;
8. diagnosing start/finalize connectivity errors.

- [ ] **Step 2: Run all verification locally.**

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm test
npm run assets:build
node tests/cloudflare/frontend-contract.test.cjs
node tests/app-regression.test.js
node tests/frontend-polish.test.js
node tests/cloudflare/assets-build.test.cjs
bash scripts/git-workspace.sh diff --check
```

Expected: every automated test PASS and `diff --check` prints nothing.

- [ ] **Step 3: Apply the remote migration before Worker deployment.**

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npx wrangler d1 migrations apply xsteam-pwa-staging --remote
```

Expected: `0003_training_sessions.sql` shows success. If it fails, stop; do not deploy Worker code.

- [ ] **Step 4: Deploy and verify unauthenticated protection.**

```bash
source /home/elohimlima/.nvm/nvm.sh && nvm use 24.19.0 >/dev/null && npm run deploy
curl -sS -o /tmp/xsteam-session-auth.json -w '%{http_code}\n' https://xsteam-pwa.fitmanagement-els.workers.dev/api/training-sessions/active
```

Expected: deploy success with the existing Worker URL and `401` from the unauthenticated API check.

- [ ] **Step 5: Perform authenticated manual acceptance without disturbing production history.**

First start a free session, add one exercise/set, reload and verify recovery, then cancel it. Confirm remote read-only counts show no new executions from the canceled session. Do not create a fake completed workout in the operational history: perform completion acceptance on the user's next real workout, then confirm exactly its valid sets appear with one `training_session_id`. Never delete or modify older executions.

Read-only checks:

```sql
SELECT id, mode, status, session_date FROM training_sessions ORDER BY started_at DESC LIMIT 5;
SELECT training_session_id, COUNT(*) AS set_count
FROM execution_records
WHERE training_session_id <> ''
GROUP BY training_session_id;
```

- [ ] **Step 6: Update project status and commit documentation.**

```bash
bash scripts/git-workspace.sh add docs/guias-operacionais/08-sessao-treino-e-treino-livre.md docs/RESUMO_PROJETO.md
bash scripts/git-workspace.sh commit -m "docs: add training session operation guide"
```

## Plan Self-Review

| Specification requirement | Plan task |
| --- | --- |
| Single active session enforced in D1 | 1, 2 |
| Prescribed snapshot and free empty session | 2 |
| Draft exercises/sets and half-step RER | 3 |
| Drafts absent from History/Load | 4 |
| Atomic idempotent completion and PSE | 4 |
| Authenticated APIs and conflict recovery | 5 |
| Two-state Treino screen, existing visual design | 6 |
| Offline local-first entry and cloud recovery | 7 |
| Completion review and cancellation | 7 |
| Non-destructive migration and protected deploy | 8 |
| Existing history preservation | 1, 4, 8 |
| Unlimited cycles/periodization deferred | Global constraints, 8 |
