import { readFileSync } from 'node:fs';
import { bannerImpressionBatchSchema, ErrorCode } from '@house/shared';
import { z } from 'zod';
import { AppException } from '../errors/app.exception';
import { MAX_REPORTED_ISSUES } from '../errors/zod-issues';
import { createZodDto, ZodValidationPipe } from './zod-validation.pipe';

function catchAppException(fn: () => unknown): AppException {
  try {
    fn();
  } catch (e) {
    if (e instanceof AppException) return e;
    throw e;
  }
  throw new Error('expected an AppException');
}

function detailsOf(e: AppException): unknown[] {
  return Array.isArray(e.details) ? e.details : [];
}

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe();

  it('runs on a zod version without the oversized-collection memory advisory (>= 4.6.6, SEC-04)', () => {
    const { version } = JSON.parse(readFileSync(require.resolve('zod/package.json'), 'utf8')) as {
      version: string;
    };
    const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
    expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThanOrEqual(4_006_006);
  });

  it('parses a ZodDto body and returns the parsed output', () => {
    class Dto extends createZodDto(z.object({ n: z.coerce.number().int() })) {}
    expect(pipe.transform({ n: '3' }, { type: 'body', metatype: Dto })).toEqual({ n: 3 });
  });

  it('passes through non-DTO params and custom decorators untouched', () => {
    expect(pipe.transform('x', { type: 'query', metatype: String })).toBe('x');
    expect(pipe.transform({ a: 1 }, { type: 'custom' })).toEqual({ a: 1 });
  });

  it('throws VALIDATION_FAILED with issue details', () => {
    class Dto extends createZodDto(z.object({ n: z.number() })) {}
    const e = catchAppException(() => pipe.transform({ n: 'x' }, { type: 'body', metatype: Dto }));
    expect(e.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(detailsOf(e)).toEqual([expect.objectContaining({ path: 'n', code: 'invalid_type' })]);
  });

  it('rejects an oversized bounded array cheaply instead of validating every element', () => {
    const ids = new Array<number>(500_000).fill(0); // ≈ 1 MB JSON body of junk ids
    const heapBefore = process.memoryUsage().heapUsed;
    const started = Date.now();
    const e = catchAppException(() =>
      new ZodValidationPipe(bannerImpressionBatchSchema).transform({ ids }, { type: 'body' }),
    );
    expect(Date.now() - started).toBeLessThan(500);
    expect(process.memoryUsage().heapUsed - heapBefore).toBeLessThan(50 * 1024 * 1024);
    expect(detailsOf(e)).toEqual([expect.objectContaining({ path: 'ids', code: 'too_big' })]);
  });

  it(`echoes at most ${MAX_REPORTED_ISSUES} issues back to the client`, () => {
    const schema = z.array(z.string()); // unbounded: one issue per bad element
    const e = catchAppException(() =>
      new ZodValidationPipe(schema).transform(new Array(1_000).fill(0), { type: 'body' }),
    );
    expect(detailsOf(e)).toHaveLength(MAX_REPORTED_ISSUES);
  });
});
