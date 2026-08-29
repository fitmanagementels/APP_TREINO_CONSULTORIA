import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";

const sessionId = "Ficha A_Treino A_Supino reto_W1_2026-08-29_S1";

async function call(path, init) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, init), env, {});
  return { status: response.status, body: await response.json() };
}

async function sync(record) {
  return call("/api/executions/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records: [record] }),
  });
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM execution_records").run();
});

describe("execution sync API", () => {
  it("upserts a repeated session id and acknowledges it as clean", async () => {
    const initial = {
      id_sessao: sessionId,
      data_treino: "29/08/2026",
      id_exercicio: "Supino reto",
      semana_referencia: "1",
      carga_absoluta: 80,
      reps_executadas: 8,
      rir: 2,
      rpe_sessao: 8,
    };

    const first = await sync(initial);
    const second = await sync({ ...initial, rpe_sessao: 9 });

    expect(first).toEqual({
      status: 200,
      body: { success: true, data: { synced: 1, acceptedSessionIds: [sessionId] } },
    });
    expect(second.status).toBe(200);

    const history = await call("/api/executions");
    expect(history.status).toBe(200);
    expect(history.body.data.rows).toEqual([
      expect.objectContaining({
        id_sessao: sessionId,
        id_ficha: "Ficha A",
        id_treino: "Treino A",
        id_exercicio: "Supino reto",
        rpe_sessao: 9,
        sync_status: "clean",
      }),
    ]);
  });

  it("rejects an invalid batch without writing any record", async () => {
    const invalid = await call("/api/executions/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ records: [{ id_sessao: "", data_treino: "29/08/2026" }] }),
    });

    expect(invalid).toEqual({
      status: 422,
      body: { success: false, code: "INVALID_EXECUTION", error: "id_sessao obrigatório." },
    });
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM execution_records").first();
    expect(count.count).toBe(0);
  });
});
