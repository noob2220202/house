import 'reflect-metadata';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const WORKER_METADATA = 'bullmq:worker_metadata';

function processorFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return processorFiles(full);
    return name.endsWith('.ts') &&
      !name.endsWith('.spec.ts') &&
      /@Processor\(/.test(readFileSync(full, 'utf8'))
      ? [full]
      : [];
  });
}

/**
 * The HTTP API must never consume jobs: every BullMQ processor is declared with autorun:false and
 * starts its worker only when JOBS_ENABLED (set by worker.ts, cleared by main.ts).
 */
describe('BullMQ processors', () => {
  const files = processorFiles(path.join(__dirname, 'modules'));

  it('are found', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it.each(files.map((f) => [path.relative(__dirname, f), f]))(
    '%s does not autorun and starts only when JOBS_ENABLED',
    async (_name, file) => {
      const exports = (await import(file)) as Record<string, unknown>;
      const classes = Object.values(exports).filter(
        (v): v is new (...args: never[]) => unknown =>
          typeof v === 'function' && Reflect.hasMetadata(WORKER_METADATA, v),
      );
      expect(classes.length).toBeGreaterThan(0);
      for (const cls of classes) {
        const opts = Reflect.getMetadata(WORKER_METADATA, cls) as { autorun?: boolean } | undefined;
        expect(opts?.autorun).toBe(false);
      }
      const source = readFileSync(file, 'utf8');
      expect(source).toMatch(/if \(!this\.config\.get\('JOBS_ENABLED'\)\) return;/);
      expect(source).toMatch(/this\.worker\.run\(\)/);
    },
  );
});
