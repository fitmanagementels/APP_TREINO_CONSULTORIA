import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getCatalogSyncStatus,
  parseReferenceCatalogCsv,
  syncReferenceCatalog,
} from "../../worker/src/catalog.js";

const fixedNow = new Date("2026-08-30T04:00:00.000Z");
const laterNow = new Date("2026-08-31T04:00:00.000Z");
const csvFixture = [
  "Exercício,Link do vídeo,Grupo muscular,N-articulação,Tipo,Glúteos,Quadríceps,Eretores",
  'Agachamento com barra livre,https://video.example/agachamento,Quadríceps,Multiarticular,,1,1,"0,25"',
  "Desenvolvimento com halteres sentado,https://video.example/desenvolvimento,Ombros,Multiarticular,Composto,0,0,0",
].join("\n");

function csvResponse(csvText) {
  return new Response(csvText, { status: 200, headers: { "content-type": "text/csv" } });
}

async function activeCatalogNames() {
  const { results } = await env.DB.prepare(
    "SELECT id_exercicio FROM exercise_catalog WHERE is_active = 1 ORDER BY id_exercicio",
  ).all();
  return results.map((row) => row.id_exercicio);
}

async function inactiveCatalogNames() {
  const { results } = await env.DB.prepare(
    "SELECT id_exercicio FROM exercise_catalog WHERE is_active = 0 ORDER BY id_exercicio",
  ).all();
  return results.map((row) => row.id_exercicio);
}

async function prescriptionNames() {
  const { results } = await env.DB.prepare(
    "SELECT id_exercicio FROM prescription_exercises ORDER BY ordem_exercicio",
  ).all();
  return results.map((row) => row.id_exercicio);
}

async function executionNames() {
  const { results } = await env.DB.prepare(
    "SELECT id_exercicio FROM execution_records ORDER BY id_sessao",
  ).all();
  return results.map((row) => row.id_exercicio);
}

async function seedOldCatalogAndRecords() {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio) VALUES (?)")
      .bind("Agachamento livre com barra nas costas"),
    env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio) VALUES (?)")
      .bind("Desenvolvimento com halter"),
    env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio) VALUES (?)")
      .bind("Exercício removido"),
    env.DB.prepare(
      "INSERT INTO prescription_exercises (id_ficha, id_treino, id_exercicio, ordem_exercicio) VALUES (?, ?, ?, ?)",
    ).bind("Ficha A", "Treino A", "Agachamento livre com barra nas costas", 1),
    env.DB.prepare(
      "INSERT INTO prescription_exercises (id_ficha, id_treino, id_exercicio, ordem_exercicio) VALUES (?, ?, ?, ?)",
    ).bind("Ficha A", "Treino A", "Desenvolvimento com halter", 2),
    env.DB.prepare(
      "INSERT INTO execution_records (id_sessao, data_treino, id_exercicio, carga_absoluta, reps_executadas, rir, rpe_sessao) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("sessao-historica", "30/08/2026", "Agachamento livre com barra nas costas", 80, 8, 2, 8),
  ]);
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM prescription_exercises"),
    env.DB.prepare("DELETE FROM exercise_muscle_demands"),
    env.DB.prepare("DELETE FROM exercise_catalog"),
    env.DB.prepare("DELETE FROM execution_records"),
    env.DB.prepare(
      "UPDATE catalog_sync_state SET source_hash = '', last_attempt_at = '', last_success_at = '', active_exercise_count = 0, last_error = '' WHERE id = 1",
    ),
  ]);
});

describe("reference exercise catalog", () => {
  it("normalizes the public sheet columns and Brazilian decimal demands", () => {
    expect(parseReferenceCatalogCsv(csvFixture)).toEqual([
      expect.objectContaining({
        id_exercicio: "Agachamento com barra livre",
        grupo_principal: "Quadríceps",
        categoria_articular: "Multiarticular",
        tipo: "",
        demands: expect.objectContaining({ Glúteos: 1, Quadríceps: 1, Eretores: 0.25 }),
      }),
      expect.objectContaining({ id_exercicio: "Desenvolvimento com halteres sentado" }),
    ]);
  });

  it("rejects duplicate names and leaves D1 unchanged", async () => {
    await env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio) VALUES (?)")
      .bind("Catálogo anterior")
      .run();
    const duplicateFixture = `${csvFixture}\nAgachamento com barra livre,https://video.example/outro,Quadríceps,Multiarticular,,1,1,0`;

    await expect(syncReferenceCatalog({
      db: env.DB,
      fetchReference: async () => csvResponse(duplicateFixture),
      now: fixedNow,
    })).rejects.toMatchObject({ code: "INVALID_REFERENCE_CATALOG" });

    expect(await activeCatalogNames()).toEqual(["Catálogo anterior"]);
  });

  it("maps approved first-sync prescription names, inactivates missing catalog rows, and preserves executions", async () => {
    await seedOldCatalogAndRecords();

    const result = await syncReferenceCatalog({
      db: env.DB,
      fetchReference: async () => csvResponse(csvFixture),
      now: fixedNow,
    });

    expect(result).toMatchObject({ changed: true, activeExerciseCount: 2, substitutionsApplied: 2 });
    expect(await prescriptionNames()).toEqual([
      "Agachamento com barra livre",
      "Desenvolvimento com halteres sentado",
    ]);
    expect(await inactiveCatalogNames()).toContain("Exercício removido");
    expect(await executionNames()).toContain("Agachamento livre com barra nas costas");
  });

  it("does not rewrite catalog rows when the source hash is unchanged", async () => {
    await syncReferenceCatalog({
      db: env.DB,
      fetchReference: async () => csvResponse(csvFixture),
      now: fixedNow,
    });
    const firstSourceTime = await env.DB.prepare(
      "SELECT source_updated_at FROM exercise_catalog WHERE id_exercicio = ?",
    ).bind("Agachamento com barra livre").first();

    const second = await syncReferenceCatalog({
      db: env.DB,
      fetchReference: async () => csvResponse(csvFixture),
      now: laterNow,
    });

    const secondSourceTime = await env.DB.prepare(
      "SELECT source_updated_at FROM exercise_catalog WHERE id_exercicio = ?",
    ).bind("Agachamento com barra livre").first();
    expect(second.changed).toBe(false);
    expect(firstSourceTime).toEqual(secondSourceTime);
    expect(await getCatalogSyncStatus(env.DB)).toMatchObject({
      lastSuccessAt: fixedNow.toISOString(),
      lastAttemptAt: laterNow.toISOString(),
      activeExerciseCount: 2,
      lastError: "",
    });
  });
});
