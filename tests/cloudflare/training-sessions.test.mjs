import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getActiveTrainingSession,
  saveTrainingSessionExercises,
  saveTrainingSessionSets,
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
  await env.DB.prepare(`
    INSERT INTO exercise_catalog (id_exercicio, is_active) VALUES (?, 1)
    ON CONFLICT(id_exercicio) DO UPDATE SET is_active = 1
  `).bind(row.id_exercicio).run();
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

describe("training session lifecycle", () => {
  it("starts a free session with no exercises and recovers it", async () => {
    const session = await startFree();
    expect(session).toMatchObject({
      mode: "free",
      status: "in_progress",
      exercises: [],
    });
    await expect(getActiveTrainingSession(env.DB)).resolves.toEqual(session);
  });

  it.each(["", "30/08/2026", "2026-02-30"])(
    "rejects invalid session date %s",
    async (sessionDate) => {
      await expect(startTrainingSession(env.DB, {
        mode: "free",
        session_date: sessionDate,
      }, fixedOptions())).rejects.toMatchObject({ code: "INVALID_SESSION" });
    },
  );

  it("snapshots the selected prescribed cycle with persistent empty sets", async () => {
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

  it("uses one initial set when the prescribed set value has no positive leading integer", async () => {
    await seedPrescription({
      id_ficha: "Manutenção",
      id_treino: "Base MMII 1",
      id_exercicio: "Agachamento com barra livre",
      semana_2_sets: "",
    });
    const session = await startTrainingSession(env.DB, {
      mode: "prescribed",
      session_date: "2026-08-30",
      id_ficha: "Manutenção",
      id_treino: "Base MMII 1",
      cycle_reference: 2,
    }, fixedOptions());
    expect(session.exercises[0].sets).toHaveLength(1);
  });

  it("rejects prescribed sessions without a complete selection", async () => {
    await expect(startTrainingSession(env.DB, {
      mode: "prescribed",
      session_date: "2026-08-30",
      id_ficha: "",
      id_treino: "",
      cycle_reference: 5,
    }, fixedOptions())).rejects.toMatchObject({ code: "INVALID_SESSION" });
  });

  it("rejects a prescribed selection with no active catalog exercises", async () => {
    await expect(startTrainingSession(env.DB, {
      mode: "prescribed",
      session_date: "2026-08-30",
      id_ficha: "Inexistente",
      id_treino: "Inexistente",
      cycle_reference: 1,
    }, fixedOptions())).rejects.toMatchObject({ code: "PRESCRIPTION_NOT_FOUND" });
  });

  it("returns the existing active session instead of creating another", async () => {
    await startFree();
    await expect(startTrainingSession(
      env.DB,
      { mode: "free", session_date: "2026-08-31" },
      fixedOptions("second"),
    )).rejects.toMatchObject({
      code: "ACTIVE_SESSION_EXISTS",
      details: { activeSession: expect.any(Object) },
    });
  });

  it("adds active catalog exercises and preserves ids while reordering", async () => {
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
    expect(reordered.exercises.map((row) => row.id)).toEqual(
      updated.exercises.map((row) => row.id).reverse(),
    );
  });

  it("rejects a new exercise that is inactive in the catalog", async () => {
    const session = await startFree();
    await env.DB.prepare("UPDATE exercise_catalog SET is_active = 0 WHERE id_exercicio = ?")
      .bind("Supino reto")
      .run();
    await expect(saveTrainingSessionExercises(env.DB, session.id, {
      exercises: [{ id_exercicio: "Supino reto", observations: "" }],
    }, fixedOptions("inactive"))).rejects.toMatchObject({ code: "INVALID_EXERCISE" });
  });

  it("removes omitted exercises and their set drafts", async () => {
    const session = await startFreeWithExercise();
    const exerciseId = session.exercises[0].id;
    await saveTrainingSessionSets(env.DB, session.id, {
      sets: [validSet({ session_exercise_id: exerciseId })],
    }, fixedOptions("remove-set"));
    const emptied = await saveTrainingSessionExercises(
      env.DB,
      session.id,
      { exercises: [] },
      fixedOptions("remove-exercise"),
    );
    expect(emptied.exercises).toEqual([]);
    expect((await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM training_session_sets WHERE session_id = ?",
    ).bind(session.id).first()).count).toBe(0);
  });

  it("accepts complete, empty and half-step RER drafts", async () => {
    const session = await startFreeWithExercise();
    const exerciseId = session.exercises[0].id;
    const updated = await saveTrainingSessionSets(env.DB, session.id, { sets: [
      {
        session_exercise_id: exerciseId,
        set_order: 1,
        load_value: 0,
        repetitions: 12,
        rer: 1.5,
      },
      {
        session_exercise_id: exerciseId,
        set_order: 2,
        load_value: null,
        repetitions: null,
        rer: null,
      },
    ] }, fixedOptions("set"));
    expect(updated.exercises[0].sets).toHaveLength(2);
    expect(updated.exercises[0].sets[0]).toMatchObject({ load_value: 0, rer: 1.5 });
  });

  it("allows partial set drafts before finalization", async () => {
    const session = await startFreeWithExercise();
    const updated = await saveTrainingSessionSets(env.DB, session.id, { sets: [{
      session_exercise_id: session.exercises[0].id,
      set_order: 1,
      load_value: 20,
      repetitions: null,
      rer: 2,
    }] }, fixedOptions("partial"));
    expect(updated.exercises[0].sets[0].repetitions).toBeNull();
  });

  it.each([-0.5, 0.25, 10.5])("rejects invalid RER %s", async (rer) => {
    const session = await startFreeWithExercise();
    const sessionExerciseId = session.exercises[0].id;
    await expect(saveTrainingSessionSets(env.DB, session.id, {
      sets: [validSet({ session_exercise_id: sessionExerciseId, rer })],
    }, fixedOptions("invalid-set"))).rejects.toMatchObject({ code: "INVALID_RER" });
  });

  it("rejects a set that points to another session exercise", async () => {
    const session = await startFreeWithExercise();
    await expect(saveTrainingSessionSets(env.DB, session.id, {
      sets: [validSet({ session_exercise_id: "missing-exercise" })],
    }, fixedOptions("foreign-set"))).rejects.toMatchObject({ code: "INVALID_SET" });
  });
});
