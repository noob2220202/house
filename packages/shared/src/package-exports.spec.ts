import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Packaging contract of @house/shared (audit FIX-shared-bundle).
 *
 * Bundlers (Next/webpack, vitest/vite) must get the ES-module build so they can tree-shake the
 * barrel and share the apps' own ESM zod. Node (apps/api under Nest, jest, scripts) must keep the
 * CommonJS build: the ESM build uses extensionless relative imports that only bundlers resolve,
 * so it sits behind the bundler-only `module` condition, never `import`.
 */
const pkgDir = path.resolve(__dirname, '..');
const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(pkgDir, file), 'utf8')) as T;

type Exports = string | { [condition: string]: Exports };
interface PackageJson {
  main: string;
  types: string;
  module?: string;
  type?: string;
  sideEffects: unknown;
  exports: Record<string, Exports>;
  scripts: Record<string, string>;
}
interface TsConfig {
  extends?: string;
  compilerOptions?: Record<string, unknown>;
}

const pkg = readJson<PackageJson>('package.json');

/** Node's PACKAGE_EXPORTS_RESOLVE for one subpath: first key (in object order) whose condition is active. */
function resolveExport(target: Exports, conditions: readonly string[]): string | null {
  if (typeof target === 'string') return target;
  for (const [key, value] of Object.entries(target)) {
    if (key === 'default' || conditions.includes(key)) {
      const hit = resolveExport(value, conditions);
      if (hit !== null) return hit;
    }
  }
  return null;
}

// Condition sets as each tool activates them.
const WEBPACK_IMPORT = ['import', 'module', 'webpack', 'production', 'browser'];
const WEBPACK_REQUIRE = ['require', 'module', 'webpack', 'production', 'browser'];
const WEBPACK_SERVER = ['react-server', 'import', 'module', 'webpack', 'production', 'node'];
const VITE = ['module', 'browser', 'development', 'import'];
const NODE_REQUIRE = ['node', 'require'];
const NODE_IMPORT = ['node', 'import'];
const TYPESCRIPT = ['types', 'import'];

const ESM_ENTRY = './dist/esm/index.js';
const CJS_ENTRY = './dist/index.js';

describe('@house/shared package exports', () => {
  const root = pkg.exports['.'];

  it.each([
    ['webpack import', WEBPACK_IMPORT],
    ['webpack require', WEBPACK_REQUIRE],
    ['webpack server (RSC)', WEBPACK_SERVER],
    ['vite / vitest', VITE],
  ])('%s resolves the ESM build', (_name, conditions) => {
    expect(resolveExport(root!, conditions)).toBe(ESM_ENTRY);
  });

  it.each([
    ['node require (api, jest)', NODE_REQUIRE],
    ['node import (.mjs scripts)', NODE_IMPORT],
  ])('%s resolves the CommonJS build', (_name, conditions) => {
    expect(resolveExport(root!, conditions)).toBe(CJS_ENTRY);
  });

  it('serves one set of type declarations for every consumer', () => {
    expect(resolveExport(root!, TYPESCRIPT)).toBe('./dist/index.d.ts');
    expect(pkg.types).toBe('./dist/index.d.ts');
    expect(pkg.main).toBe(CJS_ENTRY);
    expect(pkg.module).toBe(ESM_ENTRY);
  });

  it('stays a CommonJS package marked side-effect free', () => {
    // "type": "module" would make Node (and webpack's fullySpecified rule) reject the
    // extensionless imports in dist/esm and turn dist/*.js CommonJS into ESM.
    expect(pkg.type).toBeUndefined();
    expect(pkg.sideEffects).toBe(false);
  });

  it('builds both outputs from the same sources', () => {
    expect(pkg.scripts.build).toContain('tsconfig.build.json');
    expect(pkg.scripts.build).toContain('tsconfig.esm.json');
    const cjs = readJson<TsConfig>('tsconfig.build.json');
    const esm = readJson<TsConfig>('tsconfig.esm.json');
    expect(cjs.compilerOptions?.outDir).toBe('dist');
    expect(esm.extends).toBe('./tsconfig.build.json');
    expect(esm.compilerOptions).toMatchObject({
      module: 'ESNext',
      outDir: 'dist/esm',
      declaration: false,
    });
    expect(`./${String(esm.compilerOptions?.outDir)}/index.js`).toBe(ESM_ENTRY);
  });
});

/**
 * `sideEffects: false` is only honest if no module runs code at import time beyond building
 * values. Configuring zod globally (z.config, locales) here would be dropped by tree-shaking in
 * the apps and kept in the api — a silent divergence — so it is not allowed in shared.
 */
describe('@house/shared sources stay side-effect free', () => {
  const srcDir = path.join(pkgDir, 'src');
  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) sources.push(p);
    }
  };
  walk(srcDir);

  it.each(sources.map((p) => [path.relative(srcDir, p), p]))('%s', (_rel, file) => {
    const text = fs.readFileSync(file, 'utf8');
    expect(text).not.toMatch(/\bz\.config\s*\(/);
    expect(text).not.toMatch(/\bz\.locales\b|from 'zod\/(v4\/)?locales/);
    expect(text).not.toMatch(/import\s+\*\s+as\s+z\s+from\s+'zod'/);
    expect(text).not.toMatch(/^\s*(declare\s+)?(const\s+)?enum\s/m);
  });
});
