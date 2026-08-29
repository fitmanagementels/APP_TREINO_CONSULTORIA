import { describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";
import { createSession } from "../../worker/src/auth.js";

const authEnv = {
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  ALLOWED_GOOGLE_EMAIL: "allowed@example.test",
  SESSION_SECRET: "test-session-secret",
};

async function authRequest(path) {
  const session = await createSession(authEnv.ALLOWED_GOOGLE_EMAIL, authEnv.SESSION_SECRET);
  return new Request(`https://example.test${path}`, { headers: { cookie: `xs_session=${session}` } });
}

describe("API routing", () => {
  it("returns a stable JSON error envelope for unknown API routes", async () => {
    const response = await worker.fetch(
      await authRequest("/api/unknown"),
      { ...authEnv, DB: { prepare() { throw new Error("DB should be added next"); } } },
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
      await authRequest("/api/status"),
      {
        ...authEnv,
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
