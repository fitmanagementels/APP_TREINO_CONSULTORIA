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
});
