import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
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
export declare function createZodDto<T extends z.ZodType>(schema: T): ZodDto<T>;
export declare function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.output<T>;
/**
 * Global pipe: validates @Body/@Query/@Param whose type is a ZodDto.
 * Can also be used explicitly: @Query(new ZodValidationPipe(schema)) q: z.output<typeof schema>.
 */
export declare class ZodValidationPipe implements PipeTransform {
    private readonly schema?;
    constructor(schema?: z.ZodType | undefined);
    transform(value: unknown, metadata: ArgumentMetadata): unknown;
}
