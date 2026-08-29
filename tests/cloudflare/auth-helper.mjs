import { env } from "cloudflare:workers";
import { createSession } from "../../worker/src/auth.js";

export async function authenticatedHeaders(headers = {}) {
  const session = await createSession(env.ALLOWED_GOOGLE_EMAIL, env.SESSION_SECRET);
  return { ...headers, cookie: `xs_session=${session}` };
}
