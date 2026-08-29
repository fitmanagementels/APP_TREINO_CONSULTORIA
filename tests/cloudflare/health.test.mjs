import { describe, expect, it } from "vitest";
import worker from "../../worker/src/index.js";

describe("GET /api/status", () => {
  it("returns a stable JSON success envelope", async () => {
    const response = await worker.fetch(
      new Request("https://example.test/api/status"),
      { DB: { prepare() { throw new Error("DB should be added next"); } } },
      {},
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { service: "xsteam-pwa", database: "unavailable" },
    });
  });
});
