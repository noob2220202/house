// Owned by the agencies module team.
import { z } from 'zod';
import { AgencyStatus } from '../enums/agency';
import { AssetType } from '../enums/listing';
import {
  bboxSchema,
  contactPhoneSchema,
  csvArray,
  latSchema,
  lngSchema,
  paginationQuerySchema,
  phoneSchema,
  regionCodeSchema,
} from './common';

export const agencyRegisterSchema = z.object({
  name: z.string().trim().min(1).max(100),
  representativeName: z.string().trim().min(1).max(50),
  /** 중개사무소 등록번호, e.g. 46150-2020-00012 */
  registrationNumber: z.string().trim().min(5).max(40),
  businessNumber: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10}$/, '사업자등록번호 10자리를 입력해 주세요.'))
    .optional(),
  /** 대표번호 (유선/대표번호 허용). */
  phone: contactPhoneSchema,
  mobile: phoneSchema.optional(),
  roadAddress: z.string().trim().min(1).max(200),
  jibunAddress: z.string().trim().max(200).optional(),
  addressDetail: z.string().trim().max(100).optional(),
  lat: latSchema,
  lng: lngSchema,
  intro: z.string().trim().max(3000).optional(),
  specialties: z.array(z.enum(AssetType)).max(10).default([]),
});
export type AgencyRegisterInput = z.infer<typeof agencyRegisterSchema>;

export const agencyUpdateSchema = agencyRegisterSchema
  .omit({ registrationNumber: true, representativeName: true })
  .partial();

export const agencySearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(50).optional(),
  emdCode: regionCodeSchema.optional(),
  bbox: bboxSchema.optional(),
  specialties: csvArray(z.enum(AssetType)),
});

export const agencyDecisionSchema = z.object({
  status: z.enum([AgencyStatus.APPROVED, AgencyStatus.REJECTED, AgencyStatus.SUSPENDED]),
  reason: z.string().trim().max(1000).optional(),
});
