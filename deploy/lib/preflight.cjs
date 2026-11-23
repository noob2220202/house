#!/usr/bin/env node
/**
 * Pre-switch smoke test used by deploy.sh: boots the NEW release's api, web and admin on spare
 * loopback ports (production env from ecosystem.config.cjs, jobs disabled), waits for their
 * health endpoints, then stops them. A release that cannot boot is never switched to, so a
 * broken build costs no downtime.
 *
 *   node preflight.cjs <releaseDir> <apiPort> <webPort> <adminPort> [timeoutSec]
 */
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const [releaseDir, apiPort, webPort, adminPort, timeoutArg] = process.argv.slice(2);
if (!releaseDir || !apiPort || !webPort || !adminPort) {
  console.error('usage: preflight.cjs <releaseDir> <apiPort> <webPort> <adminPort> [timeoutSec]');
  process.exit(2);
}
const timeoutMs = Number(timeoutArg || 60) * 1000;

// The ecosystem file resolves cwd to /srv/house/current; only its env and script are reused here.
const eco = require(path.join(releaseDir, 'ecosystem.config.cjs'));
const app = (name) => {
  const found = eco.apps.find((a) => a.name === name);
  if (!found) throw new Error(`ecosystem has no app "${name}"`);
  return found;
};

const baseEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  LANG: process.env.LANG || 'C.UTF-8',
};
const targets = [
  {
    name: 'api',
    cwd: path.join(releaseDir, 'apps', 'api'),
    args: [app('house-api').script],
    env: { ...app('house-api').env, PORT: apiPort, JOBS_ENABLED: 'false' },
    url: `http://127.0.0.1:${apiPort}/api/v1/health/ready`,
  },
  {
    name: 'web',
    cwd: path.join(releaseDir, 'apps', 'web'),
    args: [app('house-web').script, 'start', '--port', webPort, '--hostname', '127.0.0.1'],
    env: { ...app('house-web').env, PORT: webPort },
    url: `http://127.0.0.1:${webPort}/healthz`,
  },
  {
    name: 'admin',
    cwd: path.join(releaseDir, 'apps', 'admin'),
    args: [app('house-admin').script, 'start', '--port', adminPort, '--hostname', '127.0.0.1'],
    env: { ...app('house-admin').env, PORT: adminPort },
    url: `http://127.0.0.1:${adminPort}/healthz`,
  },
];

const children = [];
const stopAll = () => {
  for (const c of children) if (c.exitCode === null) c.kill('SIGTERM');
};
process.on('SIGINT', () => (stopAll(), process.exit(130)));
process.on('SIGTERM', () => (stopAll(), process.exit(143)));

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function check(t) {
  const output = [];
  const child = spawn(process.execPath, t.args, {
    cwd: t.cwd,
    env: { ...baseEnv, ...t.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  const keep = (buf) => {
    output.push(...buf.toString().split('\n'));
    if (output.length > 40) output.splice(0, output.length - 40);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    if (await probe(t.url)) return { name: t.name, ok: true };
    await new Promise((r) => setTimeout(r, 500));
  }
  const reason = child.exitCode !== null ? `exited with code ${child.exitCode}` : 'timed out';
  return { name: t.name, ok: false, reason, tail: output.filter(Boolean).slice(-15) };
}

(async () => {
  const results = await Promise.all(targets.map(check));
  stopAll();
  let failed = false;
  for (const r of results) {
    if (r.ok) {
      console.log(`  preflight ${r.name}: ok`);
    } else {
      failed = true;
      console.error(`  preflight ${r.name}: FAILED (${r.reason})`);
      for (const line of r.tail) console.error(`    | ${line}`);
    }
  }
  // Let children shut down gracefully, then make sure none keeps a port.
  const deadline = Date.now() + 8000;
  while (
    children.some((c) => c.exitCode === null && c.signalCode === null) &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill('SIGKILL');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  stopAll();
  console.error(err);
  process.exit(1);
});
