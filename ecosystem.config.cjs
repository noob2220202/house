/**
 * PM2 process file for the VPS (no Docker). Used by deploy/deploy.sh and deploy/rollback.sh:
 *   pm2 startOrReload /srv/house/current/ecosystem.config.cjs --update-env
 *
 * - house-api     NestJS API, cluster mode (zero-downtime reload), jobs disabled
 * - house-worker  BullMQ jobs (실거래가 sync, banner stats flush, media, cleanup), fork x1
 * - house-web     Next.js user site, cluster mode
 * - house-admin   Next.js back-office, cluster mode (also with 1 instance)
 *
 * Every HTTP app runs in cluster mode whatever its instance count: PM2 reloads a cluster app by
 * starting the new worker before stopping the old one, while a fork-mode app is simply restarted
 * (502s for several seconds). exec_mode never depends on the instance count, so changing
 * *_INSTANCES is a `pm2 scale`, not a re-registration.
 *
 * Environment comes from /srv/house/shared/.env (API) and /srv/house/shared/deploy.conf
 * (ports/instances), read here so PM2 never depends on the operator's shell environment.
 * cwd points at the /srv/house/current symlink, so a reload always starts the active release.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const HOUSE_ROOT = process.env.HOUSE_ROOT || '/srv/house';
const CURRENT = path.join(HOUSE_ROOT, 'current');
const SHARED = path.join(HOUSE_ROOT, 'shared');

/** Minimal dotenv parser (same rules as deploy/lib/common.sh env_get). */
function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/^\s*(export\s+)?/, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    const quoted = /^(["'])(.*?)\1/.exec(value);
    if (quoted) value = quoted[2];
    else
      value = value
        .replace(/\s+#.*$/, '')
        .replace(/^#.*$/, '')
        .trim();
    out[key] = value;
  }
  return out;
}

/** Variable names apps/api/.env.example documents (also the commented-out `# KEY=` ones). */
function documentedKeys(file) {
  if (!fs.existsSync(file)) return [];
  const keys = new Set();
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*#?\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=/.exec(raw);
    if (m) keys.add(m[1]);
  }
  return [...keys];
}

const env = readEnvFile(path.join(SHARED, '.env'));
// `pm2 startOrReload --update-env` MERGES the new env into the old one, and @nestjs/config lets
// process.env win over the .env file: a key deleted from shared/.env would keep its old value
// (and `pm2 save` would persist it). Every documented key missing from .env is therefore passed
// as '' — which parseEnv treats as unset — so deleting a line really unsets it.
for (const key of documentedKeys(path.join(__dirname, 'apps', 'api', '.env.example'))) {
  if (!(key in env)) env[key] = '';
}
const conf = readEnvFile(path.join(SHARED, 'deploy.conf'));
const LOG_DIR = path.join(conf.LOG_DIR || '/var/log/house', 'pm2');

const num = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const API_PORT = num(conf.API_PORT ?? env.PORT, 4000);
const WORKER_PORT = num(conf.WORKER_PORT, 4100);
const WEB_PORT = num(conf.WEB_PORT, 3000);
const ADMIN_PORT = num(conf.ADMIN_PORT, 3001);

const apiDir = path.join(CURRENT, 'apps', 'api');
// Releases built before apps/api shipped dist/worker.js ran the worker as a second main.js on
// WORKER_PORT; keep that fallback so a rollback to such a release still has a worker.
const dedicatedWorker = fs.existsSync(path.join(apiDir, 'dist', 'worker.js'));

const common = {
  autorestart: true,
  min_uptime: '10s',
  max_restarts: 10,
  exp_backoff_restart_delay: 200,
  merge_logs: true,
  time: false, // pino / Next already timestamp their lines
};

const logs = (name) => ({
  out_file: path.join(LOG_DIR, `${name}.out.log`),
  error_file: path.join(LOG_DIR, `${name}.err.log`),
});

const nextApp = (name, dir, port, instances, memory) => ({
  ...common,
  ...logs(name),
  name,
  cwd: path.join(CURRENT, 'apps', dir),
  script: 'node_modules/next/dist/bin/next',
  args: `start --port ${port} --hostname 127.0.0.1`,
  exec_mode: 'cluster',
  instances,
  listen_timeout: 20_000,
  kill_timeout: 10_000,
  max_memory_restart: memory,
  env: {
    NODE_ENV: 'production',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    // Server-side rendering talks to the API directly instead of looping through nginx.
    INTERNAL_API_URL: `http://127.0.0.1:${API_PORT}`,
  },
});

module.exports = {
  apps: [
    {
      ...common,
      ...logs('api'),
      name: 'house-api',
      cwd: apiDir,
      script: 'dist/main.js',
      exec_mode: 'cluster',
      instances: num(conf.API_INSTANCES, 2),
      // Cluster reload waits for each new worker to listen before stopping an old one.
      listen_timeout: 30_000,
      kill_timeout: 15_000,
      max_memory_restart: '700M',
      node_args: ['--enable-source-maps'],
      env: {
        ...env,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        JOBS_ENABLED: 'false',
      },
    },
    {
      ...common,
      ...logs('worker'),
      name: 'house-worker',
      cwd: apiDir,
      script: dedicatedWorker ? 'dist/worker.js' : 'dist/main.js',
      exec_mode: 'fork',
      instances: 1,
      // Long jobs (실거래가 sync, image processing) get time to finish on SIGINT.
      kill_timeout: 30_000,
      max_memory_restart: '800M',
      node_args: ['--enable-source-maps'],
      env: {
        ...env,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(WORKER_PORT),
        JOBS_ENABLED: 'true',
      },
    },
    nextApp('house-web', 'web', WEB_PORT, num(conf.WEB_INSTANCES, 2), '600M'),
    nextApp('house-admin', 'admin', ADMIN_PORT, num(conf.ADMIN_INSTANCES, 1), '400M'),
  ],
};
