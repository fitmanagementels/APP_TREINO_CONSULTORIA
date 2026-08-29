import { describe, expect, it } from "vitest";
import { createSession } from "../../worker/src/auth.js";
import worker, { createWorker } from "../../worker/src/index.js";

const authEnv = {
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  ALLOWED_GOOGLE_EMAIL: "allowed@example.test",
  SESSION_SECRET: "test-session-secret",
  DB: {
    prepare: () => ({}),
    batch: async () => [
      { results: [{ count: 15 }] },
      { results: [{ count: 27 }] },
    ],
  },
};

describe("Google authentication routes", () => {
  it("blocks data API routes before login", async () => {
    const response = await worker.fetch(new Request("https://example.test/api/status"), authEnv, {});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      code: "AUTH_REQUIRED",
      error: "Autenticação necessária.",
    });
  });

  it("permits a signed session and exposes only public Google configuration", async () => {
    const session = await createSession(authEnv.ALLOWED_GOOGLE_EMAIL, authEnv.SESSION_SECRET);
    const status = await worker.fetch(new Request("https://example.test/api/status", {
      headers: { cookie: `xs_session=${session}` },
    }), authEnv, {});
    const config = await worker.fetch(new Request("https://example.test/api/auth/config"), authEnv, {});

    expect(status.status).toBe(200);
    expect((await status.json()).data.executionRows).toBe(27);
    await expect(config.json()).resolves.toEqual({
      success: true,
      data: { clientId: authEnv.GOOGLE_CLIENT_ID },
    });
  });

  it("revokes a signed session when its e-mail is no longer allowlisted", async () => {
    const oldSession = await createSession("old@example.test", authEnv.SESSION_SECRET);
    const response = await worker.fetch(new Request("https://example.test/api/status", {
      headers: { cookie: `xs_session=${oldSession}` },
    }), authEnv, {});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("reports unauthenticated session and clears a session on logout", async () => {
    const before = await worker.fetch(new Request("https://example.test/api/auth/session"), authEnv, {});
    const logout = await worker.fetch(new Request("https://example.test/api/auth/logout", { method: "POST" }), authEnv, {});

    await expect(before.json()).resolves.toEqual({ success: true, data: { authenticated: false } });
    expect(logout.headers.get("set-cookie")).toContain("xs_session=");
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects an incomplete Google credential without creating a session", async () => {
    const response = await worker.fetch(new Request("https://example.test/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "" }),
    }), authEnv, {});

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "AUTH_REQUIRED",
    });
  });

  it("creates a secure session only after the Google identity is verified", async () => {
    const verifiedWorker = createWorker({
      verifyGoogleCredential: async (credential, env) => {
        expect(credential).toBe("verified-google-token");
        return { email: env.ALLOWED_GOOGLE_EMAIL };
      },
    });
    const response = await verifiedWorker.fetch(new Request("https://example.test/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: "verified-google-token" }),
    }), authEnv, {});
    const sessionCookie = response.headers.get("set-cookie");
    const session = await verifiedWorker.fetch(new Request("https://example.test/api/auth/session", {
      headers: { cookie: sessionCookie.split(";")[0] },
    }), authEnv, {});

    expect(response.status).toBe(200);
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("Path=/");
    expect(sessionCookie).toContain("Max-Age=604800");
    await expect(session.json()).resolves.toEqual({
      success: true,
      data: { authenticated: true, email: authEnv.ALLOWED_GOOGLE_EMAIL },
    });
  });

  it("rejects malformed login JSON without a server error", async () => {
    const response = await worker.fetch(new Request("https://example.test/api/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }), authEnv, {});

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
  });
});
