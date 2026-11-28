#!/usr/bin/env node
// Creates a new migration folder from the diff between existing migrations and the current schema,
// using a per-module shadow DB so parallel teams never collide.
//   pnpm --filter @house/api db:migration:new <module> <change_name>
// Env: SHADOW_DATABASE_URL (default postgresql://house:house@localhost:5432/house_shadow_<module>)
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [moduleName, change] = process.argv.slice(2);
if (!moduleName || !change || !/^[a-z0-9_-]+$/.test(moduleName) || !/^[a-z0-9_]+$/.test(change)) {
  console.error(
    'usage: db:migration:new <module> <change_name>   (lowercase, change_name in snake_case)',
  );
  process.exit(2);
}
const apiDir = path.resolve(import.meta.dirname, '..');
const migrationsDir = path.join(apiDir, 'prisma', 'schema', 'migrations');
const shadow =
  process.env.SHADOW_DATABASE_URL ??
  `postgresql://house:house@localhost:5432/house_shadow_${moduleName.replace(/-/g, '_')}`;

const IS_WINDOWS = process.platform === 'win32';
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
    migrationsDir,
    '--to-schema-datamodel',
    path.join(apiDir, 'prisma', 'schema'),
    '--shadow-database-url',
    shadow,
    '--script',
  ]);

let r = diff();
if (r.status !== 0 && /P1003/.test(r.stdout + r.stderr)) {
  // Shadow DB missing: create it through the maintenance DB, then retry.
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
    process.exit(created.status ?? 1);
  }
  r = diff();
}
if (r.status !== 0) {
  console.error(r.stdout, r.stderr);
  process.exit(r.status ?? 1);
}
const sql = r.stdout.trim();
if (!sql || sql === '-- This is an empty migration.') {
  console.log('No schema changes — nothing to do.');
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const dir = path.join(migrationsDir, `${stamp}_${moduleName.replace(/-/g, '_')}_${change}`);
mkdirSync(dir, { recursive: true });
try {
  writeFileSync(path.join(dir, 'migration.sql'), `-- ${moduleName}: ${change}\n${sql}\n`);
} catch (err) {
  rmSync(dir, { recursive: true, force: true });
  throw err;
}
console.log(
  `Created ${path.relative(apiDir, dir)}/migration.sql — review it: it must contain only your change.`,
);
