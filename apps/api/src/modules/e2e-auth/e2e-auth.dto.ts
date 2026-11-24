import { z } from 'zod';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

/** Only fresh test members may be created, and only under this reserved domain (RFC 2606). */
export const E2E_EMAIL_DOMAIN = 'e2e.example.invalid';

export const e2eLoginSchema = z
  .object({
    /** A seeded member (e.g. `a1-owner@seed.example.invalid`) or a test member to create. */
    email: z
      .email()
      .max(254)
      .transform((e) => e.toLowerCase()),
    /**
     * Create a USER-role member when no account has this email (only `@e2e.example.invalid`).
     * Without it an unknown email answers 404.
     */
    create: z.object({ nickname: z.string().trim().min(2).max(20) }).optional(),
    /** Agree to every current required account terms version the member has not agreed to yet. */
    agreeTerms: z.boolean().default(true),
  })
  .refine((v) => !v.create || v.email.endsWith(`@${E2E_EMAIL_DOMAIN}`), {
    path: ['email'],
    message: `only @${E2E_EMAIL_DOMAIN} members can be created`,
  });
export type E2eLoginInput = z.output<typeof e2eLoginSchema>;

export class E2eLoginDto extends createZodDto(e2eLoginSchema) {}

export interface E2eLoginResponse {
  userId: string;
  role: string;
  agencyId: string | null;
  created: boolean;
  /** For the x-csrf-token header (same as after a real login). */
  csrfToken: string;
}
