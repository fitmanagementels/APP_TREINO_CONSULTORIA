import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";

describe("D1 schema", () => {
  it("stores core rows and reports database counts", async () => {
    await env.DB.prepare(
      "INSERT INTO exercise_catalog (id_exercicio, grupo_principal, tipo) VALUES (?, ?, ?)",
    )
      .bind("Supino reto", "Peito", "Composto")
      .run();

    await env.DB.prepare(
      "INSERT INTO execution_records (id_sessao, data_treino, id_exercicio, semana_referencia, carga_absoluta, reps_executadas, rir, rpe_sessao) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind("2026-08-29|Ficha A|Treino A|Supino reto|1", "29/08/2026", "Supino reto", "1", 80, 8, 2, 8)
      .run();

    const response = await worker.fetch(
      new Request("https://example.test/api/status"),
      env,
      {},
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        service: "xsteam-pwa",
        database: "ok",
        prescriptionRows: 0,
        executionRows: 1,
      },
    });
  });
});
