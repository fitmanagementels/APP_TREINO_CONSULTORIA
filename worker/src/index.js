import {
  getPrescriptionEditorData,
  getPrescricaoData,
  PrescriptionValidationError,
  savePrescricaoTreino,
} from "./prescriptions.js";

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

    if (request.method === "GET" && url.pathname === "/api/prescriptions") {
      return json({ success: true, data: await getPrescricaoData(env.DB) });
    }

    if (request.method === "GET" && url.pathname === "/api/prescription-editor") {
      return json({ success: true, data: await getPrescriptionEditorData(env.DB) });
    }

    const prescriptionMatch = url.pathname.match(/^\/api\/prescriptions\/([^/]+)\/([^/]+)$/);
    if (request.method === "PUT" && prescriptionMatch) {
      try {
        const payload = await request.json();
        const data = await savePrescricaoTreino(
          env.DB,
          decodeURIComponent(prescriptionMatch[1]),
          decodeURIComponent(prescriptionMatch[2]),
          payload,
        );
        return json({ success: true, data });
      } catch (error) {
        if (error instanceof PrescriptionValidationError) {
          return json(
            { success: false, code: error.code, error: error.message },
            422,
          );
        }
        throw error;
      }
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
