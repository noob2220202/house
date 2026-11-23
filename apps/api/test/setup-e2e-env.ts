// Jest setupFiles for e2e: loads the env of E2E_MODULE before any app code is imported.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveTestEnv } = require('./load-test-env.cjs') as {
  resolveTestEnv: (moduleName: string) => Record<string, string>;
};

const moduleName = process.env.E2E_MODULE;
if (!moduleName)
  throw new Error(
    'E2E_MODULE is not set. Run e2e via `pnpm --filter @house/api test:e2e <module>`.',
  );
Object.assign(process.env, resolveTestEnv(moduleName));
