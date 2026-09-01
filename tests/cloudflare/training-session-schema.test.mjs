import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

const timestamp = "2026-08-30T12:00:00.000Z";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM training_session_sets"),
    env.DB.prepare("DELETE FROM training_session_exercises"),
    env.DB.prepare("DELETE FROM training_sessions"),
    env.DB.prepare("DELETE FROM execution_records WHERE id_sessao = 'legacy-session'"),
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
