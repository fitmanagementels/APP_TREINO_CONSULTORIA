import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import worker, { createWorker } from "../../worker/src/index.js";
import { authenticatedHeaders } from "./auth-helper.mjs";

async function authenticatedPost(path) {
  return new Request(`https://example.test${path}`, {
    method: "POST",
    headers: await authenticatedHeaders(),
  });
}

describe("catalog synchronization routes", () => {
  it("blocks catalog sync before authentication", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api/catalog/sync", { method: "POST" }),
      env,
      {},
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("runs the same synchronizer from the manual route and daily handler", async () => {
    const syncReferenceCatalog = vi.fn().mockResolvedValue({ changed: true, activeExerciseCount: 2 });
    const getCatalogSyncStatus = vi.fn().mockResolvedValue({ lastSuccessAt: "", lastError: "" });
    const testWorker = createWorker({ syncReferenceCatalog, getCatalogSyncStatus });

    const response = await testWorker.fetch(await authenticatedPost("/api/catalog/sync"), env, {});
    const waitUntil = vi.fn();
    testWorker.scheduled({}, env, { waitUntil });
    await waitUntil.mock.calls[0][0];

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { changed: true, activeExerciseCount: 2 },
    });
    expect(syncReferenceCatalog).toHaveBeenCalledTimes(2);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("returns the stored status only to an authenticated session", async () => {
    const getCatalogSyncStatus = vi.fn().mockResolvedValue({
      lastAttemptAt: "2026-08-30T04:00:00.000Z",
      lastSuccessAt: "2026-08-30T04:00:00.000Z",
      activeExerciseCount: 89,
      lastError: "",
    });
    const testWorker = createWorker({ getCatalogSyncStatus });
    const response = await testWorker.fetch(
      new Request("https://example.test/api/catalog/status", { headers: await authenticatedHeaders() }),
      env,
      {},
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expect.objectContaining({ activeExerciseCount: 89 }),
    });
    expect(getCatalogSyncStatus).toHaveBeenCalledTimes(1);
  });
});
