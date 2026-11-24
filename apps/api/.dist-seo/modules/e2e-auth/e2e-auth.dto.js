"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2eLoginDto = exports.e2eLoginSchema = exports.E2E_EMAIL_DOMAIN = void 0;
const zod_1 = require("zod");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
/** Only fresh test members may be created, and only under this reserved domain (RFC 2606). */
exports.E2E_EMAIL_DOMAIN = 'e2e.example.invalid';
exports.e2eLoginSchema = zod_1.z
    .object({
    /** A seeded member (e.g. `a1-owner@seed.example.invalid`) or a test member to create. */
    email: zod_1.z
        .email()
        .max(254)
        .transform((e) => e.toLowerCase()),
    /**
     * Create a USER-role member when no account has this email (only `@e2e.example.invalid`).
     * Without it an unknown email answers 404.
     */
    create: zod_1.z.object({ nickname: zod_1.z.string().trim().min(2).max(20) }).optional(),
    /** Agree to every current required account terms version the member has not agreed to yet. */
    agreeTerms: zod_1.z.boolean().default(true),
})
    .refine((v) => !v.create || v.email.endsWith(`@${exports.E2E_EMAIL_DOMAIN}`), {
    path: ['email'],
    message: `only @${exports.E2E_EMAIL_DOMAIN} members can be created`,
});
class E2eLoginDto extends (0, zod_validation_pipe_1.createZodDto)(exports.e2eLoginSchema) {
}
exports.E2eLoginDto = E2eLoginDto;
//# sourceMappingURL=e2e-auth.dto.js.map