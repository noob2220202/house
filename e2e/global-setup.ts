import fs from 'node:fs';
import path from 'node:path';
import { ADMIN_URL, API_ORIGIN, STATE_DIR, WEB_URL } from './lib/env';

/** Fails fast (with the fix) when the stack is not up; the tests never start servers. */
export default async function globalSetup(): Promise<void> {
  const checks: [string, string][] = [
    ['api', `${API_ORIGIN}/api/v1/health/ready`],
    ['web (real API mode, via rewrite)', `${WEB_URL}/api/v1/health`],
    ['web home', `${WEB_URL}/`],
    ['admin login', `${ADMIN_URL}/login`],
  ];
  for (const [label, url] of checks) {
    let status = 0;
    try {
      status = (await fetch(url, { redirect: 'manual' })).status;
    } catch {
      // connection refused
    }
    if (status !== 200) {
      throw new Error(
        `e2e stack not ready: ${label} ${url} → ${status || 'unreachable'}.\n` +
          'Start it with: scripts/e2e-stack.sh up   (status: scripts/e2e-stack.sh status)',
      );
    }
  }
  if (!fs.existsSync(path.join(STATE_DIR, 'admin.json'))) {
    throw new Error(`${STATE_DIR}/admin.json missing — run scripts/e2e-stack.sh up (not --keep-data)`);
  }
  fs.mkdirSync(path.join(STATE_DIR, 'auth'), { recursive: true });
}
