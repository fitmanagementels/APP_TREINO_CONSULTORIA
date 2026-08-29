import { createRemoteJWKSet, jwtVerify } from "jose";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export class AuthError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

function base64urlEncode(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmac(value, secret) {
  const key = await hmacKey(secret);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function validHmac(value, signature, secret) {
  const key = await hmacKey(secret);
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(value));
}

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function createSession(email, secret, now = Date.now()) {
  if (!configured(secret)) throw new AuthError("AUTH_CONFIGURATION", "Autenticação não configurada.");
  const payload = base64urlEncode(JSON.stringify({ email, exp: now + sessionLifetimeMs }));
  const signature = base64urlEncode(await hmac(payload, secret));
  return `${payload}.${signature}`;
}

export async function verifySession(value, secret, now = Date.now()) {
  if (!configured(value) || !configured(secret)) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const supplied = base64urlDecode(signature);
    if (!await validHmac(payload, supplied, secret)) return null;
    const data = JSON.parse(decoder.decode(base64urlDecode(payload)));
    if (!configured(data.email) || !Number.isFinite(data.exp) || data.exp <= now) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

async function defaultGoogleVerifier(credential, clientId) {
  const { payload } = await jwtVerify(credential, googleJwks, {
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  return payload;
}

export async function verifyGoogleCredential(credential, env, verifier = defaultGoogleVerifier) {
  if (!configured(env.GOOGLE_CLIENT_ID) || !configured(env.ALLOWED_GOOGLE_EMAIL)) {
    throw new AuthError("AUTH_CONFIGURATION", "Autenticação não configurada.");
  }
  if (!configured(credential)) throw new AuthError("AUTH_REQUIRED", "Credencial Google ausente.");
  let claims;
  try {
    claims = await verifier(credential, env.GOOGLE_CLIENT_ID);
  } catch {
    throw new AuthError("AUTH_REQUIRED", "Credencial Google inválida.");
  }
  if (claims.aud !== env.GOOGLE_CLIENT_ID || claims.email_verified !== true || !configured(claims.email)) {
    throw new AuthError("AUTH_REQUIRED", "Credencial Google inválida.");
  }
  if (claims.email !== env.ALLOWED_GOOGLE_EMAIL) {
    throw new AuthError("AUTH_FORBIDDEN", "Conta Google não autorizada.");
  }
  return { email: claims.email };
}
