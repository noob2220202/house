#!/usr/bin/env node
// Fails (exit 1) when prisma/schema/*.prisma and the migrations folder disagree, i.e. someone
// edited a model without generating its migration (or hand-edited a migration). For CI and
// before every release:  pnpm --filter @house/api db:drift
// Env: SHADOW_DATABASE_URL (default postgresql://house:house@localhost:5432/house_shadow_drift);
// the shadow DB is created if missing and reset by Prisma on every run.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const apiDir = path.resolve(import.meta.dirname, '..');
const IS_WINDOWS = process.platform === 'win32';
const shadow =
  process.env.SHADOW_DATABASE_URL ?? 'postgresql://house:house@localhost:5432/house_shadow_drift';
const prisma = (args, input) =>
  spawnSync(path.join(apiDir, 'node_modules', '.bin', IS_WINDOWS ? 'prisma.cmd' : 'prisma'), args, {
    cwd: apiDir,
    encoding: 'utf8',
    input,
    // Windows dev PCs: node_modules/.bin holds .cmd shims, which Node only spawns through a shell.
    shell: IS_WINDOWS,
  });
const diff = () =>
  prisma([
    'migrate',
    'diff',
    '--from-migrations',
    path.join(apiDir, 'prisma', 'schema', 'migrations'),
    '--to-schema-datamodel',
    path.join(apiDir, 'prisma', 'schema'),
    '--shadow-database-url',
    shadow,
    '--script',
    '--exit-code',
  ]);

let r = diff();
if (r.status === 1 && /P1003/.test(r.stdout + r.stderr)) {
  const url = new URL(shadow);
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`unsafe shadow database name: ${name}`);
  url.pathname = '/postgres';
  url.search = '';
  const created = prisma(
    ['db', 'execute', '--url', url.toString(), '--stdin'],
    `CREATE DATABASE "${name}";`,
  );
  if (created.status !== 0) {
    console.error(created.stdout, created.stderr);
    process.exit(1);
  }
  r = diff();
}
// prisma migrate diff --exit-code: 0 = no difference, 2 = difference, 1 = error.
if (r.status === 0) {
  console.log('db:drift ok — migrations match the Prisma schema.');
  process.exit(0);
}
if (r.status === 2) {
  console.error('Schema drift: the Prisma schema has changes without a migration:\n');
  console.error(r.stdout);
  console.error('Generate one with: pnpm --filter @house/api db:migration:new <module> <change>');
  process.exit(1);
}
console.error(r.stdout, r.stderr);
process.exit(1);
