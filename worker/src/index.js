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
      const [prescriptions, executions] = await env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) AS count FROM prescription_exercises"),
        env.DB.prepare("SELECT COUNT(*) AS count FROM execution_records"),
      ]);

      return json({
        success: true,
        data: {
          service: "xsteam-pwa",
          database: "ok",
          prescriptionRows: prescriptions.results[0].count,
          executionRows: executions.results[0].count,
        },
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
