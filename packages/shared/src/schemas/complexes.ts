// Owned by the complexes module team.
import { z } from 'zod';
import { TradeDealType } from '../enums/complex';
import { idSchema, paginationQuerySchema, queryInt, regionCodeSchema } from './common';

export const complexSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(50).optional(),
  emdCode: regionCodeSchema.optional(),
});

export const complexTradesQuerySchema = paginationQuerySchema.extend({
  dealType: z.enum(TradeDealType).optional(),
  areaTypeId: idSchema.optional(),
  /** YYYYMM */
  fromYm: queryInt(200001, 210012),
  toYm: queryInt(200001, 210012),
});

export const popularComplexesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
