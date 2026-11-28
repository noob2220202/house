#!/usr/bin/env node
// Usage: pnpm --filter @house/api test:e2e [module ...] [--parallel] [-- <jest args>]
//   no module → every module with test/env/<module>.env and a test/e2e/<module> folder.
// For each module: `prisma migrate deploy` on its DB (creates it + extensions if missing), then jest.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { listModules, resolveTestEnv } = require('./load-test-env.cjs');
const apiDir = path.resolve(import.meta.dirname, '..');
const IS_WINDOWS = process.platform === 'win32';

const argv = process.argv.slice(2);
const dashIdx = argv.indexOf('--');
const own = dashIdx >= 0 ? argv.slice(0, dashIdx) : argv;
const jestArgs = dashIdx >= 0 ? argv.slice(dashIdx + 1) : [];
const parallel = own.includes('--parallel');
const requested = own.filter((a) => !a.startsWith('--'));
const all = listModules().filter((m) => existsSync(path.join(apiDir, 'test', 'e2e', m)));
const modules = requested.length > 0 ? requested : all;
for (const m of modules) {
  if (!all.includes(m)) {
    console.error(`unknown e2e module "${m}". Known: ${all.join(', ')}`);
    process.exit(2);
  }
}

function run(cmd, args, env, label) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: apiDir,
      env: { ...process.env, ...env },
      stdio: parallel ? 'pipe' : 'inherit',
      // Windows dev PCs: node_modules/.bin holds .cmd shims, which Node only spawns through a shell.
      shell: IS_WINDOWS,
    });
    let out = '';
    if (parallel) {
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
    }
    child.on('close', (code) => {
      if (parallel && out) process.stdout.write(`\n===== ${label} =====\n${out}`);
      resolve(code ?? 1);
    });
  });
}

async function runModule(m) {
  const env = resolveTestEnv(m);
  const bin = (name) =>
    path.join(apiDir, 'node_modules', '.bin', IS_WINDOWS ? `${name}.cmd` : name);
  const migrated = await run(
    bin('prisma'),
    ['migrate', 'deploy'],
    { ...env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    `${m} migrate`,
  );
  if (migrated !== 0) return { m, code: migrated };
  const code = await run(
    bin('jest'),
    ['--config', 'test/jest-e2e.config.js', ...jestArgs],
    env,
    `${m} e2e`,
  );
  return { m, code };
}

const results = parallel ? await Promise.all(modules.map(runModule)) : [];
if (!parallel) for (const m of modules) results.push(await runModule(m));

const failed = results.filter((r) => r.code !== 0);
console.log(
  `\ne2e: ${results.length - failed.length}/${results.length} module(s) passed${failed.length ? ` — failed: ${failed.map((r) => r.m).join(', ')}` : ''}`,
);
process.exit(failed.length ? 1 : 0);
