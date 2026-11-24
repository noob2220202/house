#!/usr/bin/env node
// Enrolls TOTP for the e2e SUPER_ADMIN through the real API (login → totp/setup → totp/activate),
// so the tests know the secret. Writes $E2E_STATE_DIR/admin.json:
//   { email, password, totpSecret, recoveryCodes, lastUsedStep }
// Usage (scripts/e2e-stack.sh runs it): E2E_API_ORIGIN=… E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=…
//   E2E_STATE_DIR=… node scripts/e2e/enroll-admin.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { freshTotp } from '../../e2e/lib/totp.mjs';

const api = (process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:4100').replace(/\/$/, '');
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const stateDir = process.env.E2E_STATE_DIR;
if (!email || !password || !stateDir) {
  console.error('E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD and E2E_STATE_DIR are required');
  process.exit(2);
}

/** Minimal cookie jar: name → value from Set-Cookie (path/expiry ignored; one host). */
const jar = new Map();
function remember(res) {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (/expires=Thu, 01 Jan 1970/i.test(line) || value === '') jar.delete(name);
    else jar.set(name, value);
  }
}

let csrf = '';
async function call(method, route, body) {
  const res = await fetch(`${api}/api/v1${route}`, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  remember(res);
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status} ${text}`);
  return json;
}

const login = await call('POST', '/admin/auth/login', { email, password });
csrf = login.csrfToken;
if (login.totpEnrolled) {
  console.error(
    `${email} already has TOTP enrolled (stack not reset?) — run: scripts/e2e-stack.sh up`,
  );
  process.exit(1);
}
const setup = await call('POST', '/admin/auth/totp/setup', {});
const { code, step } = await freshTotp(setup.secret);
const activated = await call('POST', '/admin/auth/totp/activate', { code });
csrf = activated.csrfToken;
await call('POST', '/admin/auth/logout');

await mkdir(stateDir, { recursive: true });
const out = path.join(stateDir, 'admin.json');
await writeFile(
  out,
  `${JSON.stringify(
    {
      email,
      password,
      totpSecret: setup.secret,
      recoveryCodes: activated.recoveryCodes,
      lastUsedStep: step,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
console.log(`admin ${email} enrolled (TOTP secret in ${out})`);
