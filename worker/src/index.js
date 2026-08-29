import {
  getPrescriptionEditorData,
  getPrescricaoData,
  PrescriptionValidationError,
  savePrescricaoTreino,
} from "./prescriptions.js";
import {
  ExecutionValidationError,
  getExecucaoData,
  syncExecucaoData,
} from "./executions.js";
import { getGestaoCargaData, getInitialAppData } from "./load.js";
import { AuthError, createSession, verifyGoogleCredential, verifySession } from "./auth.js";

const PUBLIC_AUTH_PATHS = new Set(["/api/auth/config", "/api/auth/google", "/api/auth/session", "/api/auth/logout"]);

function cookie(request, name) {
  const match = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : "";
}

function sessionCookie(value, maxAge) {
  return `xs_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function allowedSession(request, env) {
  const session = await verifySession(cookie(request, "xs_session"), env.SESSION_SECRET, Date.now());
  return session && session.email === env.ALLOWED_GOOGLE_EMAIL ? session : null;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function createWorker(options = {}) {
  const credentialVerifier = options.verifyGoogleCredential || verifyGoogleCredential;
  return {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
    if (request.method === "GET" && url.pathname === "/api/auth/config") {
      return json({ success: true, data: { clientId: env.GOOGLE_CLIENT_ID || "" } });
    }
    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      const session = await allowedSession(request, env);
      return json({ success: true, data: session ? { authenticated: true, email: session.email } : { authenticated: false } });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      return json({ success: true, data: { authenticated: false } }, 200, { "set-cookie": sessionCookie("", 0) });
    }
    if (request.method === "POST" && url.pathname === "/api/auth/google") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        throw new AuthError("AUTH_REQUIRED", "Credencial Google ausente.");
      }
      const identity = await credentialVerifier(payload && payload.credential, env);
      const session = await createSession(identity.email, env.SESSION_SECRET);
      return json({ success: true, data: identity }, 200, { "set-cookie": sessionCookie(session, 7 * 24 * 60 * 60) });
    }
    if (url.pathname.startsWith("/api/") && !PUBLIC_AUTH_PATHS.has(url.pathname)) {
      const session = await allowedSession(request, env);
      if (!session) return json({ success: false, code: "AUTH_REQUIRED", error: "Autenticação necessária." }, 401);
    }
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

    if (request.method === "GET" && url.pathname === "/api/executions") {
      return json({ success: true, data: await getExecucaoData(env.DB) });
    }

    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      return json({ success: true, data: await getInitialAppData(env.DB) });
    }

    if (request.method === "GET" && url.pathname === "/api/load") {
      return json({ success: true, data: await getGestaoCargaData(env.DB) });
    }

    if (request.method === "POST" && url.pathname === "/api/executions/sync") {
      try {
        const { records } = await request.json();
        return json({ success: true, data: await syncExecucaoData(env.DB, records) });
      } catch (error) {
        if (error instanceof ExecutionValidationError) {
          return json(
            { success: false, code: error.code, error: error.message },
            422,
          );
        }
        throw error;
      }
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
    } catch (error) {
      if (error instanceof AuthError) {
        return json({ success: false, code: error.code, error: error.message }, error.code === "AUTH_FORBIDDEN" ? 403 : 401);
      }
      if (url.pathname.startsWith("/api/")) {
        console.error("[xsteam api]", error);
        return json(
          { success: false, code: "INTERNAL_ERROR", error: "Erro interno do serviço." },
          500,
        );
      }
      throw error;
    }
  },
};
}

export default createWorker();
