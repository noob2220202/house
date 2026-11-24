/**
 * The e2e-only login (browser test harness, scripts/e2e-stack.sh) is compiled into every build but
 * only REGISTERED when both NODE_ENV=test and E2E_FAKE_OAUTH=1 — never in development or
 * production. The env schema additionally refuses E2E_FAKE_OAUTH outside NODE_ENV=test, and the
 * controller re-checks the validated config on every request (E2eOnlyGuard).
 *
 * Read from process.env on purpose: AppModule decides its imports at import time, before
 * ConfigModule has validated anything.
 */
export declare function e2eFakeAuthEnabled(env?: NodeJS.ProcessEnv): boolean;
