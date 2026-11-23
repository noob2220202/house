#!/usr/bin/env node
// Creates (if missing) and migrates every house_test_<module> database. PostGIS/pg_trgm are enabled
// by the init migration. Usage: pnpm db:test:prepare [module ...]
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { listModules, resolveTestEnv } = require('./load-test-env.cjs');
const apiDir = path.resolve(import.meta.dirname, '..');
const modules = process.argv.slice(2).length ? process.argv.slice(2) : listModules();

let failed = 0;
for (const m of modules) {
  const env = resolveTestEnv(m);
  process.stdout.write(
    `${m.padEnd(14)} ${new URL(env.DATABASE_URL).pathname.slice(1)}  redis db ${env.REDIS_DB} … `,
  );
  const r = spawnSync(path.join(apiDir, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  if (r.status === 0) console.log('ok');
  else {
    failed++;
    console.log('FAILED');
    console.error(r.stdout, r.stderr);
  }
}
process.exit(failed ? 1 : 0);
