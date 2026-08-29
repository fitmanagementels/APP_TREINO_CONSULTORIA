# Google Login for Workers PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the single-tenant PWA and every D1 API route with a free Google login on the existing `workers.dev` hostname.

**Architecture:** Google Identity Services obtains a Google ID token in the browser. A Worker authentication module verifies the RS256 token against Google JWKS, checks the configured audience and allowlisted email, then writes a short signed `HttpOnly` session cookie. Route middleware rejects all data API routes without that cookie; the static shell shows a login overlay until a session exists.

**Tech Stack:** Cloudflare Workers, D1, Web Crypto, `jose`, Google Identity Services, Vitest/Miniflare, existing HTML/CSS/JavaScript PWA.

## Global Constraints

- Remain single-tenant: exactly one allowlisted Google e-mail; no users table or profile UI.
- Never put `ALLOWED_GOOGLE_EMAIL`, `SESSION_SECRET`, OAuth secret, token, or database ID in Git, browser storage, chat, or documentation examples.
- `GOOGLE_CLIENT_ID` is public configuration; `ALLOWED_GOOGLE_EMAIL` and `SESSION_SECRET` are Worker secrets.
- Session cookies use `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and a seven-day maximum age.
- Every `/api/*` route except `/api/auth/config`, `/api/auth/google`, `/api/auth/session`, and `/api/auth/logout` requires a valid session.
- Do not re-enable `workers.dev` until Google configuration and Worker secrets are set remotely.

---

### Task 1: Add testable Google-token and session primitives

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `worker/src/auth.js`
- Create: `tests/cloudflare/auth.test.mjs`

**Interfaces:**
- Produces `createSession(email, secret, now): Promise<string>`.
- Produces `verifySession(cookieValue, secret, now): Promise<{ email: string } | null>`.
- Produces `verifyGoogleCredential(credential, env, verifier?): Promise<{ email: string }>`.
- `env` contains `GOOGLE_CLIENT_ID`, `ALLOWED_GOOGLE_EMAIL`, and `SESSION_SECRET`.

- [ ] **Step 1: Add failing tests for session signing and allowlist rejection.**

```js
it("accepts a signed unexpired session and rejects a tampered one", async () => {
  const session = await createSession("allowed@example.test", "test-secret", 1000);
  await expect(verifySession(session, "test-secret", 1001)).resolves.toEqual({ email: "allowed@example.test" });
  await expect(verifySession(session + "x", "test-secret", 1001)).resolves.toBeNull();
});

it("rejects a Google identity outside the allowlist", async () => {
  await expect(verifyGoogleCredential("credential", env, async () => ({
    email: "other@example.test", email_verified: true, aud: env.GOOGLE_CLIENT_ID,
  }))).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because `auth.js` is absent.**

Run: `npm test -- tests/cloudflare/auth.test.mjs`  
Expected: FAIL with module-not-found error.

- [ ] **Step 3: Install `jose` and implement the primitives.**

```js
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function verifyGoogleCredential(credential, env, verifier = defaultGoogleVerifier) {
  const claims = await verifier(credential, env.GOOGLE_CLIENT_ID);
  if (!claims.email_verified || claims.email !== env.ALLOWED_GOOGLE_EMAIL) {
    throw Object.assign(new Error("Conta Google não autorizada."), { code: "AUTH_FORBIDDEN" });
  }
  return { email: claims.email };
}
```

Use HMAC-SHA-256 Web Crypto for `base64url(payload).base64url(signature)`. The JSON payload is `{ email, exp }`; `verifySession` returns `null` for malformed, expired, or invalid signatures. The default verifier uses `jwtVerify` with issuer `https://accounts.google.com` and audience `env.GOOGLE_CLIENT_ID`.

- [ ] **Step 4: Re-run the focused test.**

Run: `npm test -- tests/cloudflare/auth.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit the primitives.**

```bash
git add package.json package-lock.json worker/src/auth.js tests/cloudflare/auth.test.mjs
git commit -m "feat: add Google session authentication primitives"
```

### Task 2: Enforce authentication in Worker routes

**Files:**
- Modify: `worker/src/index.js`
- Modify: `tests/cloudflare/health.test.mjs`
- Create: `tests/cloudflare/auth-routes.test.mjs`

**Interfaces:**
- `POST /api/auth/google` accepts `{ credential }`, returns `{ success:true, data:{ email } }`, and sets `xs_session`.
- `GET /api/auth/session` returns `{ success:true, data:{ authenticated:false } }` without a valid cookie and `{ authenticated:true, email }` with one.
- `POST /api/auth/logout` clears `xs_session`.
- Protected endpoints respond `{ success:false, code:"AUTH_REQUIRED", error:"Autenticação necessária." }` with HTTP 401.

- [ ] **Step 1: Write failing route tests.**

```js
it("blocks status before login", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/status"), authEnv, {});
  expect(response.status).toBe(401);
});

it("sets a secure session cookie after valid Google login", async () => {
  const response = await worker.fetch(loginRequest("credential"), authEnv, {});
  expect(response.headers.get("set-cookie")).toContain("xs_session=");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});
```

- [ ] **Step 2: Run the route test and confirm the current unauthenticated status route fails the expectation.**

Run: `npm test -- tests/cloudflare/auth-routes.test.mjs`  
Expected: FAIL because `/api/status` currently returns 200 without a session.

- [ ] **Step 3: Add a small auth boundary at the start of `fetch`.**

```js
const PUBLIC_AUTH_PATHS = new Set(["/api/auth/config", "/api/auth/google", "/api/auth/session", "/api/auth/logout"]);

if (url.pathname.startsWith("/api/") && !PUBLIC_AUTH_PATHS.has(url.pathname)) {
  const session = await verifySession(readCookie(request, "xs_session"), env.SESSION_SECRET, Date.now());
  if (!session) return json({ success: false, code: "AUTH_REQUIRED", error: "Autenticação necessária." }, 401);
}
```

Implement the four public auth routes, set/clear the cookie, and retain the existing validation/500 envelopes. `/api/auth/config` returns only `{ clientId: env.GOOGLE_CLIENT_ID }`; it must never return secrets or the allowed e-mail.

- [ ] **Step 4: Run Worker tests.**

Run: `npm test`  
Expected: all Worker test files PASS, with existing API tests updated to attach a valid test session cookie.

- [ ] **Step 5: Commit route enforcement.**

```bash
git add worker/src/index.js tests/cloudflare/health.test.mjs tests/cloudflare/auth-routes.test.mjs tests/cloudflare/*.test.mjs
git commit -m "feat: protect Worker API with Google sessions"
```

### Task 3: Add the Google login gate to the existing static PWA

**Files:**
- Modify: `app/index.html`
- Modify: `app/script.html`
- Modify: `app/style.html`
- Modify: `tests/app-regression.test.js`
- Modify: `tests/cloudflare/frontend-contract.test.cjs`

**Interfaces:**
- `Auth.init(): Promise<boolean>` calls `/api/auth/session` before `App.init()`.
- `Auth.login(credential): Promise<void>` posts to `/api/auth/google` with `credentials:"same-origin"`.
- `Auth.logout(): Promise<void>` posts to `/api/auth/logout` and returns to the overlay.
- Google script URL is `https://accounts.google.com/gsi/client`; it is loaded only while unauthenticated.

- [ ] **Step 1: Write failing source tests.**

```js
assert.match(index, /id="google-login-overlay"/);
assert.match(script, /Auth\.init\(\)\.then/);
assert.match(script, /\/api\/auth\/session/);
assert.match(script, /https:\/\/accounts\.google\.com\/gsi\/client/);
assert.doesNotMatch(script, /localStorage\.setItem\([^\n]*credential/);
```

- [ ] **Step 2: Run source tests and confirm the missing overlay/auth module failures.**

Run: `node tests/cloudflare/frontend-contract.test.cjs && node tests/app-regression.test.js`  
Expected: FAIL because no login gate exists.

- [ ] **Step 3: Implement the minimal overlay and `Auth` object.**

Place a hidden `#app-shell` around the current app UI and add a visible `#google-login-overlay` with status text and `#google-signin-button`. `Auth.init()` calls `/api/auth/session`; on success it unhides the app and calls `App.init()` exactly once. On unauthenticated result it requests `/api/auth/config`, loads Google Identity Services, and renders the button. The credential callback calls `Auth.login`; a failure shows “Não foi possível entrar. Use a conta Google autorizada.”

- [ ] **Step 4: Build static assets and run all frontend tests.**

Run: `npm run assets:build && node tests/cloudflare/frontend-contract.test.cjs && node tests/app-regression.test.js && node tests/frontend-polish.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit the login UI.**

```bash
git add app/index.html app/script.html app/style.html tests/app-regression.test.js tests/cloudflare/frontend-contract.test.cjs
git commit -m "feat: add Google login gate to PWA"
```

### Task 4: Add no-secret setup instructions and complete external validation

**Files:**
- Create: `docs/guias-operacionais/06-login-google-sem-dominio.md`
- Modify: `wrangler.jsonc.example`
- Modify: `docs/RESUMO_PROJETO.md`

**Interfaces:**
- The guide uses the exact deployed origin `https://xsteam-pwa.fitmanagement-els.workers.dev`.
- Local config contains only `GOOGLE_CLIENT_ID`; the guide sets `ALLOWED_GOOGLE_EMAIL` and `SESSION_SECRET` with `npx wrangler secret put`.

- [ ] **Step 1: Write a failing source assertion for no committed secret placeholders.**

```js
assert.doesNotMatch(fs.readFileSync("wrangler.jsonc.example", "utf8"), /ALLOWED_GOOGLE_EMAIL|SESSION_SECRET/);
```

- [ ] **Step 2: Run the assertion and confirm it passes before documentation changes; then preserve it as regression coverage.**

Run: `node tests/cloudflare/frontend-contract.test.cjs`  
Expected: PASS.

- [ ] **Step 3: Document the manual Google Cloud steps and update only the public config example.**

The guide must link to `https://console.cloud.google.com/apis/credentials`, instruct: create/select project; configure OAuth consent screen as External; create OAuth client ID > Web application; add the exact authorized JavaScript origin; copy only the Client ID into `wrangler.jsonc`; set Worker secrets locally with commands that prompt in the terminal; redeploy; test approved and unapproved Google accounts in separate private windows. Do not commit client secret, allowed e-mail, or session secret.

- [ ] **Step 4: After manual configuration, re-enable `workers_dev`, deploy, and smoke-test.**

Run: `npm run deploy`  
Expected: Workers deploy prints the free URL. Before login `/api/status` returns 401; after approved Google login it returns 200; a different account returns 403.

- [ ] **Step 5: Commit documentation and configuration template.**

```bash
git add docs/guias-operacionais/06-login-google-sem-dominio.md wrangler.jsonc.example docs/RESUMO_PROJETO.md tests/cloudflare/frontend-contract.test.cjs
git commit -m "docs: add Google login setup guide"
```

## Plan Self-Review

| Specification requirement | Plan task |
| --- | --- |
| Google Identity Services and free workers.dev host | 3, 4 |
| Cryptographic Google JWT validation | 1 |
| Signed secure Worker session | 1, 2 |
| All data APIs protected | 2 |
| Single allowlisted e-mail/no users table | 1, 2, 4 |
| No secrets in Git or browser storage | 1, 3, 4 |
| Automated and external acceptance | 1–4 |

The plan has no placeholder steps; its route, helper, cookie and configuration names are consistent across tasks.
