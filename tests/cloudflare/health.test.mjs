import { describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";

describe("API routing", () => {
  it("returns a stable JSON error envelope for unknown API routes", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api/unknown"),
      { DB: { prepare() { throw new Error("DB should be added next"); } } },
      {},
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "NOT_FOUND",
      error: "Rota não encontrada.",
    });
  });

  it("does not expose an unexpected database error through an API response", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api/status"),
      {
        DB: {
          batch: async () => {
            throw new Error("connection details must stay private");
          },
        },
      },
      {},
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "INTERNAL_ERROR",
      error: "Erro interno do serviço.",
    });
  });
});
