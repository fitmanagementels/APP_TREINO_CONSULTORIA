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

describe("training session routes", () => {
  it("blocks session routes without Google authentication", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api/training-sessions/active"),
      env,
      {},
    );
    expect(response.status).toBe(401);
  });

  it("returns null when there is no active session", async () => {
    const response = await request("/api/training-sessions/active");
    expect(response).toEqual({
      status: 200,
      body: { success: true, data: null },
    });
  });

  it("starts and reads the active session through protected routes", async () => {
    const response = await startFreeRoute();
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ mode: "free", status: "in_progress" });
    expect((await request("/api/training-sessions/active")).body.data.id)
      .toBe(response.body.data.id);
  });

  it("returns 409 with the active session on a second start", async () => {
    await startFreeRoute();
    const response = await startFreeRoute("2026-08-31");
    expect(response).toMatchObject({
      status: 409,
      body: { code: "ACTIVE_SESSION_EXISTS" },
    });
    expect(response.body.details.activeSession.status).toBe("in_progress");
  });

  it("saves exercises and sets, then completes through protected routes", async () => {
    const started = await startFreeRoute();
    const sessionId = started.body.data.id;
    const exerciseResponse = await request(`/api/training-sessions/${sessionId}/exercises`, {
      method: "PUT",
      body: {
        exercises: [{ id_exercicio: "Supino reto", observations: "", source: "session" }],
      },
    });
    expect(exerciseResponse.status).toBe(200);
    const exerciseId = exerciseResponse.body.data.exercises[0].id;

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
    expect(response).toMatchObject({
      status: 200,
      body: { data: { status: "canceled" } },
    });
    expect((await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM execution_records",
    ).first()).count).toBe(0);
  });

  it("returns a validation envelope for malformed JSON", async () => {
    const response = await worker.fetch(new Request(
      "https://example.test/api/training-sessions",
      {
        method: "POST",
        headers: await authenticatedHeaders({ "content-type": "application/json" }),
        body: "{",
      },
    ), env, {});
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "INVALID_PAYLOAD",
    });
  });
});
