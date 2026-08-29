import { describe, expect, it } from "vitest";
import {
  AuthError,
  createSession,
  verifyGoogleCredential,
  verifySession,
} from "../../worker/src/auth.js";

const env = {
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  ALLOWED_GOOGLE_EMAIL: "allowed@example.test",
  SESSION_SECRET: "test-session-secret",
};

describe("authentication primitives", () => {
  it("accepts a signed unexpired session and rejects a tampered or expired one", async () => {
    const session = await createSession("allowed@example.test", env.SESSION_SECRET, 1000);

    await expect(verifySession(session, env.SESSION_SECRET, 1001)).resolves.toEqual({
      email: "allowed@example.test",
    });
    await expect(verifySession(`${session}x`, env.SESSION_SECRET, 1001)).resolves.toBeNull();
    await expect(verifySession(session, env.SESSION_SECRET, 1000 + 8 * 24 * 60 * 60 * 1000)).resolves.toBeNull();
  });

  it("accepts only the verified configured Google identity", async () => {
    const verifier = async () => ({
      email: env.ALLOWED_GOOGLE_EMAIL,
      email_verified: true,
      aud: env.GOOGLE_CLIENT_ID,
    });

    await expect(verifyGoogleCredential("credential", env, verifier)).resolves.toEqual({
      email: env.ALLOWED_GOOGLE_EMAIL,
    });
  });

  it("rejects a Google identity outside the allowlist", async () => {
    const verifier = async () => ({
      email: "other@example.test",
      email_verified: true,
      aud: env.GOOGLE_CLIENT_ID,
    });

    await expect(verifyGoogleCredential("credential", env, verifier)).rejects.toEqual(
      new AuthError("AUTH_FORBIDDEN", "Conta Google não autorizada."),
    );
  });
});
