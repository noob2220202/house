"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.parseEnv = parseEnv;
const node_path_1 = __importDefault(require("node:path"));
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const bool = zod_1.z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .transform((v) => v === 'true' || v === '1' || v === 'yes');
const csv = zod_1.z.string().transform((s) => s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean));
const optionalString = zod_1.z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? undefined : v));
const seconds = (def) => zod_1.z.coerce.number().int().positive().default(def);
/** Every environment variable the API reads. Documented in apps/api/.env.example. */
exports.envSchema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    HOST: zod_1.z.string().default('0.0.0.0'),
    PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4000),
    /** Express "trust proxy" (nginx in front): "loopback", a hop count, or a CIDR list. */
    TRUST_PROXY: zod_1.z.string().default('loopback'),
    LOG_LEVEL: zod_1.z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),
    LOG_PRETTY: bool.default(false),
    SWAGGER_ENABLED: bool.default(false),
    PUBLIC_BASE_URL: zod_1.z.url(),
    ADMIN_BASE_URL: zod_1.z.url(),
    API_BASE_URL: zod_1.z.url(),
    /** Allowed browser origins (CORS + CSRF Origin check). */
    CORS_ORIGINS: csv,
    BODY_LIMIT: zod_1.z.string().default('1mb'),
    DATABASE_URL: zod_1.z.string().regex(/^postgres(ql)?:\/\//, 'postgresql:// URL required'),
    REDIS_URL: zod_1.z.string().regex(/^rediss?:\/\//, 'redis:// URL required'),
    REDIS_KEY_PREFIX: zod_1.z.string().default('house:'),
    COOKIE_SECRET: zod_1.z.string().min(32),
    COOKIE_DOMAIN: optionalString,
    /** Defaults to true in production. */
    COOKIE_SECURE: bool.optional(),
    SESSION_IDLE_TTL_SECONDS: seconds(60 * 60 * 24 * 14),
    SESSION_ABSOLUTE_TTL_SECONDS: seconds(60 * 60 * 24 * 90),
    ADMIN_SESSION_IDLE_TTL_SECONDS: seconds(60 * 30),
    ADMIN_SESSION_ABSOLUTE_TTL_SECONDS: seconds(60 * 60 * 12),
    /** Optional global admin IP allowlist (comma-separated IPs/CIDRs). Empty = no restriction. */
    ADMIN_IP_ALLOWLIST: csv.default([]),
    /** base64 32-byte key for AES-256-GCM encryption of admin TOTP secrets. */
    TOTP_ENCRYPTION_KEY: zod_1.z
        .string()
        .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be base64 of 32 bytes'),
    // Social login (카카오 / 네이버 / Google only). A provider is enabled when its client id is set.
    // Redirect URIs must exactly match the console registration:
    //   ${API_BASE_URL}/api/v1/auth/oauth/{kakao|naver|google}/callback
    KAKAO_CLIENT_ID: optionalString,
    KAKAO_CLIENT_SECRET: optionalString,
    KAKAO_REDIRECT_URI: optionalString,
    NAVER_CLIENT_ID: optionalString,
    NAVER_CLIENT_SECRET: optionalString,
    NAVER_REDIRECT_URI: optionalString,
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GOOGLE_REDIRECT_URI: optionalString,
    /** Naver Cloud Maps (map JS key is public; geocoding uses id+secret server-side). */
    NAVER_MAP_CLIENT_ID: optionalString,
    NAVER_MAP_CLIENT_SECRET: optionalString,
    /** 공공데이터포털 service key (국토교통부 아파트 매매/전월세 실거래가). Decoded form. */
    DATA_GO_KR_SERVICE_KEY: optionalString,
    /**
     * 브이월드(vworld.kr) 인증키 — 부동산중개업 사무소정보조회(getEBOfficeInfo), 중개사무소 등록번호 대조용.
     * The key is bound to the service domain given at issuance; VWORLD_DOMAIN defaults to PUBLIC_BASE_URL's host.
     */
    VWORLD_API_KEY: optionalString,
    VWORLD_DOMAIN: optionalString,
    UPLOAD_DIR: zod_1.z.string().min(1),
    PRIVATE_UPLOAD_DIR: zod_1.z.string().min(1),
    /** Public URL path (or absolute URL) nginx serves UPLOAD_DIR at. */
    MEDIA_BASE_URL: zod_1.z.string().default('/media'),
    MAX_UPLOAD_MB: zod_1.z.coerce.number().positive().max(100).default(15),
    /**
     * 시군구 code of the service region (전남광주통합특별시 순천시 = 12150 since 2026-07-01). A
     * legacy code with a known alias (46150) is mapped to the current one, so an old .env keeps
     * working; the stored data is moved by the 20261124120000_region_code_12150 migration.
     */
    REGION_SGG_CODE: zod_1.z
        .string()
        .trim()
        .regex(/^\d{5}$/)
        .default(shared_1.DEFAULT_SGG_CODE)
        .transform(shared_1.canonicalRegionCode),
    /**
     * Run BullMQ processors + register repeatable jobs. Forced by the entry point (main.ts: false,
     * worker.ts: true, see process-role.ts); only tests set it themselves (false).
     */
    JOBS_ENABLED: bool.default(false),
    THROTTLE_TTL_MS: zod_1.z.coerce.number().int().positive().default(60_000),
    // Global per-route default, keyed per user (session) or else per client IP. Matches nginx's
    // 20 r/s per IP; strict limits for auth/report/deal-request are set per route (THROTTLE.*).
    THROTTLE_LIMIT: zod_1.z.coerce.number().int().positive().default(1200),
    /**
     * TEST-ONLY browser e2e login (POST /api/v1/e2e/login, scripts/e2e-stack.sh). Only honoured
     * with NODE_ENV=test and refused by this schema in every other environment.
     */
    E2E_FAKE_OAUTH: bool.default(false),
})
    .superRefine((env, ctx) => {
    // Private documents must never be reachable under the public /media root (and vice versa).
    const pub = node_path_1.default.resolve(env.UPLOAD_DIR);
    const priv = node_path_1.default.resolve(env.PRIVATE_UPLOAD_DIR);
    const inside = (child, parent) => child === parent || child.startsWith(parent + node_path_1.default.sep);
    if (inside(pub, priv) || inside(priv, pub)) {
        ctx.addIssue({
            code: 'custom',
            path: ['PRIVATE_UPLOAD_DIR'],
            message: 'UPLOAD_DIR and PRIVATE_UPLOAD_DIR must not contain each other',
        });
    }
    if (env.E2E_FAKE_OAUTH && env.NODE_ENV !== 'test') {
        ctx.addIssue({
            code: 'custom',
            path: ['E2E_FAKE_OAUTH'],
            message: 'test-only login: allowed only with NODE_ENV=test',
        });
    }
    if (env.NODE_ENV !== 'production')
        return;
    if (env.COOKIE_SECURE === false) {
        ctx.addIssue({
            code: 'custom',
            path: ['COOKIE_SECURE'],
            message: 'must be true in production',
        });
    }
    for (const key of ['COOKIE_SECRET', 'TOTP_ENCRYPTION_KEY']) {
        const value = key === 'TOTP_ENCRYPTION_KEY'
            ? Buffer.from(env[key], 'base64').toString('latin1')
            : env[key];
        if (/dev-only|change-me/i.test(value)) {
            ctx.addIssue({ code: 'custom', path: [key], message: 'placeholder secret in production' });
        }
    }
    if (env.SWAGGER_ENABLED) {
        ctx.addIssue({
            code: 'custom',
            path: ['SWAGGER_ENABLED'],
            message: 'must be false in production',
        });
    }
});
function parseEnv(raw) {
    // `KEY=` (empty) in an env file means "unset" → defaults apply.
    const cleaned = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === '' ? undefined : v]));
    const result = exports.envSchema.safeParse(cleaned);
    if (!result.success) {
        const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
        throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
    }
    return result.data;
}
//# sourceMappingURL=env.schema.js.map