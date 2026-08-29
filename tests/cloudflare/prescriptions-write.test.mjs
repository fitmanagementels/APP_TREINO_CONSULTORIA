import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";
import { authenticatedHeaders } from "./auth-helper.mjs";

async function save(idFicha, idTreino, exercicios) {
  const response = await worker.fetch(
    new Request(
      `https://example.test/api/prescriptions/${encodeURIComponent(idFicha)}/${encodeURIComponent(idTreino)}`,
      {
        method: "PUT",
        headers: await authenticatedHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ exercicios }),
      },
    ),
    env,
    {},
  );
  return { status: response.status, body: await response.json() };
}

async function rowsFor(idTreino) {
  const { results } = await env.DB.prepare(
    "SELECT id_treino, id_exercicio, ordem_exercicio FROM prescription_exercises WHERE id_ficha = ? AND id_treino = ? ORDER BY ordem_exercicio",
  )
    .bind("Ficha A", idTreino)
    .all();
  return results;
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM prescription_exercises"),
    env.DB.prepare("DELETE FROM exercise_muscle_demands"),
    env.DB.prepare("DELETE FROM exercise_catalog"),
  ]);

  await env.DB.batch([
    env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio) VALUES (?)").bind("Supino reto"),
    env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio) VALUES (?)").bind("Crucifixo"),
    env.DB.prepare("INSERT INTO exercise_catalog (id_exercicio) VALUES (?)").bind("Remada baixa"),
    env.DB.prepare(
      "INSERT INTO prescription_exercises (id_ficha, id_treino, id_exercicio, ordem_exercicio) VALUES (?, ?, ?, ?)",
    ).bind("Ficha A", "Treino A", "Remada baixa", 1),
    env.DB.prepare(
      "INSERT INTO prescription_exercises (id_ficha, id_treino, id_exercicio, ordem_exercicio) VALUES (?, ?, ?, ?)",
    ).bind("Ficha A", "Treino B", "Crucifixo", 1),
  ]);
});

describe("prescription write API", () => {
  it("rejects an unknown exercise without changing the selected treino", async () => {
    const result = await save("Ficha A", "Treino A", [{ id_exercicio: "Não cadastrado" }]);

    expect(result.status).toBe(422);
    expect(result.body).toEqual({
      success: false,
      code: "INVALID_EXERCISE",
      error: "Exercício fora do catálogo: Não cadastrado.",
    });
    expect(await rowsFor("Treino A")).toEqual([
      expect.objectContaining({ id_exercicio: "Remada baixa", ordem_exercicio: 1 }),
    ]);
  });

  it("replaces only the selected ficha and treino in exercise order", async () => {
    const result = await save("Ficha A", "Treino A", [
      { id_exercicio: "Supino reto", observacoes: "Controlar descida", ciclos: [{ sets: "4", reps: "8", descanso: "90" }] },
      { id_exercicio: "Crucifixo", semana_1_sets: "3", semana_1_reps: "12", semana_1_descanso: "60" },
    ]);

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(await rowsFor("Treino A")).toEqual([
      expect.objectContaining({ id_exercicio: "Supino reto", ordem_exercicio: 1 }),
      expect.objectContaining({ id_exercicio: "Crucifixo", ordem_exercicio: 2 }),
    ]);
    expect(await rowsFor("Treino B")).toEqual([
      expect.objectContaining({ id_exercicio: "Crucifixo", ordem_exercicio: 1 }),
    ]);
  });
});
