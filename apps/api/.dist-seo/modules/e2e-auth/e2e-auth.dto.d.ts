import { z } from 'zod';
/** Only fresh test members may be created, and only under this reserved domain (RFC 2606). */
export declare const E2E_EMAIL_DOMAIN = "e2e.example.invalid";
export declare const e2eLoginSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
    create: z.ZodOptional<z.ZodObject<{
        nickname: z.ZodString;
    }, z.core.$strip>>;
    agreeTerms: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type E2eLoginInput = z.output<typeof e2eLoginSchema>;
declare const E2eLoginDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
    create: z.ZodOptional<z.ZodObject<{
        nickname: z.ZodString;
    }, z.core.$strip>>;
    agreeTerms: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>>;
export declare class E2eLoginDto extends E2eLoginDto_base {
}
export interface E2eLoginResponse {
    userId: string;
    role: string;
    agencyId: string | null;
    created: boolean;
    /** For the x-csrf-token header (same as after a real login). */
    csrfToken: string;
}
export {};
