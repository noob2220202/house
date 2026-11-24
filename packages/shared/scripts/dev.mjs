// `pnpm dev`: keep both builds of @house/shared fresh — CommonJS (dist/, apps/api + jest) and
// ES modules (dist/esm/, the Next/vite bundles, via the `module` export condition).
// Two plain `tsc --watch` processes; `tsc -b` would trust a stale .tsbuildinfo after dist/ is deleted.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const children = ['tsconfig.build.json', 'tsconfig.esm.json'].map((project) =>
  spawn(process.execPath, [tsc, '-p', project, '--watch', '--preserveWatchOutput'], {
    stdio: 'inherit',
  }),
);

let exiting = false;
const stop = (code) => {
  if (exiting) return;
  exiting = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
};
for (const child of children) child.on('exit', (code) => stop(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(0));
