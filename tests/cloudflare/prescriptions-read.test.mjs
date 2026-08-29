import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";
import { authenticatedHeaders } from "./auth-helper.mjs";

async function request(path) {
  const response = await worker.fetch(new Request(`https://example.test${path}`, {
    headers: await authenticatedHeaders(),
  }), env, {});
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM prescription_exercises"),
    env.DB.prepare("DELETE FROM exercise_muscle_demands"),
    env.DB.prepare("DELETE FROM exercise_catalog"),
  ]);

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO exercise_catalog (id_exercicio, grupo_principal, tipo) VALUES (?, ?, ?)",
    ).bind("Supino reto", "Peito", "Composto"),
    env.DB.prepare(
      "INSERT INTO exercise_catalog (id_exercicio, grupo_principal, tipo) VALUES (?, ?, ?)",
    ).bind("Crucifixo", "Peito", "Isolador"),
    env.DB.prepare(
      "INSERT INTO exercise_muscle_demands (id_exercicio, muscle_name, demand) VALUES (?, ?, ?)",
    ).bind("Supino reto", "Peitoral", 1),
    env.DB.prepare(
      "INSERT INTO prescription_exercises (id_ficha, id_treino, id_exercicio, ordem_exercicio, semana_1_sets, semana_1_reps, semana_1_descanso) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("Ficha A", "Treino A", "Crucifixo", 2, "3", "12", "60"),
    env.DB.prepare(
      "INSERT INTO prescription_exercises (id_ficha, id_treino, id_exercicio, ordem_exercicio, semana_1_sets, semana_1_reps, semana_1_descanso) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind("Ficha A", "Treino A", "Supino reto", 1, "4", "8", "90"),
  ]);
});

describe("prescription read API", () => {
  it("returns prescription rows in exercise order", async () => {
    const { status, body } = await request("/api/prescriptions");

    expect(status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        rows: [
          expect.objectContaining({
            id_ficha: "Ficha A",
            id_treino: "Treino A",
            id_exercicio: "Supino reto",
            nome_exercicio: "Supino reto",
            ordem_exercicio: 1,
            semana_1_sets: "4",
          }),
          expect.objectContaining({ id_exercicio: "Crucifixo", ordem_exercicio: 2 }),
        ],
      },
    });
  });

  it("returns catalog and editor grouping without load data", async () => {
    const { status, body } = await request("/api/prescription-editor");

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.fichas).toEqual(["Ficha A"]);
    expect(body.data.treinosPorFicha).toEqual({ "Ficha A": ["Treino A"] });
    expect(body.data.catalogo.musculos).toEqual(["Peitoral"]);
    expect(body.data.catalogo.rows).toContainEqual({
      id_exercicio: "Supino reto",
      nome: "Supino reto",
      grupo_principal: "Peito",
      tipo: "Composto",
      demandas: { Peitoral: 1 },
    });
    expect(body.data).not.toHaveProperty("carga");
  });
});
