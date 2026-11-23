import { ArgumentMetadata, Injectable, Optional, PipeTransform } from '@nestjs/common';
import { ErrorCode } from '@house/shared';
import { z } from 'zod';
import { AppException } from '../errors/app.exception';
import { formatZodIssues } from '../errors/zod-issues';

/** A DTO class carrying its zod schema; created with createZodDto(schema). */
export interface ZodDto<T extends z.ZodType = z.ZodType> {
  new (): z.output<T>;
  readonly schema: T;
}

/**
 * Turns a zod schema (from @house/shared) into a class usable as a Nest parameter type:
 *   export class CreateBannerDto extends createZodDto(bannerInputSchema) {}
 *   create(@Body() dto: CreateBannerDto) { ... }
 * The global ZodValidationPipe validates and replaces the value with the parsed output.
 */
export function createZodDto<T extends z.ZodType>(schema: T): ZodDto<T> {
  class Dto {
    static readonly schema = schema;
  }
  return Dto as unknown as ZodDto<T>;
}

function isZodDto(metatype: unknown): metatype is ZodDto {
  return (
    typeof metatype === 'function' &&
    'schema' in metatype &&
    (metatype as { schema: unknown }).schema instanceof z.ZodType
  );
}

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppException(ErrorCode.VALIDATION_FAILED, { details: formatZodIssues(result.error) });
  }
  return result.data;
}

/**
 * Global pipe: validates @Body/@Query/@Param whose type is a ZodDto.
 * Can also be used explicitly: @Query(new ZodValidationPipe(schema)) q: z.output<typeof schema>.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(@Optional() private readonly schema?: z.ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (this.schema) return parseOrThrow(this.schema, value);
    if (metadata.type === 'custom') return value;
    if (isZodDto(metadata.metatype)) return parseOrThrow(metadata.metatype.schema, value);
    return value;
  }
}
