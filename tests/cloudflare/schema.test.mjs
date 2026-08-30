import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";
import { authenticatedHeaders } from "./auth-helper.mjs";

describe("D1 schema", () => {
  it("stores catalog source metadata and one synchronization state row", async () => {
    const state = await env.DB.prepare(
      "SELECT id, source_hash, active_exercise_count FROM catalog_sync_state WHERE id = 1",
    ).first();

    await env.DB.prepare(
      "INSERT INTO exercise_catalog (id_exercicio, video_url, categoria_articular, is_active, source_updated_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind("Supino reto de catálogo", "https://video.example/supino", "Multiarticular", 1, "2026-08-30T00:00:00.000Z")
      .run();

    const row = await env.DB.prepare(
      "SELECT video_url, categoria_articular, is_active FROM exercise_catalog WHERE id_exercicio = ?",
    )
      .bind("Supino reto de catálogo")
      .first();

    expect(state).toEqual(expect.objectContaining({ id: 1, source_hash: "", active_exercise_count: 0 }));
    expect(row).toEqual({
      video_url: "https://video.example/supino",
      categoria_articular: "Multiarticular",
      is_active: 1,
    });
  });

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
      new Request("https://example.test/api/status", { headers: await authenticatedHeaders() }),
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
