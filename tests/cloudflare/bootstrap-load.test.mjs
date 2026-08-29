import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";

async function get(path) {
  const response = await worker.fetch(new Request(`https://example.test${path}`), env, {});
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM execution_records"),
    env.DB.prepare("DELETE FROM prescription_exercises"),
    env.DB.prepare("DELETE FROM exercise_muscle_demands"),
    env.DB.prepare("DELETE FROM exercise_catalog"),
  ]);
  await env.DB.prepare(
    "INSERT INTO execution_records (id_sessao, data_treino, id_exercicio, semana_referencia, carga_absoluta, reps_executadas, rir, rpe_sessao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind("Ficha A_Treino A_Supino reto_W1_2026-08-29_S1", "29/08/2026", "Supino reto", "1", 80, 8, 2, 8)
    .run();
});

describe("bootstrap and load API", () => {
  it("loads only essential prescription and history data at boot", async () => {
    const result = await get("/api/bootstrap");

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data).toEqual(expect.objectContaining({
      prescricao: { rows: [] },
      historico: { rows: [expect.objectContaining({ id_exercicio: "Supino reto" })] },
      errors: [],
      error: "",
    }));
    expect(result.body.data).not.toHaveProperty("carga");
  });

  it("calculates session load without creating summaries", async () => {
    const result = await get("/api/load");

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      success: true,
      data: expect.objectContaining({
        exercicios: ["Supino reto"],
        e1rmByExercise: {
          "Supino reto": [{ data: "29/08/2026", e1rm: 101.3, carga: 80 }],
        },
        sessoes: [expect.objectContaining({
          idSessaoGrupo: "29/08/2026|Ficha A|Treino A",
          data: "29/08/2026",
          id_ficha: "Ficha A",
          id_treino: "Treino A",
          totalExercicios: 1,
          totalSeries: 1,
          volumeTotal: 640,
          rpeMedia: 8,
          exercicioPrincipal: "Supino reto",
          melhorE1rmSessao: 101.3,
          maiorCargaSessao: 80,
          duracaoEstimadaMin: 3,
          origemDados: "DB_Execucao",
        })],
      }),
    });
    const table = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_summaries'",
    ).first();
    expect(table).toBeNull();
  });
});
