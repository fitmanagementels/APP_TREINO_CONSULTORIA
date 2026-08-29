function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/status") {
      return json({
        success: true,
        data: { service: "xsteam-pwa", database: "unavailable" },
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return json(
        { success: false, code: "NOT_FOUND", error: "Rota não encontrada." },
        404,
      );
    }

    return env.ASSETS.fetch(request);
  },
};
